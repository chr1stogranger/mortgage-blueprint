# Guided Mode v2 — Stop at Every Step (Confirm Chips + Payment Breakdown Stop + Step Counter)

> Self-contained prompt for a fresh Claude session. Copy-paste ready.
> As-built record of commit `e4773e1` (2026-06-04), verified live on blueprint.realstack.app.
> Builds on the cluster-step fix (`GUIDED-CLUSTER-STEP-PROMPT.md`, commits `4b8ad2f` + `30398b8`).

## Context

RealStack Blueprint (`mortgage-blueprint` repo, `main`, live copy at `~/Desktop/Projects/mortgage-blueprint`) is a React 18 + Vite mortgage calculator on Vercel. Guided mode (`skillLevel === "guided"`) walks first-time buyers through a ladder of steps. One engine (`guideField` in `src/MortgageBlueprint.jsx`) returns the single active step; a `useEffect` smooth-scrolls to it whenever it changes. A `ClusterContinue` chip component (defined next to `GuidedNextButton`) renders only while its `stepId` is the active step and advances the guide by setting `guideTouched` key `"<stepId>-done"`.

**The problem this solves.** Value-based steps (price, income, etc.) auto-completed whenever their data was already present, so returning users with a saved scenario watched the guide silently skip Purchase Price and Income. Worse for CA: price auto-advanced at 6 digits (≥ $100k), yanking the cursor mid-typing on $1M+ prices. Christo's decision (2026-06-04): **stop at every step** — every step waits for an explicit user gesture; pre-filled data shows a confirm chip instead of skipping.

## The design — one mechanic everywhere

- **Value steps** (Transaction, FICO, ZIP, Price, Down, Assets, Income) gate on `"<stepId>-done"`, set ONLY by a `ClusterContinue` chip placed at the step. The chip renders only once the step's data is valid — fill the field, the chip fades in below it, tap to advance. Pre-filled data = chip is there immediately. **Nothing ever auto-advances on typing**, so 7-digit CA prices are safe with no debounce.
- **Tap steps** keep their existing gestures: Get Today's Rates button, Modules chip, Loan-structure pills chip, Costs "Got it — continue", section touches for Qualify/Tax/Equity.
- **New step 9 — Payment Breakdown** (between Loan-structure pills and Cash to Close): pulses the Payment Breakdown card; the Continue chip is **gated behind expanding the carets** — Tax (`propTaxExpanded`, prop) and PMI (`pmiExpanded`, local state) — with PMI only required when `calc.monthlyMI > 0` and Tax only when `includeEscrow`. Until explored, a hint renders: "Tap the ▾ next to Tax and PMI above to see how they're calculated."
- **Step 10 — Cash to Close**: the pre-existing `costs` step in `CostsContent.jsx` (anchor `data-field="costs"`, chip label "Got it — continue") is unchanged.
- **Step counter**: `guidedStep` ladder computed in `MortgageBlueprint.jsx`, rendered as a slim NON-floating strip at the top of `OverviewTab.jsx`: 3px progress bar + `STEP X OF N · LABEL` in JetBrains Mono. Purchase = 16 steps, +1 with REO, refi drops Price/Down.

## Files changed (6)

### 1. `src/MortgageBlueprint.jsx`

**guideField ladder** — value steps now also require their `-done` key:

```jsx
if (isRefi === null || !guideTouched.has("transaction-type-done")) return "transaction-type";
if (creditScore < 300 || !guideTouched.has("fico-input-done")) return "fico-input";
if (!propertyZip || propertyZip.length < 5 || !guideTouched.has("zip-code-done")) return "zip-code";
if (!guideTouched.has("modules-done")) return "modules";
if (!isRefi && (salesPrice < 100000 || !guideTouched.has("calc-price-done"))) return "calc-price";
if (!isRefi && !guideTouched.has("calc-down-done")) return "calc-down";
if (!guideTouched.has("get-rates")) return "get-rates";
if (!guideTouched.has("calc-pills-done")) return "calc-pills";
// 9. Payment Breakdown — chip gated by caret expansion (gate lives in CalculatorContent)
if (!guideTouched.has("payment-breakdown-done")) return "payment-breakdown";
if (!guideTouched.has("costs-done")) return "costs";
if (!assets || assets.length === 0) return "add-asset";
if (!guideTouched.has("assets-section-done")) return "assets-section";   // replaces asset-value/asset-closing
if (!guideTouched.has("owns-properties-toggle")) return "owns-properties-toggle";
if (ownsProperties && !guideTouched.has("reo-section")) return "reo-section";
if (!incomes.some(i => i.amount > 0 || i.py1 > 0) || !guideTouched.has("income-section-done")) return "income-section";
if (!guideTouched.has("qualify-section")) return "qualify-section";
if (!guideTouched.has("tax-filing")) return "tax-filing";
if (!guideTouched.has("amort-section")) return "amort-section";
```

**`guidedStep`** — added right after `const isPulse = ...`. Ordered ladder of `{ id, label, on }` (filter by scenario: `calc-price`/`calc-down` on `!isRefi`, `reo` on `ownsProperties`), a `groupOf()` mapping multi-anchor steps (`add-asset`/`assets-section` → assets, `owns-properties-toggle` → debts, etc.), returns `{ current, total, label, done }`; `null` for non-guided.

**Prop wiring (3-place rule — see `feedback_overview_props_object` memory):** `guidedStep` added to the `<OverviewTab {...{ ... }}>` block; `ClusterContinue` added to the Income and Assets tab spreads (it was already in Setup/Calc spreads and the OverviewTab block).

### 2. `src/content/SetupContent.jsx`

