import { FONT } from "../lib/fonts.js";
/**
 * SharedBlueprints — "Shared with you" in the left nav.
 *
 * Every Blueprint a loan officer shared with the signed-in email, as a live
 * view of the LO's file (never a copy, so it can't go stale). Opening a share
 * link is what saves it here: Ops lists whatever the email is on the guest
 * list of (`collab?resource=account&action=shared`), so there is no "keep a
 * copy" step. A row opens the share link itself.
 */
import Icon from '../Icon';

/** The ones to list: everything shared with this email except the one already open. */
function otherShared(items, currentToken) {
  return (Array.isArray(items) ? items : []).filter((b) => b && b.share_token && b.share_token !== currentToken);
}

export default function SharedBlueprints({ items = [], currentToken = null, T = {}, onNavigate, dividerAbove = false }) {
  const list = otherShared(items, currentToken);
  if (!list.length) return null;
  const textTer = T.textTertiary || '#8A8A8A';
  const open = (b) => {
    if (onNavigate) onNavigate();
    window.location.assign(`${window.location.origin}/?share=${encodeURIComponent(b.share_token)}`);
  };
  const divider = <div style={{ height: 1, background: T.separator, margin: dividerAbove ? '6px 8px' : '8px 12px 2px' }} />;
  return (
    <>
      {dividerAbove && divider}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: dividerAbove ? '6px 12px 8px' : '2px 18px 6px' }}>
        <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, letterSpacing: 0.2, color: textTer }}>Shared with you</span>
        <span style={{ marginLeft: 'auto', fontFamily: FONT, fontSize: 11, fontWeight: 500, color: textTer }}>{list.length}</span>
      </div>
      {list.map((b) => {
        const n = Array.isArray(b.scenarios) ? b.scenarios.length : 0;
        const sub = [b.lo_name ? `From ${b.lo_name}` : '', n ? `${n} scenario${n === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');
        return (
          <div key={b.borrower_id || b.share_token} className="bp-sidebar-item" role="button" tabIndex={0}
            title="Opens the live Blueprint your loan officer shared"
            onClick={() => open(b)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(b); } }}
            style={{ padding: '7px 8px 7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, margin: dividerAbove ? 0 : '1px 6px', minHeight: dividerAbove ? 44 : undefined, boxSizing: 'border-box', borderRadius: 8, borderLeft: '3px solid transparent' }}>
            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.blue || '#3B6BF5' }}><Icon name="users" size={15} /></span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.name || 'Blueprint'}</span>
              {sub && <span style={{ fontFamily: FONT, fontSize: 11, color: textTer, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>}
            </span>
            <Icon name="chevron-right" size={13} color={textTer} />
          </div>
        );
      })}
      {!dividerAbove && divider}
    </>
  );
}
