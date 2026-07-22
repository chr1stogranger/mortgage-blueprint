import { FONT } from "../lib/fonts.js";
import React from "react";

/* ═══════════════════════════════════════════════════════════════
   SCHEDULE E INPUTS
   The controls that drive the Schedule E pro forma. Lives in the
   sticky left rail of the Tax Savings section (investment), and in
   the Schedule E disclosure for an owner-occupied rental.

   Every figure it produces is computed in the calc memo in
   MortgageBlueprint.jsx — this component only edits state. Don't
   recompute depreciation or the apportionment here.
   ═══════════════════════════════════════════════════════════════ */

// Compact $ input. Comma-formats at rest, raw while focused.
function MoneyInput({ value, onChange, T, placeholder = "0" }) {
  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState(null);
  const comma = (n) => String(n ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, "");
  const shown = focused
    ? (draft !== null ? draft : (value ? String(value) : ""))
    : (value ? `$${Number(value).toLocaleString()}` : "");
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      value={shown}
      onFocus={() => { setFocused(true); setDraft(null); }}
      onBlur={() => {
        setFocused(false);
        if (draft !== null) { const n = parseFloat(draft.replace(/,/g, "")); onChange(isNaN(n) ? 0 : n); setDraft(null); }
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        if (/^\d*\.?\d*$/.test(raw)) { setDraft(raw); const n = parseFloat(raw); if (!isNaN(n)) onChange(n); }
      }}
      style={{
        background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 8,
        padding: "7px 10px", color: T.text, fontSize: 13, fontWeight: 600,
        fontFamily: FONT, outline: "none", textAlign: "right", width: "100%",
      }}
    />
  );
}

// −/+ percent stepper, matching the appreciation control in NetPaymentLadder.
function PctStepper({ value, onChange, T, min = 0, max = 100, step = 1, suffix = "%" }) {
  const clamp = (n) => Math.max(min, Math.min(max, Number(n.toFixed(1))));
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2, background: T.pillBg, borderRadius: 99, padding: "2px 4px" }}>
      <button onClick={() => onChange(clamp((value || 0) - step))} aria-label="Decrease"
        style={{ background: "none", border: "none", color: T.textSecondary, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "2px 8px", fontFamily: FONT, lineHeight: 1 }}>−</button>
      <span style={{ fontSize: 13, fontWeight: 700, color: T.green, minWidth: 44, textAlign: "center", fontFamily: FONT }}>{value || 0}{suffix}</span>
      <button onClick={() => onChange(clamp((value || 0) + step))} aria-label="Increase"
        style={{ background: "none", border: "none", color: T.textSecondary, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "2px 8px", fontFamily: FONT, lineHeight: 1 }}>+</button>
    </div>
  );
}

