/**
 * VersionTimeline — Visual history of all changes to a Blueprint scenario.
 *
 * Shows a timeline of edits by both LO and borrower, with:
 *   - Who made the change
 *   - What fields changed (with old → new values)
 *   - Bookmarked versions
 *   - Undo button for most recent change
 *   - Revert to any previous version
 */

import React, { useState, useMemo } from 'react';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const USER_COLORS = { lo: '#6366F1', borrower: '#10B981' };

const FIELD_LABELS = {
  salesPrice: 'Purchase Price', purchasePrice: 'Purchase Price',
  downPayment: 'Down Payment', downPct: 'Down %',
  interestRate: 'Rate', rate: 'Rate',
  loanTerm: 'Term', term: 'Term',
  creditScore: 'Credit Score', ficoScore: 'Credit Score',
  loanType: 'Loan Type', annualIncome: 'Income',
  hoa: 'HOA', annualIns: 'Insurance',
  city: 'City', propertyState: 'State',
};

function formatValue(val) {
  if (val == null || val === '') return '—';
  if (typeof val === 'number') {
    if (val > 1000) return '$' + val.toLocaleString();
    return val.toString();
  }
  return String(val);
}

function timeAgo(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function VersionTimeline({
  history = [],
  bookmarks = [],
  onUndo = null,
  onRevertTo = null,
  onCreateBookmark = null,
  userType = 'lo',
  getChangeSummary = null,
  maxVisible = 20,
}) {
  const [expanded, setExpanded] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);

  const visibleHistory = showAll ? history : history.slice(0, maxVisible);

  // Group changes by date
  const grouped = useMemo(() => {
    const groups = {};
    for (const change of visibleHistory) {
      const date = new Date(change.created_at).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(change);
    }
    return groups;
  }, [visibleHistory]);

  if (history.length === 0) {
    return (
      <div style={{
        background: '#0F0F0F',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 20,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 13, color: '#666666', fontFamily: FONT }}>
          No changes recorded yet
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: '#0F0F0F',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#A1A1A1',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontFamily: MONO,
        }}>VERSION HISTORY</div>

        <div style={{ display: 'flex', gap: 6 }}>
          {/* Undo button */}
          {history.length > 0 && onUndo && userType === 'lo' && (
            <button
              onClick={onUndo}
              style={{
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6,
                color: '#A1A1A1',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              <span style={{ marginRight: 4 }}>&#8617;</span> Undo
            </button>
          )}

          {/* Bookmark button */}
          {userType === 'lo' && onCreateBookmark && (
            <button
              onClick={() => setShowBookmarkInput(!showBookmarkInput)}
              style={{
                padding: '4px 10px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: 6,
                color: '#6366F1',
                fontSize: 11,
                cursor: 'pointer',
                fontFamily: FONT,
              }}
            >
              <span style={{ marginRight: 4 }}>&#9733;</span> Bookmark
            </button>
          )}
        </div>
      </div>

      {/* Bookmark input */}
      {showBookmarkInput && (
        <div style={{
          display: 'flex', gap: 6, marginBottom: 12,
          padding: 10, background: 'rgba(99, 102, 241, 0.04)',
          borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.1)',
        }}>
          <input
            value={bookmarkLabel}
            onChange={e => setBookmarkLabel(e.target.value)}
            placeholder="Version name (e.g. Pre-Approval Locked)"
            style={{
              flex: 1, padding: '6px 10px',
              background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, color: '#EDEDED', fontSize: 12,
              fontFamily: FONT, outline: 'none',
            }}
          />
          <button
            onClick={() => {
              if (bookmarkLabel.trim()) {
                onCreateBookmark(bookmarkLabel.trim());
                setBookmarkLabel('');
                setShowBookmarkInput(false);
              }
            }}
            style={{
              padding: '6px 12px',
              background: '#6366F1', border: 'none',
              borderRadius: 6, color: '#fff', fontSize: 12,
              fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
            }}
          >Save</button>
        </div>
      )}

      {/* Timeline */}
      {Object.entries(grouped).map(([date, changes]) => (
        <div key={date} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, color: '#666666', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: 6, fontFamily: MONO,
          }}>{date}</div>

          {changes.map((change, i) => {
            const color = USER_COLORS[change.changed_by] || '#666666';
            const isExpanded = expanded === change.id;
            const diffs = change.field_diffs || {};
            const diffCount = Object.keys(diffs).length;
            const isBookmark = change.is_bookmark;

            return (
              <div
                key={change.id || i}
                onClick={() => setExpanded(isExpanded ? null : change.id)}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                  transition: 'background 0.15s',
                  borderLeft: isBookmark ? '3px solid #6366F1' : '3px solid transparent',
                  marginLeft: -3,
                }}
              >
                {/* Timeline dot */}
                <div style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  background: isBookmark ? '#6366F1' : color,
                  marginTop: 4,
                  flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Summary line */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: '#EDEDED', fontFamily: FONT }}>
                      {isBookmark && change.version_label ? (
                        <span style={{ color: '#6366F1', fontWeight: 600 }}>
                          {change.version_label}
                        </span>
                      ) : (
                        <>
                          <span style={{ color, fontWeight: 600 }}>
                            {change.changed_by_name?.split(' ')[0] || change.changed_by === 'lo' ? 'LO' : 'Borrower'}
                          </span>
                          {' '}
                          <span style={{ color: '#A1A1A1' }}>
                            {getChangeSummary ? getChangeSummary(change) : `${diffCount} field${diffCount !== 1 ? 's' : ''}`}
                          </span>
                        </>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, color: '#666666', fontFamily: MONO,
                      flexShrink: 0, marginLeft: 8,
                    }}>
                      {timeAgo(change.created_at)}
                    </span>
                  </div>

                  {/* Expanded: field diffs */}
                  {isExpanded && diffCount > 0 && (
                    <div style={{ marginTop: 8 }}>
                      {Object.entries(diffs).slice(0, 10).map(([field, diff]) => (
                        <div key={field} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '4px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          fontSize: 11,
                        }}>
                          <span style={{ color: '#666666', minWidth: 80, fontFamily: FONT }}>
                            {FIELD_LABELS[field] || field}
                          </span>
                          <span style={{ color: '#EF4444', fontFamily: MONO, textDecoration: 'line-through', opacity: 0.6 }}>
                            {formatValue(diff.old)}
                          </span>
                          <span style={{ color: '#666666' }}>&#8594;</span>
                          <span style={{ color: '#10B981', fontFamily: MONO, fontWeight: 600 }}>
                            {formatValue(diff.new)}
                          </span>
                        </div>
                      ))}

                      {/* Revert button */}
                      {userType === 'lo' && onRevertTo && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRevertTo(change.id);
                          }}
                          style={{
                            marginTop: 8, padding: '4px 10px',
                            background: 'rgba(245, 158, 11, 0.08)',
                            border: '1px solid rgba(245, 158, 11, 0.2)',
                            borderRadius: 5, color: '#F59E0B',
                            fontSize: 10, fontWeight: 600,
                            cursor: 'pointer', fontFamily: FONT,
                          }}
                        >Revert to this version</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Show more */}
      {!showAll && history.length > maxVisible && (
        <button
          onClick={() => setShowAll(true)}
          style={{
            width: '100%', padding: 8,
            background: 'none', border: 'none',
            color: '#6366F1', fontSize: 12,
            cursor: 'pointer', fontFamily: FONT,
          }}
        >Show all {history.length} changes</button>
      )}
    </div>
  );
}
