/**
 * SidebarSwitcher — the broker's blueprint switcher, docked in the left nav
 * below the Settings tab (LO view only).
 *
 * Layout (mirrors the Cowork left panel):
 *   1. "Find or add client" entry  — opens BorrowerPicker (drawer mode)
 *   2. Pinned blueprints           — starred, stable order
 *   3. Recent blueprints           — last 15 opened/edited, newest first
 *
 * Each row is one blueprint: status dot + client name + scenario name + a star
 * to pin/unpin. Clicking a row loads that blueprint via onOpen(entry).
 */

import React from 'react';
import Icon from '../Icon';
import BorrowerPicker from './BorrowerPicker';

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const STATUS_COLORS = {
  lead: '#F59E0B',
  active: '#3B82F6',
  pre_approved: '#6366F1',
  in_escrow: '#8B5CF6',
  closed: '#10B981',
  dead: '#666666',
};

export default function SidebarSwitcher({
  pinned = [],
  recents = [],
  activeScenarioId = null,
  onOpen,
  onTogglePin,
  isPinned,
  borrowerProps = {},
  T = {},
}) {
  const accent = '#6366F1';
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
    const active = entry.scenarioId === activeScenarioId;
    const statusColor = STATUS_COLORS[entry.status] || textTer;
    const pinnedNow = isPinned ? isPinned(entry.scenarioId) : false;
    const typeLabel = entry.type === 'refi' ? 'Refi' : 'Purchase';
    return (
      <div
        key={entry.scenarioId}
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: active ? 700 : 500, color: active ? accent : text,
            fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.borrowerName || 'Client'}
          </div>
          <div style={{
            fontSize: 10, color: textTer, fontFamily: FONT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {(entry.scenarioName || 'Scenario')}{' · '}{typeLabel}
          </div>
        </div>
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
    <div style={{ borderTop: `1px solid ${separator}`, marginTop: 8, paddingTop: 8 }}>
      {/* Find / add client */}
      <div style={{ padding: '0 12px 8px' }}>
        <BorrowerPicker {...borrowerProps} isDesktop={false} T={T} />
      </div>

      {pinned.length > 0 && (
        <>
          {sectionLabel('star', 'Pinned', pinned.length)}
          {pinned.map(row)}
        </>
      )}

      {recents.length > 0 && (
        <>
          {sectionLabel('clock', 'Recent', recents.length)}
          {recents.map(row)}
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
