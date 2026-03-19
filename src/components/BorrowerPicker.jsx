/**
 * BorrowerPicker — Searchable dropdown for selecting borrowers from the Ops client list.
 *
 * Features:
 *   - Type-ahead search (filters by name, email, phone)
 *   - Shows borrower status badge, email, and scenario count
 *   - "+ New Borrower" option at the bottom
 *   - Keyboard navigation (arrow keys, enter, escape)
 *   - Click outside to close
 *   - Shows active borrower with clear button
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

export default function BorrowerPicker({
  borrowers = [],
  activeBorrower = null,
  onSelect,
  onCreateNew,
  loading = false,
  T = {},
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(0);
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
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightIdx]) {
      items[highlightIdx].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIdx]);

  const handleKeyDown = useCallback((e) => {
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
        // New Borrower
        handleCreateNew();
      } else if (filtered[highlightIdx]) {
        handleSelect(filtered[highlightIdx]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch('');
    }
  }, [filtered, highlightIdx]);

  const handleSelect = (borrower) => {
    setIsOpen(false);
    setSearch('');
    if (onSelect) onSelect(borrower);
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    setSearch('');
    if (onCreateNew) onCreateNew(search.trim());
  };

  const handleClear = (e) => {
    e.stopPropagation();
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
    <div ref={containerRef} style={{ position: 'relative', flex: 1, maxWidth: 320, minWidth: 180 }}>
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
              {/* Active borrower display */}
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
              {/* Clear button */}
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
                {loading ? 'Loading...' : 'Search borrowers...'}
              </span>
            </>
          )}
        </div>
      ) : (
        /* Search input (open state) */
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          background: bg,
          border: `1px solid ${accent}`,
          borderRadius: '10px 10px 0 0',
          boxShadow: `0 0 0 2px ${accent}20`,
        }}>
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
        </div>
      )}

      {/* Dropdown list */}
      {isOpen && (
        <div
          ref={listRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0, right: 0,
            background: card,
            border: `1px solid ${accent}40`,
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
            maxHeight: 320,
            overflowY: 'auto',
            zIndex: 200,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          {/* Results count */}
          <div style={{
            padding: '6px 12px',
            fontSize: 10, fontWeight: 600,
            color: textTer, textTransform: 'uppercase',
            letterSpacing: '0.06em', fontFamily: MONO,
            borderBottom: `1px solid ${border}`,
          }}>
            {filtered.length} borrower{filtered.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </div>

          {/* Borrower rows */}
          {filtered.map((b, i) => {
            const isHighlighted = i === highlightIdx;
            const isActive = activeBorrower?.id === b.id;
            const statusColor = STATUS_COLORS[b.status] || textTer;
            const statusLabel = STATUS_LABELS[b.status] || b.status || '';

            return (
              <div
                key={b.id}
                onClick={() => handleSelect(b)}
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
                {/* Avatar */}
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

                {/* Info */}
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

                {/* Active indicator */}
                {isActive && (
                  <span style={{ fontSize: 12, color: accent, flexShrink: 0 }}>
                    <Icon name="check" size={14} />
                  </span>
                )}
              </div>
            );
          })}

          {/* No results */}
          {filtered.length === 0 && search && (
            <div style={{
              padding: '16px 12px', textAlign: 'center',
              fontSize: 12, color: textTer, fontFamily: FONT,
            }}>
              No borrowers matching "{search}"
            </div>
          )}

          {/* New Borrower option */}
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
                New Borrower
              </div>
              <div style={{ fontSize: 10, color: textTer, fontFamily: FONT }}>
                {search ? `Create "${search}"` : 'Add a new client'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