function Row({ label, hint, children, T }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: `1px solid ${T.separator}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>{label}</span>
        <div style={{ flexShrink: 0 }}>{children}</div>
      </div>
      {hint && <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 4, lineHeight: 1.5, fontFamily: FONT }}>{hint}</div>}
    </div>
  );
}

export default function SchedEInputs({
  T, fmt, calc,
  assessedLand, setAssessedLand,
  assessedImprovements, setAssessedImprovements,
  rentalSharePctOverride, setRentalSharePctOverride,
  schedEVacancyPct, setSchedEVacancyPct,
  schedEMgmtPct, setSchedEMgmtPct,
  isOwnerOccupied = false,
}) {
  const improvementPct = calc.improvementPct ?? 0.5;
  const usingDefaultSplit = (calc.assessedTotal || 0) <= 0;
  const sharePct = calc.rentalSharePct ?? 100;
  const usingDefaultShare = rentalSharePctOverride === null;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.blue, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: FONT, marginBottom: 10 }}>
        Schedule E Inputs
      </div>

      {/* Owner-occupied only: how much of the building is actually rented. This
          drives the Schedule A / Schedule E split AND the depreciable portion. */}
      {isOwnerOccupied && (
        <Row
          T={T}
          label="Rented share of property"
          hint={usingDefaultShare
            ? `Defaulted from unit count. Property tax, insurance and mortgage interest split here — ${sharePct}% to Schedule E, ${100 - sharePct}% itemized on Schedule A. Adjust if the units aren't equal size (an ADU rarely is).`
            : `Overriding the ${calc.defaultRentalSharePct}% unit-count default. ${sharePct}% of tax, insurance and interest goes to Schedule E; ${100 - sharePct}% stays on Schedule A.`}
        >
          <PctStepper value={sharePct} onChange={setRentalSharePctOverride} T={T} min={0} max={100} step={5} />
        </Row>
      )}

      {/* Land / improvements off the tax bill — the depreciation allocation. */}
      <div style={{ padding: "12px 0 4px" }}>
        <div style={{ fontSize: 13, color: T.text, fontWeight: 600, fontFamily: FONT }}>Assessed values (from the tax bill)</div>
        <div style={{ fontSize: 11, color: T.textTertiary, marginTop: 3, lineHeight: 1.5, fontFamily: FONT }}>
          Land is never depreciable. Enter both figures from the county assessment — only their <em>ratio</em> is used, applied to the purchase price.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 10, borderBottom: `1px solid ${T.separator}` }}>
        <div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4, fontFamily: FONT }}>Land</div>
          <MoneyInput value={assessedLand} onChange={setAssessedLand} T={T} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.textSecondary, marginBottom: 4, fontFamily: FONT }}>Improvements</div>
          <MoneyInput value={assessedImprovements} onChange={setAssessedImprovements} T={T} />
        </div>
      </div>

      {/* What the ratio actually produced. Always states whether it's real or
          the 50/50 placeholder — a depreciation figure that looks authoritative
          but came from a default would be the easiest number here to misread. */}
      <div style={{
        marginTop: 10, padding: "10px 12px", borderRadius: 10,
        background: usingDefaultSplit ? `${T.orange}0E` : `${T.green}0E`,
        border: `1px solid ${usingDefaultSplit ? T.orange : T.green}28`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>Improvement ratio</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: usingDefaultSplit ? T.orange : T.green, fontFamily: FONT }}>
            {Math.round(improvementPct * 100)}%
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>Depreciable basis</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT }}>{fmt(calc.depreciableBasis || 0)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: T.textSecondary, fontFamily: FONT }}>Annual depreciation <span style={{ color: T.textTertiary }}>÷ 27.5</span></span>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT }}>{fmt(calc.schedEDepreciation || 0)}</span>
        </div>
        <div style={{ fontSize: 11, color: usingDefaultSplit ? T.orange : T.textTertiary, marginTop: 8, lineHeight: 1.55, fontFamily: FONT, fontWeight: usingDefaultSplit ? 600 : 400 }}>
          {usingDefaultSplit
            ? "Placeholder 50/50 split — no assessed values entered yet. Pull the real numbers off the tax bill before relying on this depreciation figure."
            : `From the assessment: ${fmt(assessedImprovements)} improvements ÷ ${fmt(calc.assessedTotal)} total.${sharePct < 100 ? ` Depreciating only the ${sharePct}% rented share.` : ""}`}
        </div>
      </div>

      {/* Operating assumptions — were hardcoded at 5% / 10% before. */}
      <div style={{ marginTop: 14 }}>
        <Row T={T} label="Vacancy" hint="Share of gross rent lost to turnover.">
          <PctStepper value={schedEVacancyPct} onChange={setSchedEVacancyPct} T={T} min={0} max={50} step={1} />
        </Row>
        <Row T={T} label="Mgmt & maintenance" hint="Percent of effective gross income.">
          <PctStepper value={schedEMgmtPct} onChange={setSchedEMgmtPct} T={T} min={0} max={50} step={1} />
        </Row>
      </div>

      <div style={{ fontSize: 11, color: T.textTertiary, lineHeight: 1.6, marginTop: 12, fontFamily: FONT }}>
        Straight-line over 27.5 years, the residential rental schedule. Depreciation is recaptured on sale — this models the holding period only. Not tax advice.
      </div>
    </div>
  );
}
