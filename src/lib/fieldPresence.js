/**
 * fieldPresence — name a control so another person's screen can find it.
 *
 * Live co-editing shows WHERE the other person is (Ops-style outline +
 * initials) at the field level, not as a mouse cursor: the phone and desktop
 * layouts differ, so screen coordinates would point at the wrong thing, but
 * both render the same controls in the same DOM order.
 *
 * A key is "<label>#<n>": the control's visible label (FieldLabel's
 * <label for>, aria-label, button text, placeholder) plus which occurrence of
 * that label it is inside the presence root. No per-input wiring needed.
 */

export const PRESENCE_ROOT_ATTR = 'data-presence-root';

const CONTROL_SEL = 'input:not([type=hidden]),select,textarea,button,[role="button"],[role="switch"],[role="tab"],[role="checkbox"]';

const clean = (t) => String(t || '').replace(/\s+/g, ' ').replace(/\*/g, '').trim().slice(0, 60);

const isVisible = (el) => el.getClientRects().length > 0;

// Visible label text of a <label>, without the required "*" or InfoTip "i".
function labelElText(l) {
  const first = [...l.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
  return clean(first ? first.textContent : l.textContent);
}

// First non-empty rendered line of a node's text ("Rate *" → "Rate").
const firstLine = (node) => clean(String(node?.innerText ?? node?.textContent ?? '').split('\n').find(l => l.trim()) || '');
// Worth naming a field after: has a word in it, and isn't a bare
// number/amount or a Yes/No toggle token.
const meaningful = (t) => !!t && t.length >= 3 && /[a-z]{2}/i.test(t)
  && !/^(yes|no)$/i.test(t) && !/^[\d$%.,\s-]+$/.test(t);

// For a control with no label of its own: the nearest text BEFORE it — its
// previous siblings first, then its parent's previous siblings, and so on
// ("Down" for the down-payment box, "First-Time Homebuyer?" for its No).
function contextFor(el, own) {
  let node = el;
  for (let i = 0; i < 6 && node && node.parentElement; i++) {
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      const t = firstLine(sib);
      if (meaningful(t) && t !== own) return t;
    }
    node = node.parentElement;
  }
  return '';
}

export function labelFor(el) {
  const aria = el.getAttribute('aria-label');
  if (aria) return clean(aria);
  if (el.id) {
    try {
      const l = el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) { const t = labelElText(l); if (t) return t; }
    } catch { /* odd id — fall through */ }
  }
  if (el.matches('button,[role="button"],[role="switch"],[role="tab"],[role="checkbox"]')) {
    const own = firstLine(el);
    // Short/numeric buttons (Yes/No/$/%/750) get context: "First-Time Homebuyer? › No"
    if (!meaningful(own)) {
      const ctx = contextFor(el, own);
      if (ctx) return `${ctx} › ${own || '•'}`;
    }
    return own || 'button';
  }
  const ph = el.getAttribute('placeholder');
  if (ph) return clean(ph);
  const wrap = el.closest('label');
  if (wrap) { const t = labelElText(wrap); if (t) return t; }
  return contextFor(el, '') || el.tagName.toLowerCase();
}

export function presenceRoot(doc = document) {
  return doc.querySelector(`[${PRESENCE_ROOT_ATTR}]`);
}

export function controlFor(target, root) {
  if (!target || !root || typeof target.closest !== 'function') return null;
  const el = target.closest(CONTROL_SEL);
  return el && root.contains(el) ? el : null;
}

/** "<label>#<n>" for a control inside root, or null. */
export function keyFor(el, root) {
  if (!el || !root) return null;
  const label = labelFor(el);
  let n = 0;
  for (const c of root.querySelectorAll(CONTROL_SEL)) {
    if (c === el) return `${label}#${n}`;
    if (isVisible(c) && labelFor(c) === label) n++;
  }
  return null;
}

/** The control a key names, or null (e.g. the section is collapsed here). */
export function findByKey(root, key) {
  if (!root || !key) return null;
  const i = key.lastIndexOf('#');
  const label = key.slice(0, i);
  const want = Number(key.slice(i + 1)) || 0;
  let n = 0;
  for (const c of root.querySelectorAll(CONTROL_SEL)) {
    if (!isVisible(c) || labelFor(c) !== label) continue;
    if (n === want) return c;
    n++;
  }
  return null;
}

// Tab id → the name people see (PresenceBar's "where they are").
export const TAB_LABELS = {
  overview: 'Overview', calc: 'Payment', costs: 'Costs', income: 'Income', assets: 'Assets',
  debts: 'Debts', reo: 'REO', qualify: 'Qualify', tax: 'Tax Savings', amort: 'Amortization',
  team: 'Team', compare: 'Compare', summary: 'Share', workspace: 'Workspace', learn: 'Learn',
  settings: 'Settings', setup: 'Setup', refi: 'Refi', refi3: 'Refi', invest: 'Investment',
  rentvbuy: 'Rent vs Buy', sell: 'Selling', prop19: 'Prop 19', pipeline: 'Pipeline',
};

/** Human label from a key ("Purchase Price#0" → "Purchase Price"). */
export const keyLabel = (key) => (key ? key.slice(0, key.lastIndexOf('#')) : '');

/** The box to outline: Inp draws its border on the input's wrapper div. */
export function outlineBoxFor(el) {
  const p = el.parentElement;
  if (el.tagName === 'INPUT' && p && p.tagName === 'DIV') {
    const r = p.getBoundingClientRect();
    if (r.height > 0 && r.height < 90) return p;
  }
  return el;
}

export function initialsOf(name, email) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return String(email || '?').slice(0, 2).toUpperCase();
}

// Stable, distinct color per person (same palette as Ops presence).
const PALETTE = ['#3B6BF5', '#38c6c6', '#12a150', '#8b7bf0', '#EC4899', '#d98a0b'];
export function presenceColor(email) {
  let h = 0;
  const s = String(email || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
