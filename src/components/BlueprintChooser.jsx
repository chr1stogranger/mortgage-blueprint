import { FONT } from "../lib/fonts.js";
/**
 * BlueprintChooser — "Your Blueprints", for someone on two or more.
 *
 * A shared Blueprint works like a shared Google Sheet: signing in opens the
 * one shared with your email. With several (your own file and a parent's, a
 * co-borrower on two loans) a guess can open the wrong one, so after an
 * invite or on a device that has not opened one yet we ask (needsChoice in
 * lib/myBlueprint.js). A returning visit skips this and goes back to the last
 * one; "Shared with you" in the menu switches.
 *
 * Covers the whole screen, so it can sit over the sign-in gate while the gate
 * waits for the answer.
 */
import Icon from '../Icon';

// Light, like the sign-in screen it follows (BorrowerAuthGate).
const C = {
  bg: '#f4f9fc', card: '#FFFFFF', border: 'rgba(16,27,46,0.12)',
  accent: '#3B6BF5', text: '#171717', textSecondary: '#4B5563', textTertiary: '#6B7280',
};

function updatedLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `Updated ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function BlueprintChooser({ items = [], email = '', onPick }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000, overflowY: 'auto',
      background: C.bg, fontFamily: FONT,
    }}>
      <div style={{
        position: 'fixed', inset: 0, opacity: 0.5, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(59,107,245,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(59,107,245,0.07) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div style={{
        position: 'relative', maxWidth: 480, margin: '0 auto', boxSizing: 'border-box',
        padding: 'max(48px, 10vh) 16px calc(32px + env(safe-area-inset-bottom, 0px))',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
            <span style={{ color: C.text }}>Real</span><span style={{ color: C.accent }}>Stack</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: '-0.03em', margin: '22px 0 8px' }}>
            Your Blueprints
          </h1>
          <div style={{ fontSize: 14, color: C.textSecondary, lineHeight: 1.55 }}>
            {items.length} Blueprints are shared with you. Pick the one to open. You can switch any time from the menu.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((b) => {
            const n = Array.isArray(b.scenarios) ? b.scenarios.length : 0;
            const sub = [
              b.lo_name ? `From ${b.lo_name}` : '',
              n ? `${n.toLocaleString()} scenario${n === 1 ? '' : 's'}` : '',
              updatedLabel(b.updated_at),
            ].filter(Boolean).join(' · ');
            return (
              <button key={b.borrower_id || b.share_token} type="button" className="bp-chooser-row"
                onClick={() => onPick?.(b.share_token)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
                  padding: '16px 16px 16px 18px', minHeight: 72, boxSizing: 'border-box',
                  background: C.card, border: `1px solid ${C.border}`, borderRadius: 20,
                  boxShadow: '0 1px 5px rgba(16,27,46,0.06)', cursor: 'pointer', fontFamily: FONT,
                }}>
                <span style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: 12,
                  background: 'rgba(59,107,245,0.1)', color: C.accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name="home" size={19} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 600, color: C.text, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.name || 'Blueprint'}
                  </span>
                  {sub && (
                    <span style={{ display: 'block', fontSize: 13, color: C.textTertiary, marginTop: 3, lineHeight: 1.4 }}>
                      {sub}
                    </span>
                  )}
                </span>
                <Icon name="chevron-right" size={16} color={C.textTertiary} />
              </button>
            );
          })}
        </div>

        {email && (
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 12, color: C.textTertiary }}>
            Signed in as {email}
          </div>
        )}
      </div>
      <style>{`
        .bp-chooser-row { transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s; }
        .bp-chooser-row:hover { border-color: rgba(59,107,245,0.55) !important; box-shadow: 0 6px 20px -8px rgba(59,107,245,0.45) !important; }
        .bp-chooser-row:active { transform: scale(0.99); }
        .bp-chooser-row:focus-visible { outline: 2px solid #3B6BF5; outline-offset: 2px; }
      `}</style>
    </div>
  );
}
