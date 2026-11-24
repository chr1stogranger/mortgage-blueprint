import { FONT } from "../lib/fonts.js";
/**
 * PresenceAvatar — one person who is in this Blueprint right now.
 *
 * Their sign-in photo when presence carries one (and it loads), otherwise
 * their initials on their presence color. The ring is always their presence
 * color, so the avatar matches the field outline LivePresenceLayer draws.
 *
 * PresenceStack — the Google Sheets-style overlapping row for the header.
 */

import React, { useState } from 'react';
import { initialsOf, presenceColor, keyLabel, TAB_LABELS } from '../lib/fieldPresence';

export function whereLabel(user) {
  return [TAB_LABELS[user.tab] || '', keyLabel(user.field)].filter(Boolean).join(' · ');
}

export default function PresenceAvatar({ user, size = 24, ring = true, gap = null, title, style }) {
  const [brokenUrl, setBrokenUrl] = useState(null);
  const color = presenceColor(user.email);
  const url = user.avatar_url && user.avatar_url !== brokenUrl ? user.avatar_url : null;
  return (
    <span title={title} style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: color, color: '#fff', overflow: 'hidden',
      border: ring ? `2px solid ${color}` : 'none',
      boxShadow: gap ? `0 0 0 2px ${gap}` : 'none',
      fontFamily: FONT, fontSize: Math.round(size * 0.4), fontWeight: 700, letterSpacing: '0.04em', lineHeight: 1,
      ...style,
    }}>
      {url
        ? <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBrokenUrl(url)}
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
        : initialsOf(user.name, user.email)}
    </span>
  );
}

export function PresenceStack({ T, users = [], max = 3, size = 26, open = false, onClick }) {
  if (users.length === 0) return null;
  // Four people fit as four faces; "+N" only ever stands for two or more.
  const shown = users.length > max + 1 ? users.slice(0, max) : users;
  const extra = users.length - shown.length;
  const names = users.map(u => u.name || u.email || 'Someone');
  const gap = T.card;
  return (
    <button type="button" onClick={onClick} aria-expanded={open}
      aria-label={`${users.length === 1 ? '1 other person' : `${users.length} other people`} in this Blueprint: ${names.join(', ')}`}
      style={{
        display: 'inline-flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer',
        background: open ? `${T.blue}14` : 'transparent', border: 'none', borderRadius: 9999,
        padding: 3, margin: -3,
      }}>
      {shown.map((u, i) => {
        const where = whereLabel(u);
        return (
          <PresenceAvatar key={u.email || i} user={u} size={size} gap={gap}
            title={[u.name || u.email || 'Someone', where].filter(Boolean).join(' · ')}
            style={{ marginLeft: i === 0 ? 0 : -7, zIndex: shown.length - i, position: 'relative' }} />
        );
      })}
      {extra > 0 && (
        <span title={names.slice(shown.length).join(', ')} style={{
          width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: -7, position: 'relative',
          background: T.pillBg || T.card, color: T.textSecondary, border: `1px solid ${T.separator}`,
          boxShadow: `0 0 0 2px ${gap}`,
          fontFamily: FONT, fontSize: 10.5, fontWeight: 700, lineHeight: 1,
        }}>+{extra}</span>
      )}
    </button>
  );
}
