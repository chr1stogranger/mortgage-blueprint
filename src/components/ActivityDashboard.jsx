/**
 * ActivityDashboard — LO-facing view of borrower activity intelligence.
 *
 * Shows daily digest of which borrowers are actively using their Blueprints,
 * what fields they're adjusting, and insights to share with agents.
 *
 * Can be embedded in Ops or shown as a panel in Blueprint.
 */

import React, { useState, useEffect, useCallback } from 'react';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";
const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';

const FIELD_LABELS = {
  salesPrice: 'Purchase Price', purchasePrice: 'Purchase Price',
  downPayment: 'Down Payment', downPct: 'Down %',
  interestRate: 'Rate', rate: 'Rate',
  loanTerm: 'Term', creditScore: 'Credit Score',
  hoa: 'HOA', annualIns: 'Insurance',
  city: 'City', propertyState: 'State',
};

function fmt(v) {
  if (!v || isNaN(v)) return '$0';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(v);
}

export default function ActivityDashboard({ days = 7, compact = false }) {
  const [digests, setDigests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDigests = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('bp_token');
      const res = await fetch(
        `${API_BASE}/api/collab?resource=digest&days=${days}&unsent=false`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      if (!res.ok) throw new Error('Could not load activity');
      const data = await res.json();
      setDigests(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetchDigests(); }, [fetchDigests]);

  // Compute activity feed
  const computeDigest = useCallback(async () => {
    try {
      const token = localStorage.getItem('bp_token');
      await fetch(`${API_BASE}/api/collab?resource=digest&action=compute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ date: new Date().toISOString().split('T')[0] }),
      });
      await fetchDigests();
    } catch (e) {
      setError(e.message);
    }
  }, [fetchDigests]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#666666', fontFamily: FONT }}>
        Loading activity...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#EF4444', fontFamily: FONT, fontSize: 13 }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{
      background: '#0F0F0F',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: compact ? 12 : 20,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 14,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#A1A1A1',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: MONO,
        }}>BORROWER ACTIVITY</div>

        <button
          onClick={computeDigest}
          style={{
            padding: '4px 10px',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: 6, color: '#6366F1',
            fontSize: 10, fontWeight: 600,
            cursor: 'pointer', fontFamily: FONT,
          }}
        >Refresh</button>
      </div>

      {digests.length === 0 ? (
        <div style={{
          padding: '30px 20px', textAlign: 'center',
          color: '#666666', fontSize: 13, fontFamily: FONT,
        }}>
          No borrower activity in the past {days} day{days !== 1 ? 's' : ''}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {digests.map((d, i) => (
            <ActivityCard key={d.id || i} digest={d} compact={compact} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityCard({ digest, compact }) {
  const [expanded, setExpanded] = useState(false);

  const intensityColor = digest.total_edits > 10 ? '#EF4444'
    : digest.total_edits > 5 ? '#F59E0B'
    : '#10B981';

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        padding: compact ? '10px 12px' : '14px 16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 600,
            color: '#EDEDED', fontFamily: FONT,
          }}>
            {digest.borrower_name || 'Unknown Borrower'}
          </div>
          <div style={{
            fontSize: 11, color: '#A1A1A1',
            marginTop: 2, fontFamily: FONT,
          }}>
            {digest.scenario_name || 'Scenario'}
            {digest.scenario_type === 'refi' ? ' (Refi)' : ''}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: 18, fontWeight: 700,
            color: intensityColor, fontFamily: MONO,
          }}>
            {digest.total_edits}
          </div>
          <div style={{
            fontSize: 9, color: '#666666',
            textTransform: 'uppercase',
            fontFamily: MONO,
          }}>edits</div>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{
        display: 'flex', gap: 12, marginTop: 10,
        flexWrap: 'wrap',
      }}>
        {digest.session_count > 0 && (
          <Stat label="Sessions" value={digest.session_count} />
        )}
        {digest.most_adjusted_field && (
          <Stat
            label="Most adjusted"
            value={FIELD_LABELS[digest.most_adjusted_field] || digest.most_adjusted_field}
          />
        )}
        {digest.fields_changed?.length > 0 && (
          <Stat label="Fields touched" value={digest.fields_changed.length} />
        )}
      </div>

      {/* Expanded: Insights */}
      {expanded && (
        <div style={{
          marginTop: 12, padding: '12px',
          background: '#050505', borderRadius: 8,
        }}>
          {/* Price range explored */}
          {digest.price_range_explored && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 10, color: '#666666',
                textTransform: 'uppercase', marginBottom: 4,
                fontFamily: MONO,
              }}>PRICE RANGE EXPLORED</div>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: '#EDEDED', fontFamily: MONO,
              }}>
                {fmt(digest.price_range_explored.min)} — {fmt(digest.price_range_explored.max)}
              </div>
            </div>
          )}

          {/* Down payment range */}
          {digest.down_payment_range && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 10, color: '#666666',
                textTransform: 'uppercase', marginBottom: 4,
                fontFamily: MONO,
              }}>DOWN PAYMENT RANGE</div>
              <div style={{
                fontSize: 14, fontWeight: 600,
                color: '#EDEDED', fontFamily: MONO,
              }}>
                {fmt(digest.down_payment_range.min)} — {fmt(digest.down_payment_range.max)}
              </div>
            </div>
          )}

          {/* Fields changed list */}
          {digest.fields_changed?.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, color: '#666666',
                textTransform: 'uppercase', marginBottom: 4,
                fontFamily: MONO,
              }}>FIELDS CHANGED</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {digest.fields_changed.map(f => (
                  <span key={f} style={{
                    fontSize: 10, padding: '3px 7px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: 4, color: '#818CF8',
                    fontFamily: FONT,
                  }}>
                    {FIELD_LABELS[f] || f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Agent tip */}
          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'rgba(99, 102, 241, 0.04)',
            borderRadius: 6, borderLeft: '3px solid #6366F1',
          }}>
            <div style={{
              fontSize: 10, color: '#6366F1',
              fontWeight: 600, textTransform: 'uppercase',
              marginBottom: 4, fontFamily: MONO,
            }}>AGENT TIP</div>
            <div style={{
              fontSize: 12, color: '#A1A1A1',
              lineHeight: 1.5, fontFamily: FONT,
            }}>
              {generateAgentTip(digest)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{
        fontSize: 9, color: '#666666',
        textTransform: 'uppercase',
        fontFamily: MONO,
      }}>{label}</div>
      <div style={{
        fontSize: 12, fontWeight: 600,
        color: '#A1A1A1', fontFamily: FONT,
      }}>{value}</div>
    </div>
  );
}

/**
 * Generate a human-readable insight for the agent.
 */
function generateAgentTip(digest) {
  const name = digest.borrower_name?.split(' ')[0] || 'Your borrower';

  if (digest.price_range_explored) {
    const range = digest.price_range_explored;
    if (range.max - range.min > 100000) {
      return `${name} explored a wide price range (${fmt(range.min)}–${fmt(range.max)}). They may be flexible on budget — great time to show options across that range.`;
    }
    return `${name} is focused on the ${fmt(range.min)}–${fmt(range.max)} range. Actively running numbers.`;
  }

  if (digest.most_adjusted_field === 'downPayment' || digest.most_adjusted_field === 'downPct') {
    return `${name} adjusted down payment ${digest.total_edits} times. They're testing what they can put down — might be a good time to discuss DPA programs.`;
  }

  if (digest.total_edits > 10) {
    return `${name} made ${digest.total_edits} changes across ${digest.session_count || 1} session(s). High engagement — they're serious.`;
  }

  return `${name} is actively reviewing their Blueprint. Good time for a check-in.`;
}
