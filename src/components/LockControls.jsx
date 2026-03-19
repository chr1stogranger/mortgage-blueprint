/**
 * LockControls — LO-facing UI to lock/unlock verified sections.
 *
 * Shows a lock icon + status for each lockable section (Income, Debts, etc.)
 * LO can toggle lock after verifying documents.
 * Borrowers see a read-only view showing which fields are locked.
 */

import React, { useState, useCallback } from 'react';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

const API_BASE = import.meta.env.VITE_API_BASE || 'https://ops.realstack.app';

export default function LockControls({
  scenarioId,
  lockedFields = {},
  userType = 'lo',
  lockableSections = {},
  onLockChange = null,
}) {
  const [toggling, setToggling] = useState(null);
  const [error, setError] = useState('');

  const handleToggleLock = useCallback(async (sectionKey) => {
    if (userType !== 'lo') return;
    setToggling(sectionKey);
    setError('');

    const currentlyLocked = !!lockedFields[sectionKey];
    const newAction = currentlyLocked ? 'unlocked' : 'locked';

    try {
      const token = localStorage.getItem('bp_token');
      const res = await fetch(`${API_BASE}/api/collab?resource=locks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scenario_id: scenarioId,
          field_key: sectionKey,
          action: newAction,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update lock');
      }

      const data = await res.json();
      if (onLockChange) {
        onLockChange(data.locked_fields);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setToggling(null);
    }
  }, [scenarioId, lockedFields, userType, onLockChange]);

  const sections = Object.entries(lockableSections);
  if (sections.length === 0) return null;

  return (
    <div style={{
      background: '#0F0F0F',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#A1A1A1',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontFamily: MONO,
        }}>
          {userType === 'lo' ? 'DOCUMENT VERIFICATION' : 'VERIFIED SECTIONS'}
        </div>
        {userType === 'lo' && (
          <span style={{ fontSize: 10, color: '#666666', fontFamily: FONT }}>
            Lock after verifying docs
          </span>
        )}
      </div>

      {/* Section rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sections.map(([key, section]) => {
          const isLocked = !!lockedFields[key];
          const isToggling = toggling === key;

          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: isLocked ? 'rgba(16, 185, 129, 0.06)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isLocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.04)'}`,
                borderRadius: 8,
                transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Lock icon */}
                <div style={{
                  width: 28, height: 28,
                  borderRadius: 7,
                  background: isLocked ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  transition: 'all 0.2s',
                }}>
                  {isLocked ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                    </svg>
                  )}
                </div>

                <div>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#EDEDED',
                    fontFamily: FONT,
                  }}>
                    {section.label}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: isLocked ? '#10B981' : '#666666',
                    fontFamily: FONT,
                    marginTop: 1,
                  }}>
                    {isLocked ? 'Verified & locked' : section.description}
                  </div>
                </div>
              </div>

              {/* Toggle button (LO only) */}
              {userType === 'lo' && (
                <button
                  onClick={() => handleToggleLock(key)}
                  disabled={isToggling}
                  style={{
                    padding: '6px 12px',
                    background: isLocked ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    border: `1px solid ${isLocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                    borderRadius: 6,
                    color: isLocked ? '#EF4444' : '#10B981',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: isToggling ? 'default' : 'pointer',
                    opacity: isToggling ? 0.5 : 1,
                    fontFamily: FONT,
                    transition: 'all 0.15s',
                  }}
                >
                  {isToggling ? '...' : isLocked ? 'Unlock' : 'Lock'}
                </button>
              )}

              {/* Status badge (borrower view) */}
              {userType === 'borrower' && isLocked && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#10B981',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontFamily: MONO,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  VERIFIED
                </span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: '#EF4444',
          fontFamily: FONT,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
