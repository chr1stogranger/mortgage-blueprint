/**
 * BorrowerPicker — Two-step searchable dropdown for selecting borrowers + scenarios.
 *
 * Step 1: Search/select a client from the full Ops client list
 * Step 2: See that client's Blueprints (scenarios) — pick one to load, or auto-create
 *
 * Features:
 *   - Type-ahead search (filters by name, email, phone)
 *   - Shows borrower status badge, email
 *   - "+ New Borrower" option
 *   - Keyboard navigation (arrow keys, enter, escape)
 *   - Click outside to close
 *   - Step 2: scenario list with auto-create
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '../Icon';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

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
  T = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1); // 1 = pick client, 2 = pick scenario
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [pendingBorrower, setPendingBorrower] = useState(null); // Selected in step 1, scenarios loading
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Filter borrowers by search
  const filtered = search.trim()
    ? borrowers.filter(b => {
        const q = search.toLowerCase();
        return (
          (b.name || '').toLowerCase().includes(q) ||
          (b.email || '').toLowerCase().includes(q) ||
          (b.phone || '').toLowerCase().includes(q)
        );
      })
    : borrowers;

  // Reset highlight when search changes
  useEffect(() => { setHighlightIdx(0); }, [search]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
        setStep(1);
        setPendingBorrower(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && step === 1 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, step]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightIdx]) {
      items[highlightIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  // When scenarios load for pendingBorrower, auto-advance
  useEffect(() => {
    if (step === 2 && pendingBorrower && !scenariosLoading) {
      // If only 0 scenarios, auto-create
      if (scenarios.length === 0 && onAutoCreateScenario) {
        onAutoCreateScenario(pendingBorrower);
        setIsOpen(false);
        setStep(1);
        setPendingBorrower(null);
        setSearch('');
      }
    }
  }, [step, pendingBorrower, scenarios, scenariosLoading]);

  const handleKeyDown = useCallback((e) => {
    if (step === 2) {
      // In scenario step, escape goes back to step 1
      if (e.key === 'Escape') {
        setStep(1);
        setPendingBorrower(null);
        setHighlightIdx(0);
        return;
      }
      const total = scenarios.length + 1; // +1 for "New Blueprint"
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(prev => (prev + 1) % total); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(prev => (prev - 1 + total) % total); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightIdx < scenarios.length) {
          handleSelectScenario(scenarios[highlightIdx]);
        } else {
          handleNewBlueprint();
        }
      }
      return;
    }

    const total = filtered.length + 1; // +1 for "New Borrower"
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => (prev + 1) % total);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => (prev - 1 + total) % total);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx === filtered.length) {
        handleCreateNew();
      } else if (filtered[highlightIdx]) {
        handleSelectBorrower(filtered[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
      setStep(1);
    }
  }, [filtered, highlightIdx, step, scenarios]);

  const handleSelectBorrower = (borrower) => {
    // Step 1 → Step 2: select client, load their scenarios
    setPendingBorrower(borrower);
    setStep(2);
    setHighlightIdx(0);
    setSearch('');
    if (onSelect) onSelect(borrower); // This triggers scenario loading in parent
  };

  const handleSelectScenario = (scenario) => {
    setIsOpen(false);
    setStep(1);
    setPendingBorrower(null);
    setSearch('');
    if (onSelectScenario) onSelectScenario(scenario);
  };

  const handleNewBlueprint = () => {
    setIsOpen(false);
    setStep(1);
    setSearch('');
    if (onAutoCreateScenario && pendingBorrower) {
      onAutoCreateScenario(pendingBorrower);
    }
    setPendingBorrower(null);
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    setSearch('');
    setStep(1);
    if (onCreateNew) onCreateNew(search.trim());
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

  const bg = T.inputBg || '#1A1A1A';
  const border = T.border || 'rgba(255,255,255,0.08)';
  const text = T.text || '#EDEDED';
  const textSec = T.textSecondary || '#A1A1A1';
  const textTer = T.textTertiary || '#666666';
  const card = T.card || '#0F0F0F';
  const accent = '#6366F1';
  const hoverBg = T.tabActiveBg || 'rgba(255,255,255,0.04)';

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, maxWidth: 340, minWidth: 180 }}>
      {/* Trigger button */}
      {!isOpen ? (
        <div
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 10px',
            background: bg,
            border: `1px solid ${activeBorrower ? accent + '40' : border}`,
            borderRadius: 10,
            cursor: 'pointer',
            transition: 'all 0.15s',
            minHeight: 34,
          }}
        >
          {activeBorrower ? (
            <>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: `${accent}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>
                  {(activeBorrower.name || '?')[0].toUpperCase()}
                </span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: text,
                  fontFamily: FONT, overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {activeBorrower.name}
                </div>
                {activeBorrower.email && (
                  <div style={{
                    fontSize: 10, color: textTer,
                    fontFamily: FONT, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {activeBorrower.email}
                  </div>
                )}
              </div>
              <div
                onClick={handleClear}
                style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, fontSize: 12, color: textTer,
                }}
              >&times;</div>
            </>
          ) : (
            <>
              <Icon name="search" size={14} color={textTer} />
              <span style={{ fontSize: 12, color: textTer, fontFamily: FONT }}>
                {loading ? 'Loading...' : 'Search clients...'}
              </span>
            </>
          )}
        </div>
      ) : (
        /* Search input / Step header */
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          background: bg,
          border: `1px solid ${accent}`,
          borderRadius: '10px 10px 0 0',
          boxShadow: `0 0 0 2px ${accent}20`,
        }}>
          {step === 2 ? (
            <>
              <div
                onClick={handleBack}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <Icon name="arrow-left" size={14} color={accent} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: text, fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pendingBorrower?.name || 'Client'}
                </div>
                <div style={{ fontSize: 9, color: textTer, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  SELECT BLUEPRINT
                </div>
              </div>
            </>
          ) : (
            <>
              <Icon name="search" size={14} color={accent} />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name, email, or phone..."
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  color: text, fontSize: 13, fontFamily: FONT,
                  outline: 'none', padding: 0,
                }}
              />
              {search && (
                <span
                  onClick={() => setSearch('')}
                  style={{ cursor: 'pointer', color: textTer, fontSize: 14 }}
                >&times;</span>
              )}
            </>
          )}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          onKeyDown={handleKeyDown}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0, right: 0,
            background: card,
            border: `1px solid ${accent}40`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            maxHeight: 380,
            overflowY: 'auto',
            zIndex: 200,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* ── STEP 1: Client list ── */}
          {step === 1 && (
            <>
              <div style={{
                padding: '6px 12px',
                fontSize: 10, fontWeight: 600,
                color: textTer, textTransform: 'uppercase',
                letterSpacing: '0.06em', fontFamily: MONO,
                borderBottom: `1px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: accent, display: 'inline-block' }} />
                STEP 1: SELECT CLIENT
                <span style={{ marginLeft: 'auto', fontWeight: 400 }}>
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filtered.map((b, i) => {
                const isHighlighted = i === highlightIdx;
                const isActive = activeBorrower?.id === b.id;
                const statusColor = STATUS_COLORS[b.status] || textTer;
                const statusLabel = STATUS_LABELS[b.status] || b.status || '';

                return (
                  <div
                    key={b.id}
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
                          fontSize: 13, fontWeight: 600, color: text,
                          fontFamily: FONT, overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {b.name || 'Unnamed'}
                        </span>
                        {statusLabel && (
                          <span style={{
                            fontSize: 9, fontWeight: 600,
                            color: statusColor, background: `${statusColor}12`,
                            padding: '1px 5px', borderRadius: 4,
                            fontFamily: MONO, textTransform: 'uppercase',
                            letterSpacing: '0.04em', flexShrink: 0,
                          }}>
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11, color: textTer,
                        fontFamily: FONT, marginTop: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {b.email || b.phone || 'No contact info'}
                      </div>
                    </div>
                    {/* Arrow to indicate step 2 */}
                    <Icon name="chevron-right" size={14} color={textTer} />
                  </div>
                );
              })}

              {filtered.length === 0 && search && (
                <div style={{
                  padding: '16px 12px', textAlign: 'center',
                  fontSize: 12, color: textTer, fontFamily: FONT,
                }}>
                  No clients matching "{search}"
                </div>
              )}

              <div
                onClick={handleCreateNew}
                onMouseEnter={() => setHighlightIdx(filtered.length)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 12px',
                  background: highlightIdx === filtered.length ? hoverBg : 'transparent',
                  cursor: 'pointer',
                  borderTop: `1px solid ${border}`,
                  transition: 'background 0.1s',
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: accent, fontFamily: FONT }}>
                    New Client
                  </div>
                  <div style={{ fontSize: 10, color: textTer, fontFamily: FONT }}>
                    {search ? `Create "${search}"` : 'Add a new client'}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: Scenario list ── */}
          {step === 2 && (
            <>
              <div style={{
                padding: '6px 12px',
                fontSize: 10, fontWeight: 600,
                color: textTer, textTransform: 'uppercase',
                letterSpacing: '0.06em', fontFamily: MONO,
                borderBottom: `1px solid ${border}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3B82F6', display: 'inline-block' }} />
                STEP 2: SELECT BLUEPRINT
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
                          padding: '10px 12px',
                          background: isHighlighted ? hoverBg : 'transparent',
                          cursor: 'pointer',
                          borderBottom: `1px solid ${border}`,
                          transition: 'background 0.1s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Icon name="file-text" size={14} color={accent} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: text, fontFamily: FONT }}>
                            {name}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 600,
                            color: textTer, background: 'rgba(255,255,255,0.04)',
                            padding: '1px 5px', borderRadius: 4,
                            fontFamily: MONO, textTransform: 'uppercase',
                          }}>
                            {type}
                          </span>
                          {s.created_by === 'borrower' && (
                            <span style={{
                              fontSize: 9, fontWeight: 600,
                              color: accent, background: `${accent}12`,
                              padding: '1px 5px', borderRadius: 4,
                              fontFamily: MONO,
                            }}>
                              BORROWER
                            </span>
                          )}
                        </div>
                        {/* Quick metrics */}
                        {(cs.loanAmount || cs.rate || cs.monthlyPI) && (
                          <div style={{ display: 'flex', gap: 12, marginLeft: 22, fontSize: 11, fontFamily: MONO }}>
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

                  {/* New Blueprint option */}
                  <div
                    onClick={handleNewBlueprint}
                    onMouseEnter={() => setHighlightIdx(scenarios.length)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '12px 12px',
                      background: highlightIdx === scenarios.length ? hoverBg : 'transparent',
                      cursor: 'pointer',
                      borderTop: `1px solid ${border}`,
                      transition: 'background 0.1s',
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: accent, fontFamily: FONT }}>
                        New Blueprint
                      </div>
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
        </div>
      )}
    </div>
  );
}
