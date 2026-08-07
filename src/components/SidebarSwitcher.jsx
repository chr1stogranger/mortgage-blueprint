import { FONT, MONO } from "../lib/fonts.js";
/**
 * SidebarSwitcher — the broker's blueprint switcher, docked in the left nav
 * below the Settings tab (LO view only).
 *
 * Layout (mirrors the Cowork left panel):
 *   1. "Find or add client" entry  — opens BorrowerPicker (anchored dropdown
 *      on desktop, drawer on mobile)
 *   2. Pinned blueprints           — starred, stable order
 *   3. Recent blueprints           — last 15 opened/edited, newest first
 *
 * Each row is one blueprint: status dot + client name + scenario name + a star
 * to pin/unpin. Clicking a row loads that blueprint via onOpen(entry).
 */

import React from 'react';
import Icon from '../Icon';
import BorrowerPicker from './BorrowerPicker';


const STATUS_COLORS = {
  lead: '#8b7bf0', // purple — matches the Pipeline tab's lead convention (T.purple)
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

export default function SidebarSwitcher({
  pinned = [],
  recents = [],
  activeBorrowerId = null,
  onOpen,
  onTogglePin,
  isPinned,
  borrowerProps = {},
  T = {},
}) {
  const [recentsOpen, setRecentsOpen] = React.useState(true);
  const accent = '#3B6BF5';
  const text = T.text || '#EDEDED';
  const textTer = T.textTertiary || '#666666';
  const separator = T.separator || 'rgba(255,255,255,0.08)';
  const hoverBg = T.tabActiveBg || 'rgba(255,255,255,0.04)';

  const sectionLabel = (icon, label, count) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px',
      fontSize: 10, fontWeight: 600, color: textTer, fontFamily: FONT,
      textTransform: 'uppercase', letterSpacing: '0.08em',
    }}>
      <Icon name={icon} size={11} color={textTer} />
      {label}
      {count != null && <span style={{ marginLeft: 'auto', fontWeight: 400 }}>{count}</span>}
    </div>
  );

  const row = (entry) => {
    const active = entry.borrowerId === activeBorrowerId;
    const statusColor = STATUS_COLORS[entry.status] || textTer;
    const statusLabel = STATUS_LABELS[entry.status] || '';
    const pinnedNow = isPinned ? isPinned(entry.borrowerId) : false;
    return (
      <div
        key={entry.borrowerId}
        onClick={() => onOpen && onOpen(entry)}
        className="bp-sidebar-item"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
          margin: '1px 6px', borderRadius: 8, cursor: 'pointer',
          background: active ? hoverBg : 'transparent',
          borderLeft: active ? `3px solid ${accent}` : '3px solid transparent',
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
        {/* One-row layout (Christo 2026-07-18): name + status badge on a single
            line — no stacked "Active" subtitle. Badge = MONO uppercase micro
            pill tinted with the status color (ACTIVE accent, LEAD purple). */}
        <div style={{
          flex: 1, minWidth: 0, fontSize: 13, fontWeight: active ? 700 : 500,
          color: active ? accent : text, fontFamily: FONT,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {entry.borrowerName || 'Client'}
        </div>
        {statusLabel && (
          <span style={{
            flexShrink: 0, fontFamily: MONO, fontSize: 9, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.6,
            color: statusColor, background: `${statusColor}16`,
            borderRadius: 9999, padding: '2px 7px',
          }}>
            {statusLabel}
          </span>
        )}
        <div
          onClick={(e) => { e.stopPropagation(); onTogglePin && onTogglePin(entry); }}
          title={pinnedNow ? 'Unpin' : 'Pin to top'}
          style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: pinnedNow ? `${accent}14` : 'transparent',
            opacity: pinnedNow ? 1 : 0.4, transition: 'all 0.12s',
          }}
        >
          <Icon name="star" size={13} color={pinnedNow ? accent : textTer} />
        </div>
      </div>
    );
  };

  const hasShelf = pinned.length > 0 || recents.length > 0;

  return (
    <div style={{ paddingTop: 2 }}>
      {/* Find / add client */}
      <div style={{ padding: '0 12px 8px' }}>
        <BorrowerPicker {...borrowerProps} T={T} />
      </div>

      {pinned.length > 0 && (
        <>
          {sectionLabel('star', 'Pinned', pinned.length)}
          {pinned.map(row)}
        </>
      )}

      {recents.length > 0 && (
        <>
          {/* Recent header doubles as a collapse toggle — the caret (where the
              count used to be) folds the recents up/down. (2026-07-08) */}
          <div
            onClick={() => setRecentsOpen((v) => !v)}
            title={recentsOpen ? 'Hide recents' : 'Show recents'}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 14px',
              fontSize: 10, fontWeight: 600, color: textTer, fontFamily: FONT,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <Icon name="clock" size={11} color={textTer} />
            Recent
            <span style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center',
              transition: 'transform 0.18s ease',
              transform: recentsOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            }}>
              <Icon name="chevron-down" size={13} color={textTer} />
            </span>
          </div>
          {/* Cap the visible recents at 5 so a long history can't push the
              "Overview: Jump to" index down the sidebar. (2026-07-08) */}
          {recentsOpen && recents.slice(0, 5).map(row)}
        </>
      )}

      {!hasShelf && (
        <div style={{
          padding: '8px 14px 4px', fontSize: 11, color: textTer,
          fontFamily: FONT, lineHeight: 1.5,
        }}>
          Open a client's blueprint and it'll show up here. Star one to pin it to the top.
        </div>
      )}
    </div>
  );
}
