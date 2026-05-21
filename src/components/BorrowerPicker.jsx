/**
 * BorrowerPicker — Fast switcher for borrowers + their blueprints.
 *
 * Default (empty search) view shows two stacked sections:
 *   ★ Pinned   — borrowers the broker starred, in a stable order
 *   ◷ Recents  — last 15 borrowers opened, newest first (auto-tracked)
 * Type to fall back to a full type-ahead search across every client.
 *
 * Picking a client loads their blueprints (scenarios). If they have exactly one,
 * it opens straight away (no extra tap); if none, one is auto-created; if several,
 * you choose. Each row has a star to pin/unpin.
 *
 * Docking: a dropdown panel under the header chip on desktop; a full-height
 * slide-in drawer over a dimmed backdrop on mobile (isDesktop === false).
 *
 * Recents/pinned persistence lives in useBlueprintShelf (localStorage, per-device).
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Icon from '../Icon';
import useBlueprintShelf from '../hooks/useBlueprintShelf';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// When a selected client has exactly one blueprint, open it immediately.
const AUTO_OPEN_SINGLE = true;

const STATUS_COLORS = {
  lead: '#F59E0B',
  active: '#3B82F6',
  pre_approved: '#6366F1',
  in_escrow: '#8B5CF6',
  closed: '#10B981',
  dead: '#666666',
};

const STATUS_LABELS = {
  lead: 'Lead',
  active: 'Active',
  pre_approved: 'Pre-Approved',
  in_escrow: 'In Escrow',
  closed: 'Closed',
  dead: 'Dead',
};

function fmt(v) {
  if (isNaN(v) || v == null || v === 0) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}

export default function BorrowerPicker({
  borrowers = [],
  activeBorrower = null,
  onSelect,
  onCreateNew,
  onSelectScenario,
  onAutoCreateScenario,
  scenarios = [],
  scenariosLoading = false,
  loading = false,
  isDesktop = true,
  T = {},
}) {
  const { recentIds, pinnedIds, recordRecent, togglePin, isPinned } = useBlueprintShelf();

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 = pick client, 2 = pick scenario
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [pendingBorrower, setPendingBorrower] = useState(null);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const rowRefs = useRef([]);

  // ── Theme tokens ──
  const bg = T.inputBg || '#1A1A1A';
  const border = T.border || 'rgba(255,255,255,0.08)';
  const text = T.text || '#EDEDED';
  const textSec = T.textSecondary || '#A1A1A1';
  const textTer = T.textTertiary || '#666666';
  const card = T.card || '#0F0F0F';
  const accent = '#6366F1';
  const hoverBg = T.tabActiveBg || 'rgba(255,255,255,0.04)';

  // ── Resolve shelf ids → live borrower objects ──
  const byId = useMemo(() => {
    const m = {};
    borrowers.forEach((b) => { if (b && b.id != null) m[b.id] = b; });
    return m;
  }, [borrowers]);

  const pinnedBorrowers = useMemo(
    () => pinnedIds.map((id) => byId[id]).filter(Boolean),
    [pinnedIds, byId]
  );
  const recentBorrowers = useMemo(
    () => recentIds.map((id) => byId[id]).filter(Boolean).filter((b) => !pinnedIds.includes(b.id)),
    [recentIds, byId, pinnedIds]
  );
  const hasShelf = pinnedBorrowers.length + recentBorrowers.length > 0;

  const searching = !!search.trim();
  const filtered = searching
    ? borrowers.filter((b) => {
        const q = search.toLowerCase();
        return (
          (b.name || '').toLowerCase().includes(q) ||
          (b.email || '').toLowerCase().includes(q) ||
          (b.phone || '').toLowerCase().includes(q)
        );
      })
    : borrowers;

  // The flat, ordered list of selectable client rows for step 1 (drives keyboard nav).
  const step1List = searching ? filtered : (hasShelf ? [...pinnedBorrowers, ...recentBorrowers] : borrowers);
  const showSections = !searching && hasShelf;
  const pinnedCount = pinnedBorrowers.length;

  const closePicker = useCallback(() => {
    setIsOpen(false);
    setStep(1);
    setPendingBorrower(null);
    setSearch('');
    setHighlightIdx(0);
  }, []);

  // Reset highlight when the visible set changes
  useEffect(() => { setHighlightIdx(0); }, [search, step]);

  // Close on outside click (desktop dropdown). Backdrop handles the mobile drawer.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closePicker();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closePicker]);

  // Focus search input when opened on step 1
  useEffect(() => {
    if (isOpen && step === 1 && inputRef.current) inputRef.current.focus();
  }, [isOpen, step]);

  // Scroll highlighted row into view
  useEffect(() => {
    const el = rowRefs.current[highlightIdx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  // When a client's scenarios finish loading: auto-create if none, auto-open if one.
  useEffect(() => {
    if (step !== 2 || !pendingBorrower || scenariosLoading) return;
    const bid = pendingBorrower.id;
    if (scenarios.length === 0 && onAutoCreateScenario) {
      onAutoCreateScenario(pendingBorrower);
      if (bid != null) recordRecent(bid);
      closePicker();
    } else if (AUTO_OPEN_SINGLE && scenarios.length === 1 && onSelectScenario) {
      onSelectScenario(scenarios[0]);
      if (bid != null) recordRecent(bid);
      closePicker();
    }
  }, [step, pendingBorrower, scenarios, scenariosLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectBorrower = (borrower) => {
    setPendingBorrower(borrower);
    setStep(2);
    setHighlightIdx(0);
    setSearch('');
    if (onSelect) onSelect(borrower); // triggers scenario loading in parent
  };

  const handleSelectScenario = (scenario) => {
    const bid = pendingBorrower?.id ?? activeBorrower?.id;
    if (onSelectScenario) onSelectScenario(scenario);
    if (bid != null) recordRecent(bid);
    closePicker();
  };

  const handleNewBlueprint = () => {
    const target = pendingBorrower;
    if (onAutoCreateScenario && target) onAutoCreateScenario(target);
    if (target?.id != null) recordRecent(target.id);
    closePicker();
  };

  const handleCreateNew = () => {
    const q = search.trim();
    closePicker();
    if (onCreateNew) onCreateNew(q);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(null);
    setStep(1);
    setPendingBorrower(null);
  };

  const handleBack = () => {
    setStep(1);
    setPendingBorrower(null);
    setHighlightIdx(0);
    if (onSelect) onSelect(null);
  };

  const handleTogglePin = (e, id) => {
    e.stopPropagation();
    togglePin(id);
  };

  const handleKeyDown = useCallback((e) => {
    if (step === 2) {
      if (e.key === 'Escape') { setStep(1); setPendingBorrower(null); setHighlightIdx(0); if (onSelect) onSelect(null); return; }
      const total = scenarios.length + 1; // +1 for "New Blueprint"
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((p) => (p + 1) % total); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((p) => (p - 1 + total) % total); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIdx < scenarios.length) handleSelectScenario(scenarios[highlightIdx]);
        else handleNewBlueprint();
      }
      return;
    }

    const total = step1List.length + 1; // +1 for "New Client"
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((p) => (p + 1) % total); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((p) => (p - 1 + total) % total); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx === step1List.length) handleCreateNew();
      else if (step1List[highlightIdx]) handleSelectBorrower(step1List[highlightIdx]);
    } else if (e.key === 'Escape') {
      closePicker();
    }
  }, [step1List, highlightIdx, step, scenarios]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Row renderer (shared by shelf, search, and full-list) ──
  const renderBorrowerRow = (b, i) => {
    const isHighlighted = i === highlightIdx;
    const isActive = activeBorrower?.id === b.id;
    const statusColor = STATUS_COLORS[b.status] || textTer;
    const statusLabel = STATUS_LABELS[b.status] || b.status || '';
    const pinned = isPinned(b.id);

    return (
      <div
        key={`row-${b.id}`}
        ref={(el) => { rowRefs.current[i] = el; }}
        onClick={() => handleSelectBorrower(b)}
        onMouseEnter={() => setHighlightIdx(i)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px',
          background: isHighlighted ? hoverBg : isActive ? `${accent}08` : 'transparent',
          cursor: 'pointer',
          borderBottom: `1px solid ${border}`,
          borderLeft: isActive ? `3px solid ${accent}` : '3px solid transparent',
          transition: 'background 0.1s',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: `${statusColor}15`,
          border: `2px solid ${statusColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>
            {(b.name || '?')[0].toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 13, fontWeight: 600, color: text, fontFamily: FONT,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {b.name || 'Unnamed'}
            </span>
            {statusLabel && (
              <span style={{
                fontSize: 9, fontWeight: 600, color: statusColor, background: `${statusColor}12`,
                padding: '1px 5px', borderRadius: 4, fontFamily: FONT,
                textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
              }}>
                {statusLabel}
              </span>
            )}
          </div>
          <div style={{
            fontSize: 11, color: textTer, fontFamily: FONT, marginTop: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {b.email || b.phone || 'No contact info'}
          </div>
        </div>
        {/* Pin toggle */}
        <div
          onClick={(e) => handleTogglePin(e, b.id)}
          title={pinned ? 'Unpin' : 'Pin to top'}
          style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: pinned ? `${accent}14` : 'transparent',
            cursor: 'pointer', opacity: pinned ? 1 : 0.45,
            transition: 'all 0.12s',
          }}
        >
          <Icon name="star" size={14} color={pinned ? accent : textTer} />
        </div>
        <Icon name="chevron-right" size={14} color={textTer} />
      </div>
    );
  };

  const renderSectionLabel = (icon, label, count) => (
    <div style={{
      padding: '7px 12px',
      fontSize: 10, fontWeight: 600, color: textTer,
      textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT,
      borderBottom: `1px solid ${border}`, background: 'rgba(255,255,255,0.015)',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      <Icon name={icon} size={11} color={accent} />
      {label}
      {count != null && <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{count}</span>}
    </div>
  );

  // ── Body (step 1 list / step 2 scenarios) ──
  const renderBody = () => (
    <>
      {step === 1 && (
        <>
          {!showSections && (
            <div style={{
              padding: '6px 12px', fontSize: 10, fontWeight: 600, color: textTer,
              textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT,
              borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, display: 'inline-block' }} />
              {searching ? 'SEARCH RESULTS' : 'SELECT CLIENT'}
              <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
                {step1List.length} result{step1List.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {step1List.map((b, i) => (
            <React.Fragment key={`grp-${b.id}`}>
              {showSections && i === 0 && pinnedCount > 0 && renderSectionLabel('star', 'Pinned', pinnedCount)}
              {showSections && i === pinnedCount && recentBorrowers.length > 0 && renderSectionLabel('clock', 'Recents', recentBorrowers.length)}
              {renderBorrowerRow(b, i)}
            </React.Fragment>
          ))}

          {searching && step1List.length === 0 && (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: textTer, fontFamily: FONT }}>
              No clients matching "{search}"
            </div>
          )}

          {/* New Client */}
          <div
            ref={(el) => { rowRefs.current[step1List.length] = el; }}
            onClick={handleCreateNew}
            onMouseEnter={() => setHighlightIdx(step1List.length)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px',
              background: highlightIdx === step1List.length ? hoverBg : 'transparent',
              cursor: 'pointer', borderTop: `1px solid ${border}`, transition: 'background 0.1s',
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `${accent}10`, border: `2px dashed ${accent}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="plus" size={14} color={accent} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: accent, fontFamily: FONT }}>New Client</div>
              <div style={{ fontSize: 10, color: textTer, fontFamily: FONT }}>
                {search ? `Create "${search}"` : 'Add a new client'}
              </div>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{
            padding: '6px 12px', fontSize: 10, fontWeight: 600, color: textTer,
            textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT,
            borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} />
            SELECT BLUEPRINT
            {scenariosLoading && <span style={{ color: accent, fontStyle: 'italic', fontWeight: 400 }}>loading...</span>}
          </div>

          {scenariosLoading ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 12, color: textTer }}>
              Loading blueprints...
            </div>
          ) : (
            <>
              {scenarios.map((s, i) => {
                const isHighlighted = i === highlightIdx;
                const cs = s.calc_summary || {};
                const name = s.name || `Scenario ${i + 1}`;
                const type = s.type === 'refi' ? 'Refi' : 'Purchase';
                return (
                  <div
                    key={s.id}
                    ref={(el) => { rowRefs.current[i] = el; }}
                    onClick={() => handleSelectScenario(s)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    style={{
                      padding: '10px 12px',
                      background: isHighlighted ? hoverBg : 'transparent',
                      cursor: 'pointer', borderBottom: `1px solid ${border}`, transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Icon name="file-text" size={14} color={accent} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: text, fontFamily: FONT }}>{name}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: textTer, background: 'rgba(255,255,255,0.04)',
                        padding: '1px 5px', borderRadius: 4, fontFamily: FONT, textTransform: 'uppercase',
                      }}>{type}</span>
                      {s.created_by === 'borrower' && (
                        <span style={{
                          fontSize: 9, fontWeight: 600, color: accent, background: `${accent}12`,
                          padding: '1px 5px', borderRadius: 4, fontFamily: FONT,
                        }}>BORROWER</span>
                      )}
                    </div>
                    {(cs.loanAmount || cs.rate || cs.monthlyPI) && (
                      <div style={{ display: 'flex', gap: 12, marginLeft: 22, fontSize: 11, fontFamily: FONT }}>
                        {cs.loanAmount > 0 && <span style={{ color: textSec }}>{fmt(cs.loanAmount)}</span>}
                        {cs.rate > 0 && <span style={{ color: textSec }}>{Number(cs.rate).toFixed(3)}%</span>}
                        {cs.monthlyPI > 0 && <span style={{ color: accent, fontWeight: 600 }}>{fmt(cs.monthlyPI)}/mo</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {scenarios.length === 0 && (
                <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: textTer }}>
                  No blueprints yet — creating one now...
                </div>
              )}

              <div
                ref={(el) => { rowRefs.current[scenarios.length] = el; }}
                onClick={handleNewBlueprint}
                onMouseEnter={() => setHighlightIdx(scenarios.length)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px',
                  background: highlightIdx === scenarios.length ? hoverBg : 'transparent',
                  cursor: 'pointer', borderTop: `1px solid ${border}`, transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: `${accent}10`, border: `1px dashed ${accent}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="plus" size={13} color={accent} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: accent, fontFamily: FONT }}>New Blueprint</div>
                  <div style={{ fontSize: 10, color: textTer, fontFamily: FONT }}>
                    {pendingBorrower?.credit_score || pendingBorrower?.incomes?.length
                      ? 'Pre-filled from Arive data'
                      : 'Start fresh scenario'}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );

  // ── Open header (search input / step-2 back bar). Shared by desktop + mobile. ──
  const renderOpenHeader = (roundedTop) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
      background: bg,
      border: `1px solid ${accent}`,
      borderBottom: roundedTop ? `1px solid ${accent}` : `1px solid ${border}`,
      borderRadius: roundedTop ? '10px 10px 0 0' : '0',
      boxShadow: roundedTop ? `0 0 0 2px ${accent}20` : 'none',
    }}>
      {step === 2 ? (
        <>
          <div onClick={handleBack} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Icon name="arrow-left" size={14} color={accent} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: text, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pendingBorrower?.name || 'Client'}
            </div>
            <div style={{ fontSize: 9, color: textTer, fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              SELECT BLUEPRINT
            </div>
          </div>
          {!roundedTop && (
            <div onClick={closePicker} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Icon name="x" size={16} color={textTer} />
            </div>
          )}
        </>
      ) : (
        <>
          <Icon name="search" size={14} color={accent} />
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search clients by name, email, phone..."
            style={{ flex: 1, background: 'transparent', border: 'none', color: text, fontSize: 13, fontFamily: FONT, outline: 'none', padding: 0 }}
          />
          {search ? (
            <span onClick={() => setSearch('')} style={{ cursor: 'pointer', color: textTer, fontSize: 14 }}>&times;</span>
          ) : !roundedTop ? (
            <div onClick={closePicker} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <Icon name="x" size={16} color={textTer} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  // ── Closed-state trigger chip (active borrower or search prompt) ──
  const renderTrigger = () => (
    <div
      onClick={() => setIsOpen(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
        background: bg,
        border: `1px solid ${activeBorrower ? accent + '40' : border}`,
        borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', minHeight: 34,
      }}
    >
      {activeBorrower ? (
        <>
          <div style={{
            width: 24, height: 24, borderRadius: '50%', background: `${accent}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>
              {(activeBorrower.name || '?')[0].toUpperCase()}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: text, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeBorrower.name}
            </div>
            {activeBorrower.email && (
              <div style={{ fontSize: 10, color: textTer, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeBorrower.email}
              </div>
            )}
          </div>
          <Icon name="chevron-down" size={14} color={textTer} />
          <div
            onClick={handleClear}
            style={{
              width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, fontSize: 12, color: textTer,
            }}
          >&times;</div>
        </>
      ) : (
        <>
          <Icon name="search" size={14} color={textTer} />
          <span style={{ flex: 1, fontSize: 12, color: textTer, fontFamily: FONT }}>
            {loading ? 'Loading...' : 'Switch client...'}
          </span>
          <Icon name="chevron-down" size={14} color={textTer} />
        </>
      )}
    </div>
  );

  const desktopDropdownStyle = {
    position: 'absolute', top: '100%', left: 0, right: 0,
    background: card, border: `1px solid ${accent}40`, borderTop: 'none',
    borderRadius: '0 0 10px 10px', maxHeight: 420, overflowY: 'auto',
    zIndex: 200, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', flex: 1,
        maxWidth: isDesktop ? 340 : 'none',
        minWidth: 180,
        width: isDesktop ? undefined : '100%',
      }}
    >
      {/* Trigger: always visible on mobile (drawer overlays it); hidden on desktop while open */}
      {(!isOpen || !isDesktop) && renderTrigger()}

      {/* Desktop: inline search header + absolute dropdown */}
      {isOpen && isDesktop && (
        <>
          {renderOpenHeader(true)}
          <div ref={listRef} onKeyDown={handleKeyDown} style={desktopDropdownStyle}>
            {renderBody()}
          </div>
        </>
      )}

      {/* Mobile: dimmed backdrop + full-height slide-in drawer */}
      {isOpen && !isDesktop && (
        <>
          <div
            onClick={closePicker}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000 }}
          />
          <div
            style={{
              position: 'fixed', top: 0, bottom: 0, left: 0,
              width: 'min(86%, 360px)',
              background: card,
              borderRight: `1px solid ${accent}40`,
              borderRadius: '0 16px 16px 0',
              zIndex: 1001,
              display: 'flex', flexDirection: 'column',
              boxShadow: '8px 0 40px rgba(0,0,0,0.55)',
            }}
          >
            {renderOpenHeader(false)}
            <div ref={listRef} onKeyDown={handleKeyDown} style={{ flex: 1, overflowY: 'auto' }}>
              {renderBody()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
