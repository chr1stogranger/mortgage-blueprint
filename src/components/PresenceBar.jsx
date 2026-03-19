/**
 * PresenceBar — Shows who else is currently viewing/editing this Blueprint.
 *
 * Displays avatars with colored rings (indigo for LO, green for borrower),
 * name tooltips, and optionally which field they're editing.
 *
 * Sits at the top of the Blueprint, just below the header.
 */

import React, { useState } from 'react';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// Color coding by user type
const USER_COLORS = {
  lo: '#6366F1',       // Indigo for LO
  borrower: '#10B981', // Green for borrower
};

const FIELD_LABELS = {
  salesPrice: 'Purchase Price',
  purchasePrice: 'Purchase Price',
  downPayment: 'Down Payment',
  downPct: 'Down %',
  interestRate: 'Rate',
  rate: 'Rate',
  loanTerm: 'Term',
  creditScore: 'Credit Score',
  annualIncome: 'Income',
  hoa: 'HOA',
  annualIns: 'Insurance',
  propTax: 'Property Tax',
  city: 'City',
};

export default function PresenceBar({ onlineUsers = [], fieldFocus = {} }) {
  const [hoveredUser, setHoveredUser] = useState(null);

  if (onlineUsers.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      background: 'rgba(99, 102, 241, 0.06)',
      borderRadius: 10,
      marginBottom: 12,
      border: '1px solid rgba(99, 102, 241, 0.12)',
    }}>
      {/* Live indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginRight: 4,
      }}>
        <div style={{
          width: 6, height: 6,
          borderRadius: '50%',
          background: '#10B981',
          boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
          animation: 'pulse 2s infinite',
        }} />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#A1A1A1',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontFamily: MONO,
        }}>LIVE</span>
      </div>

      {/* User avatars */}
      <div style={{ display: 'flex', gap: 4 }}>
        {onlineUsers.map((user, i) => {
          const color = USER_COLORS[user.user_type] || '#6366F1';
          const initial = (user.name || user.email || '?')[0].toUpperCase();
          const isEditing = fieldFocus[user.email];

          return (
            <div
              key={user.email || i}
              onMouseEnter={() => setHoveredUser(user.email)}
              onMouseLeave={() => setHoveredUser(null)}
              style={{ position: 'relative' }}
            >
              {/* Avatar circle */}
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: user.avatar_url ? 'transparent' : `${color}20`,
                border: `2px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                transform: hoveredUser === user.email ? 'scale(1.1)' : 'scale(1)',
              }}>
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.name || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color,
                    fontFamily: FONT,
                  }}>{initial}</span>
                )}
              </div>

              {/* Editing indicator dot */}
              {isEditing && (
                <div style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  border: '2px solid #0F0F0F',
                  animation: 'pulse 1.5s infinite',
                }} />
              )}

              {/* Tooltip */}
              {hoveredUser === user.email && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginTop: 6,
                  padding: '6px 10px',
                  background: '#1A1A1A',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8,
                  whiteSpace: 'nowrap',
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}>
                  <div style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#EDEDED',
                    fontFamily: FONT,
                  }}>
                    {user.name || user.email?.split('@')[0] || 'Anonymous'}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: color,
                    fontFamily: MONO,
                    marginTop: 2,
                  }}>
                    {user.user_type === 'lo' ? 'Loan Officer' : 'Borrower'}
                  </div>
                  {isEditing && (
                    <div style={{
                      fontSize: 10,
                      color: '#A1A1A1',
                      marginTop: 3,
                      fontFamily: FONT,
                    }}>
                      Editing: {FIELD_LABELS[isEditing] || isEditing}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary text */}
      <span style={{
        fontSize: 12,
        color: '#A1A1A1',
        fontFamily: FONT,
        marginLeft: 4,
      }}>
        {onlineUsers.length === 1
          ? `${onlineUsers[0].name?.split(' ')[0] || 'Someone'} is viewing`
          : `${onlineUsers.length} people viewing`
        }
      </span>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
