import { FONT, MONO } from "../lib/fonts.js";
/**
 * PresenceBar — who else is in this Blueprint, and where.
 *
 * One chip per person: initials (their presence color, matching the field
 * outline LivePresenceLayer draws), name, and the tab + field they're on.
 * Tap a chip to jump to them; Follow keeps you with them as they move
 * (stops when you scroll, type, or tap anything yourself).
 */

import React from 'react';
import Icon from '../Icon';
import { initialsOf, presenceColor, keyLabel, TAB_LABELS } from '../lib/fieldPresence';

export default function PresenceBar({ T, onlineUsers = [], followEmail = null, onJump, onToggleFollow }) {
  if (onlineUsers.length === 0) return null;

  return (
    <div data-presence-bar="" style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '8px 12px', marginBottom: 12, borderRadius: 14,
      background: T.glass || T.card, border: `1px solid ${T.glassBorder || T.separator}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 2 }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: T.green || '#12a150',
          boxShadow: '0 0 8px rgba(18,161,80,0.5)', animation: 'bp-live-pulse 2s infinite',
        }} />
        <span style={{
          fontSize: 10, fontWeight: 600, color: T.textTertiary, textTransform: 'uppercase',
          letterSpacing: '0.15em', fontFamily: MONO,
        }}>Live</span>
      </div>

      {onlineUsers.map((user) => {
        const color = presenceColor(user.email);
        const first = (user.name || user.email || 'Someone').split(/[\s@]/)[0];
        const where = [TAB_LABELS[user.tab] || '', keyLabel(user.field)].filter(Boolean).join(' · ');
        const following = followEmail === user.email;
        return (
          <div key={user.email} style={{
            display: 'inline-flex', alignItems: 'center', gap: 2, borderRadius: 9999,
            border: `1px solid ${following ? color : T.separator}`,
            background: following ? `${color}14` : 'transparent',
          }}>
            <button onClick={() => onJump?.(user)} title={`Jump to ${first}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px 4px 4px',
              background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 9999,
              fontFamily: FONT, color: T.text, maxWidth: 260,
            }}>
              <span style={{
                width: 24, height: 24, borderRadius: '50%', background: color, color: '#fff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', flexShrink: 0,
              }}>{initialsOf(user.name, user.email)}</span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 }}>
                  {first}
                  <span style={{ fontWeight: 500, color: T.textTertiary }}> · {user.user_type === 'lo' ? 'Loan Officer' : 'Borrower'}</span>
                </span>
                {where && (
                  <span style={{
                    fontSize: 11, color: T.textSecondary, lineHeight: 1.3, maxWidth: 200,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{user.field_active ? 'In ' : ''}{where}</span>
                )}
              </span>
            </button>
            {onToggleFollow && (
              <button onClick={() => onToggleFollow(following ? null : user.email)}
                aria-pressed={following}
                title={following ? `Stop following ${first}` : `Follow ${first}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4,
                  padding: '4px 10px', borderRadius: 9999, cursor: 'pointer', fontFamily: FONT,
                  fontSize: 11.5, fontWeight: 600,
                  border: 'none', background: following ? color : `${T.blue}12`,
                  color: following ? '#fff' : T.blue,
                }}>
                <Icon name={following ? 'x' : 'eye'} size={12} />{following ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        );
      })}

      <style>{`@keyframes bp-live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