- Transaction buttons: removed the `setTimeout` scroll-to-FICO stopgap → plain `onClick={() => setIsRefi(val)}`. Chip after the grid: `{isRefi !== null && <ClusterContinue stepId="transaction-type" />}`.
- FICO `onBlur`: removed the scroll-to-modules stopgap, kept only the `< 300 → 300` clamp. Chip after the meets-min indicator: `{creditScore >= 300 && <ClusterContinue stepId="fico-input" />}`.
- ZIP card: `{propertyZip && propertyZip.length === 5 && <ClusterContinue stepId="zip-code" />}` before `</Card>`.

### 3. `src/content/CalculatorContent.jsx`

- Price (left cell of the price/down Card): `{!isRefi && salesPrice >= 100000 && ClusterContinue && <ClusterContinue stepId="calc-price" />}` after the subtitle slot.
- Down: removed the `onBlur` `markTouched("calc-down")`; chip after the down subtitle: `{ClusterContinue && <ClusterContinue stepId="calc-down" />}`.
- Payment Breakdown card wrapped in the new anchor: `<div data-field="payment-breakdown" className={isPulse && isPulse("payment-breakdown")} style={{ borderRadius: 14, transition: "all 0.3s", marginBottom: 16 }}>` (inner card `marginBottom` → 0). After the card, inside the wrapper:

```jsx
{(() => {
  const breakdownExplored = (!includeEscrow || propTaxExpanded) && ((calc.monthlyMI || 0) === 0 || pmiExpanded);
  return (<>
    {isPulse && isPulse("payment-breakdown") && !breakdownExplored && (
      <div style={{ marginTop: 10, fontSize: 12, color: T.textSecondary, fontFamily: FONT, textAlign: "center" }}>
        Tap the ▾ next to Tax{(calc.monthlyMI || 0) > 0 ? " and PMI" : ""} above to see how they're calculated
      </div>
    )}
    {breakdownExplored && ClusterContinue && <ClusterContinue stepId="payment-breakdown" />}
  </>);
})()}
```

### 4. `src/content/AssetsContent.jsx`

`ClusterContinue` added to destructure + `devCheckProps` list. Chip after the `data-field="assets-section"` anchor: `{ClusterContinue && <ClusterContinue stepId="assets-section" />}` (no value condition — guideField only reaches it once an asset exists). Old `asset-value`/`asset-closing` blur markers left as harmless no-ops.

### 5. `src/content/IncomeContent.jsx`

`ClusterContinue` added to destructure + `devCheckProps` list. Chip at the top of the `data-field="income-section"` block: `{incomes.some(i => i.amount > 0 || i.py1 > 0) && ClusterContinue && <ClusterContinue stepId="income-section" />}`.

### 6. `src/OverviewTab.jsx`

Progress strip between the header block and the Quick Start section:

```jsx
{isGuided && props.guidedStep && (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 2px" }}>
    <div style={{ flex: 1, height: 3, background: T.separator, borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.round((props.guidedStep.current / props.guidedStep.total) * 100)}%`, background: props.guidedStep.done ? T.green : T.blue, borderRadius: 2, transition: "width 0.4s ease" }} />
    </div>
    <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.5, color: T.textTertiary, whiteSpace: "nowrap" }}>
      {props.guidedStep.done ? "ALL STEPS DONE" : `STEP ${props.guidedStep.current} OF ${props.guidedStep.total}`} · {props.guidedStep.label.toUpperCase()}
    </div>
  </div>
)}
```

## Edge cases

1. **Pre-filled scenarios stop at every step** — chips are immediate; nothing silently skips. This is the point.
2. **CA $1M+ prices** — no auto-advance on digit count; chip waits for the tap.
3. **Refi** — Price/Down steps and chips are `!isRefi`-guarded; ladder total drops to 14.
4. **Escrow off / no PMI** — the Payment Breakdown gate only requires carets that exist (`!includeEscrow` skips Tax; `monthlyMI === 0` skips PMI).
5. **guideTouched is in-memory** — every reload replays all stops (per Christo's explicit choice). Future option: persist to LS for resume.
6. **3-place prop rule** — any new prop consumed by Setup/Calc/Assets/Income content MUST be added to the `{tab===...}` spread(s) AND the `<OverviewTab {...{}}>` block, or guided users crash with React #130 on Overview.

## Testing checklist (verified live 2026-06-04)

1. Guided + saved scenario, reload → strip reads `STEP 1 OF 16 · TRANSACTION`, transaction block pulses with chip.
2. Chips advance 1→2→3→4 (Transaction, FICO, ZIP, Modules); strip increments.
3. **Step 5 PRICE stops with chip even with $1M pre-filled.**
4. Step 6 Down chip → Step 7 advances by tapping "Get Today's Rates" → Step 8 pills chip.
5. **Step 9 Payment Breakdown: no chip + caret hint; expanding the Tax ▾ and PMI ▾ reveals the chip; tapping it advances.**
6. Step 10 Cash to Close pulses with "Got it — continue".
7. Income (step 13 of the run) stops with chip even when income is saved.
8. Standard tier: no chips, no strip, no pulses. Console clean, no React #130.

## Build & deploy

1. `npm run build` (if `dist/.DS_Store` EPERM, build with `--outDir /tmp/x --emptyOutDir`).
2. Commit: `feat(guided): stop-at-every-step flow — confirm chips on all value steps, new Payment Breakdown stop (caret-gated), Step X of N progress strip`
3. Push `main` → Vercel. Clear PWA cache on phone before testing. If committing from a sandboxed session, clear stale `.git/HEAD.lock` / `.git/index.lock` afterward (explicit filenames, no globs).
