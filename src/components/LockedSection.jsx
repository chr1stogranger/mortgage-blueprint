import { FONT } from "../lib/fonts.js";
/**
 * LockedSection: the borrower side of the LO's "Document verification" locks
 * (Share → Collaboration → Lock). When the LO locks Income, Debts, Assets or
 * Credit Score after checking documents, the borrower sees the section with a
 * "Verified" note and can't change it. `<fieldset disabled>` turns off every
 * native input/select/button inside; pointer-events covers div-based pills.
 *
 * The share-sync endpoint (Ops api/collab.js SECTION_FIELDS) also reverts
 * locked fields on every borrower save, so this is the visible half of a
 * rule the server already enforces.
 */
export default function LockedSection({ locked, T, label, children }) {
  if (!locked) return children;
  return (
    <div>
      <div role="note" style={{
        display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px", padding: "9px 12px",
        borderRadius: 12, background: T.pillBg, color: T.textSecondary, fontSize: 12.5, lineHeight: 1.5, fontFamily: FONT,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none" }}>
          <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        <span><strong>{label} verified by your loan officer.</strong> It's locked to match your documents. Ask them if something changed.</span>
      </div>
      <fieldset disabled aria-disabled="true" style={{ border: 0, margin: 0, padding: 0, minWidth: 0, pointerEvents: "none", opacity: 0.8 }}>
        {children}
      </fieldset>
    </div>
  );
}
