import { FONT, MONO } from "../lib/fonts.js";
/**
 * BorrowerPicker — type-ahead search to find a client and open a blueprint.
 *
 * Step 1: search across all clients; a row click opens that client's most-recent
 * loan directly. "Import from Arive" is the bottom action row. (Creating a new
 * client lives in the + button in the app header — this picker is a finder.)
 * Step 2 (legacy fallback): pick one of the client's blueprints.
 *
 * Desktop: an anchored dropdown popover, portaled to document.body so it
 * escapes the sidebar rail's overflow clipping — styled like the Ops global
 * search dropdown. Mobile (isDesktop=false): full-height slide-in drawer.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../Icon';


const STATUS_COLORS = {
  lead: '#8b7bf0', // purple — matches SidebarSwitcher / Pipeline lead convention
  active: '#3B6BF5',
  pre_approved: '#3B6BF5',
  in_escrow: '#8b7bf0',
  closed: '#12a150',
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
  onOpenClient,
  onImportArive,
  onSelectScenario,
  onAutoCreateScenario,
  onRenameClient,
  scenarios = [],
  scenariosLoading = false,
  loading = false,
  isDesktop = true,
  T = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 = pick client, 2 = pick scenario
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [pendingBorrower, setPendingBorrower] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // ── Theme tokens ──
  const bg = T.inputBg || '#162034';
  const border = T.border || 'rgba(255,255,255,0.08)';
  const text = T.text || '#EDEDED';
  const textSec = T.textSecondary || '#A1A1A1';
  const textTer = T.textTertiary || '#666666';
  const card = T.card || '#121c30';
  const accent = '#3B6BF5';
  const hoverBg = T.tabActiveBg || 'rgba(255,255,255,0.04)';

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
  // Defensive render cap — the list is ~10-20 clients today, but never let a
  // huge roster stall the dropdown. Keyboard nav walks the visible rows.
  const visible = filtered.slice(0, 50);

  const closePicker = useCallback(() => {
    setIsOpen(false);
    setStep(1);
    setPendingBorrower(null);
    setSearch('');
    setHighlightIdx(0);
  }, []);

  // Anchor the desktop popover to the trigger. Measured once per open — the
  // popover covers the trigger, and any outside interaction closes it, so no
  // scroll/resize tracking is needed.
  const openPicker = () => {
    if (isDesktop && containerRef.current) {
      const r = containerRef.current.getBoundingClientRect();
      setAnchorRect({ top: r.top, left: r.left, width: r.width });
    }
    setIsOpen(true);
  };

  useEffect(() => { setHighlightIdx(0); }, [search, step]);

  // Outside-click-to-close only applies to the desktop popover. The popover is
  // portaled to document.body, so containerRef.contains() alone would treat
  // every click INSIDE it as outside and close before a row's click registers
  // (that was the drawer's "clicking a client does nothing" bug) — so a click
  // counts as inside when either the trigger or the popover contains it. Rows
  // additionally activate on mousedown+preventDefault, like the Ops dropdown.
  // The mobile drawer dismisses via its overlay's onClick instead.
  useEffect(() => {
    if (!isOpen || !isDesktop) return;
    const handler = (e) => {
      const inTrigger = containerRef.current && containerRef.current.contains(e.target);
      const inPopover = popoverRef.current && popoverRef.current.contains(e.target);
      if (!inTrigger && !inPopover) closePicker();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, isDesktop, closePicker]);

  useEffect(() => {
    if (isOpen && step === 1 && inputRef.current) inputRef.current.focus();
  }, [isOpen, step]);

  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightIdx]) items[highlightIdx].scrollIntoView({ block: 'nearest' });
  }, [highlightIdx]);

  // Auto-create when a client has no blueprints yet.
  useEffect(() => {
    if (step === 2 && pendingBorrower && !scenariosLoading) {
      if (scenarios.length === 0 && onAutoCreateScenario) {
        onAutoCreateScenario(pendingBorrower);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        closePicker();
      }
    }
  }, [step, pendingBorrower, scenarios, scenariosLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectBorrower = (borrower) => {
    // Clicking a client opens their most-recent loan directly — no intermediate
    // scenario-picker step. (The client's other scenarios stay reachable from the
    // sidebar's Scenarios list / scenario switcher.)
    if (onOpenClient) {
      onOpenClient(borrower);
      closePicker();
      return;
    }
    // Fallback: legacy two-step flow if no direct-open handler is wired.
    setPendingBorrower(borrower);
    setStep(2);
    setHighlightIdx(0);
    setSearch('');
    if (onSelect) onSelect(borrower); // triggers scenario loading in parent
  };

  const handleSelectScenario = (scenario) => {
    if (onSelectScenario) onSelectScenario(scenario);
    closePicker();
  };

  const handleNewBlueprint = () => {
    const target = pendingBorrower;
    if (onAutoCreateScenario && target) onAutoCreateScenario(target);
    closePicker();
  };

  const handleImportArive = () => {
    const q = search.trim();
    closePicker();
    if (onImportArive) onImportArive(q);
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

  const handleKeyDown = (e) => {
    if (step === 2) {
      if (e.key === 'Escape') { setStep(1); setPendingBorrower(null); setHighlightIdx(0); if (onSelect) onSelect(null); return; }
      const total = scenarios.length + 1;
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx((p) => (p + 1) % total); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx((p) => (p - 1 + total) % total); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIdx < scenarios.length) handleSelectScenario(scenarios[highlightIdx]);
        else handleNewBlueprint();
      }
      return;
    }
    // Last keyboard slot is the Import from Arive row (when wired).
    const total = visible.length + (onImportArive ? 1 : 0);
    if (e.key === 'ArrowDown') { e.preventDefault(); if (total) setHighlightIdx((p) => (p + 1) % total); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (total) setHighlightIdx((p) => (p - 1 + total) % total); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx < visible.length && visible[highlightIdx]) handleSelectBorrower(visible[highlightIdx]);
      else if (onImportArive && highlightIdx === visible.length) handleImportArive();
    } else if (e.key === 'Escape') {
      closePicker();
    }
  };

  // ── Body (client list / scenario list) ──
  const renderBody = () => (
    <>
      {step === 1 && (
        <>
          <div style={{
            padding: '6px 12px', fontSize: 10, fontWeight: 600, color: textTer,
            textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT,
            borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, display: 'inline-block' }} />
            {searching ? 'SEARCH RESULTS' : 'SELECT CLIENT'}
            <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {visible.map((b, i) => {
            const isHighlighted = i === highlightIdx;
            const isActive = activeBorrower?.id === b.id;
            const statusColor = STATUS_COLORS[b.status] || textTer;
            const statusLabel = STATUS_LABELS[b.status] || b.status || '';
            return (
              <div
                key={b.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelectBorrower(b); }}
                onMouseEnter={() => setHighlightIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s',
                  background: isHighlighted ? hoverBg : isActive ? `${accent}08` : 'transparent',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: text, fontFamily: FONT,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{b.name || 'Unnamed'}</div>
                  <div style={{
                    fontSize: 10.5, color: textTer, fontFamily: FONT,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{b.email || b.phone || 'No contact info'}</div>
                </div>
                {statusLabel && (
                  <span style={{
                    flexShrink: 0, fontFamily: MONO, fontSize: 9, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: 0.6,
                    color: statusColor, background: `${statusColor}16`,
                    borderRadius: 9999, padding: '2px 7px',
                  }}>{statusLabel}</span>
                )}
              </div>
            );
          })}

          {searching && filtered.length === 0 && (
            <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: textTer, fontFamily: FONT }}>
              No clients matching "{search}"
              <div style={{ marginTop: 4, fontSize: 11 }}>
                Add them with the + button in the top-right.
              </div>
            </div>
          )}

          {/* Import from Arive — build the client from an existing Arive file,
              prepopulated (numbers, property, FICO, deal team). */}
          {onImportArive && (
            <div
              onMouseDown={(e) => { e.preventDefault(); handleImportArive(); }}
              onMouseEnter={() => setHighlightIdx(visible.length)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 8, cursor: 'pointer', transition: 'background 0.1s',
                background: highlightIdx === visible.length ? hoverBg : 'transparent',
                borderTop: `1px solid ${border}`, marginTop: 4,
              }}
            >
              <Icon name="download" size={14} color={accent} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: accent, fontFamily: FONT }}>Import from Arive</div>
                <div style={{ fontSize: 10.5, color: textTer, fontFamily: FONT }}>
                  Build from an existing Arive file, prepopulated
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div style={{
            padding: '6px 12px', fontSize: 10, fontWeight: 600, color: textTer,
            textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: FONT,
            borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3B6BF5', display: 'inline-block' }} />
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
                    onClick={() => handleSelectScenario(s)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    style={{
                      padding: '10px 12px', background: isHighlighted ? hoverBg : 'transparent',
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
                  No blueprints yet. Creating one now...
                </div>
              )}

              <div
                onClick={handleNewBlueprint}
                onMouseEnter={() => setHighlightIdx(scenarios.length)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '12px',
                  background: highlightIdx === scenarios.length ? hoverBg : 'transparent',
                  cursor: 'pointer', borderTop: `1px solid ${border}`, transition: 'background 0.1s',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: `${accent}10`,
                  border: `1px dashed ${accent}30`, display: 'flex', alignItems: 'center', justifyContent: 'center',
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

  const renderOpenHeader = (roundedTop) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: bg,
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

  const renderTrigger = () => (
    <div
      onClick={openPicker}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: bg,
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
          {/* Name intentionally omitted: it already shows in the header breadcrumb and
              the highlighted RECENT row, so repeating it here was redundant. Renaming
              now lives in the Team tab. This slim chip shows the email + clear only. */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: textTer, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {activeBorrower.email || 'Client selected'}
            </div>
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
            {loading ? 'Loading...' : 'Find or add client...'}
          </span>
          <Icon name="chevron-down" size={14} color={textTer} />
        </>
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative', flex: 1,
        maxWidth: isDesktop ? 340 : 'none', minWidth: 0,
        width: isDesktop ? undefined : '100%',
      }}
    >
      {renderTrigger()}

      {/* Desktop popover — portaled to document.body and fixed at the trigger's
          measured rect, so the sidebar rail's overflowY:auto can't clip it and
          zIndex 1001 clears the UnifiedHeader (900). It opens covering the
          trigger, Ops-dropdown style. */}
      {isOpen && isDesktop && anchorRect && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed', top: anchorRect.top, left: anchorRect.left,
            width: Math.max(anchorRect.width, 320),
            maxHeight: Math.min(420, window.innerHeight - anchorRect.top - 24),
            zIndex: 1001, background: card, border: `1px solid ${border}`,
            borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}
        >
          {renderOpenHeader(false)}
          <div ref={listRef} onKeyDown={handleKeyDown} style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
            {renderBody()}
          </div>
        </div>,
        document.body
      )}

      {/* Drawer is portaled to document.body so it escapes the left sidebar's
          stacking context (.bp-sidebar is position:fixed zIndex:60, which would
          otherwise trap this drawer below the UnifiedHeader at zIndex 900 and
          let the header paint over the drawer's top-right). At the body level
          its zIndex 1000/1001 applies globally and it covers everything. */}
      {isOpen && !isDesktop && typeof document !== 'undefined' && createPortal(
        <>
          <div onClick={closePicker} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000 }} />
          <div
            style={{
              position: 'fixed', top: 0, bottom: 0, left: 0, width: 'min(86%, 360px)',
              background: card, borderRight: `1px solid ${accent}40`, borderRadius: '0 16px 16px 0',
              zIndex: 1001, display: 'flex', flexDirection: 'column', boxShadow: '8px 0 40px rgba(0,0,0,0.55)',
            }}
          >
            {renderOpenHeader(false)}
            <div ref={listRef} onKeyDown={handleKeyDown} style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
              {renderBody()}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
