// src/lib/RefiSummaryPdf.jsx — Refinance Savings Summary, one page.
//
// A vector-PDF rendition of the spreadsheet Christo has closed refis with for
// years (screenshot 2026-07-22): Option 1 (monthly cash flow, current/new/
// delta), Option 2 (long-term difference), Cash to Close Summary, Net Cash
// Out. Optional page 2 is the Initial Fees Worksheet — the same page the
// standalone fees PDF renders (FeesWorksheetPage).
//
// Contract matches FeesWorksheetPdf: pure module, every input via props,
// loaded only through a dynamic import so react-pdf stays out of the main
// bundle. Fonts are registered by FeesWorksheetPdf.jsx on import.

import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { FeesWorksheetPage } from "./FeesWorksheetPdf.jsx";

const usd = (v) =>
  v == null || !isFinite(v) || isNaN(v)
    ? "$0"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
const usd2 = (v) =>
  v == null || !isFinite(v) || isNaN(v)
    ? "$0.00"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const signed2 = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + usd2(Math.abs(v || 0));

const INDIGO = "#3B6BF5";
const INK = "#171717";
const SUB = "#525252";
const MUTED = "#737373";
const HAIR = "#E8E8E8";
const GREEN = "#12a150";
const ORANGE = "#d97706";
const RED = "#e5484d";
const TINT = "#EFF3FE";
const GREEN_TINT = "#E8F7EE";

const s = StyleSheet.create({
  page: { paddingTop: 14, paddingBottom: 12, paddingHorizontal: 34, fontFamily: "Inter", fontSize: 9, color: INK, backgroundColor: "#FFFFFF" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  loName: { fontFamily: "Inter-Bold", fontSize: 15 },
  loMeta: { fontSize: 8.5, color: SUB, marginTop: 2 },
  hTitle: { fontFamily: "Inter-Bold", fontSize: 17, color: INDIGO, textAlign: "right" },
  hSub: { fontSize: 8.5, color: SUB, textAlign: "right", marginTop: 2 },
  rule: { height: 2, backgroundColor: INDIGO, marginTop: 7, marginBottom: 6 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: MUTED, marginBottom: 8 },

  secHead: { backgroundColor: TINT, borderRadius: 4, paddingVertical: 3.5, paddingHorizontal: 8, marginTop: 6, marginBottom: 3 },
  secHeadText: { fontFamily: "Inter-Bold", fontSize: 9.5, color: INDIGO, letterSpacing: 0.4, textTransform: "uppercase" },

  // Option 1 table
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HAIR, paddingVertical: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: HAIR, paddingVertical: 2 },
  trTotal: { flexDirection: "row", backgroundColor: GREEN_TINT, borderRadius: 3, paddingVertical: 4, marginTop: 2 },
  cLabel: { width: "31%", fontSize: 8.5, color: SUB, paddingLeft: 2 },
  cNum: { width: "23%", fontSize: 8.5, textAlign: "right", paddingRight: 4 },
  bold: { fontFamily: "Inter-Bold" },

  // Simple label:value line rows
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: HAIR },
  lineLabel: { fontSize: 8.5, color: SUB },
  lineValue: { fontSize: 8.5, textAlign: "right" },
  lineTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 6, backgroundColor: GREEN_TINT, borderRadius: 3, marginTop: 2 },

  note: { fontSize: 7, color: MUTED, marginTop: 2 },

  // Cost of Waiting table — compact so page 1 stays a single page
  cwLabel: { width: "24%", fontSize: 7.5, color: SUB, paddingLeft: 2 },
  cwNum: { width: "19%", fontSize: 7.5, textAlign: "right", paddingRight: 4 },
  twoCol: { flexDirection: "row", gap: 14, marginTop: 2 },
  col: { flex: 1 },

  // In-flow (NOT absolutely positioned): an absolute footer overlapped the
  // content once the Cost of Waiting table filled the page (Christo 7.24).
  foot: { marginTop: 10 },
  footText: { fontSize: 6.5, color: MUTED, lineHeight: 1.3 },
  footGen: { fontSize: 6.5, color: MUTED, marginTop: 2 },
});

const monthName = (m) => ["January","February","March","April","May","June","July","August","September","October","November","December"][((m - 1) % 12 + 12) % 12];

export function RefiSummaryDoc(p) {
  const c = p.calc || {};
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const propLine = p.propertyTBD ? "TBD" : (p.propertyAddress || "—");
  const locLine = `${p.city || ""}${p.propertyState ? ", " + p.propertyState : ""}${p.propertyZip ? " " + p.propertyZip : ""}`;

  // ── Option 1 — monthly cash flow ──
  // Junior liens being paid off (2026-08-04, third lien 2026-08-07): each
  // one's payment sits on the CURRENT side and disappears on the new — a
  // subordinated lien's payment stays on BOTH sides — so they join the table,
  // the total, and the verdict figure, keeping every column reconcilable. The
  // current LOAN AMOUNT is everything the new loan replaces: first balance +
  // every paid-off junior. Deferred DPA liens (CalHFA MyHome / ZIP) print at
  // $0/$0 — no payment, but the client sees the lien is handled.
  const lienPmtSaved = c.refiLienPmtSaved || 0;
  const lienPmtCur = c.refiLienPmtCur || 0;
  const lienPmtNew = c.refiLienPmtNew || 0;
  const liens = c.refiLiens || [];
  // Consolidated consumer debts (2026-08-25): same treatment as paid-off
  // liens — their payments sit on the CURRENT side and vanish on the new.
  const paidDebts = c.refiPaidDebts || [];
  const debtPmtSaved = c.refiDebtPmtSaved || 0;
  const retiredPmtSaved = lienPmtSaved + debtPmtSaved;
  // Tax/ins rows carry over unchanged, so the LO can hide them to cut noise
  // (Christo 2026-08-04). Totals follow the visible rows.
  const showTI = p.refiShowTaxIns !== false;
  // Paying off a second: the current side is BOTH liens, so its rate is the
  // blended rate — beating the first's rate alone understates the win
  // (Christo 2026-08-04).
  const secondInPayoff = (c.refiCurTotalDebt ?? 0) > (c.refiEffBalance || 0);
  const cur = {
    loan: c.refiCurTotalDebt ?? (c.refiEffBalance || 0),
    rate: secondInPayoff && c.refiBlendedRate > 0 ? c.refiBlendedRate : (Number(p.refiCurrentRate) || 0),
    prin: c.refiCurPrinThisMonth || 0, int: c.refiCurIntThisMonth || 0,
    tax: c.refiCurMonthlyTax || 0, ins: c.refiCurMonthlyIns || 0,
    mi: Number(p.refiCurrentMI) || 0, hoa: Number(p.hoa) || 0,
  };
  // Each total is the sum of the rows printed above it — nothing else
  // (Christo 2026-08-14). refiCurTotalPmt carries the servicer's escrow
  // COLLECTION (cushion + shortage spread in combined mode), which is not what
  // the Taxes/Insurance rows print — using it made "Monthly Payment saved"
  // disagree with the P&I+MI verdict by an invisible $262/mo, and neither
  // total counted the HOA row both columns print. A client footing a column
  // with a calculator now lands exactly on the total.
  cur.total = cur.prin + cur.int + cur.mi + lienPmtCur + debtPmtSaved + (showTI ? cur.tax + cur.ins + cur.hoa : 0);
  const nw = {
    loan: c.refiNewLoanAmt || 0, rate: Number(p.rate) || 0,
    prin: c.refiNewPrinThisMonth || 0, int: c.refiNewIntThisMonth || 0,
    tax: c.refiNewMonthlyTax || 0, ins: c.refiNewMonthlyIns || 0,
    mi: c.refiNewMI || 0, hoa: Number(p.hoa) || 0,
  };
  nw.total = nw.prin + nw.int + nw.mi + lienPmtNew + (showTI ? nw.tax + nw.ins + nw.hoa : 0);
  const savings = cur.total - nw.total; // positive = saving money
  // The verdict figure is P&I + MI only (doc 7.23) — taxes/insurance/HOA carry
  // over unchanged on a refi, so they cancel out of the savings math.
  const piMiSavings = (cur.prin + cur.int + cur.mi + lienPmtSaved + debtPmtSaved) - (nw.prin + nw.int + nw.mi);
  // Retired liens take the PMI slot when there's no PMI — you'd almost never
  // carry both, so it's either-or (Christo 2026-08-04). With PMI in play
  // anyway, every row prints.
  const pmiRow = ["PMI", usd2(cur.mi), usd2(nw.mi), signed2(nw.mi - cur.mi)];
  const lienRows = liens.map((L) => {
    const nwPmt = L.plan === "payoff" ? 0 : L.pmt;
    const label = L.pos === "2nd"
      ? (L.kind === "heloc" ? "HELOC Payment" : "2nd Lien Payment")
      : "3rd Lien Payment";
    return [label, usd2(L.pmt), usd2(nwPmt), signed2(nwPmt - L.pmt)];
  });
  const hasMi = cur.mi > 0 || nw.mi > 0;
  const lienLabel = c.refiLienLabel || "1st + 2nd";
  const rows1 = [
    [secondInPayoff ? `Loan Amount (${lienLabel})` : "Loan Amount", usd2(cur.loan), usd2(nw.loan), signed2(nw.loan - cur.loan)],
    [secondInPayoff ? `Blended Rate (${lienLabel})` : "Rate", cur.rate.toFixed(3) + "%", nw.rate.toFixed(3) + "%", (nw.rate - cur.rate > 0 ? "+" : "") + (nw.rate - cur.rate).toFixed(3) + "%"],
    ["Principal", usd2(cur.prin), usd2(nw.prin), signed2(nw.prin - cur.prin)],
    ["Interest", usd2(cur.int), usd2(nw.int), signed2(nw.int - cur.int)],
    ...(showTI ? [
      ["Taxes", usd2(cur.tax), usd2(nw.tax), signed2(nw.tax - cur.tax)],
      ["Insurance", usd2(cur.ins), usd2(nw.ins), signed2(nw.ins - cur.ins)],
    ] : []),
    ...(lienRows.length ? (hasMi ? [pmiRow, ...lienRows] : lienRows) : [pmiRow]),
    // Consolidated debts — one aggregate row at the bottom, per Christo
    // 2026-08-25: today's payments vs $0 after the refi retires them.
    ...(paidDebts.length ? [[`Other Debts (${paidDebts.length} paid off)`, usd2(debtPmtSaved), usd2(0), signed2(-debtPmtSaved)]] : []),
    ...(showTI ? [["HOA", usd2(cur.hoa), usd2(nw.hoa), signed2(nw.hoa - cur.hoa)]] : []),
  ];

  // ── Option 2 — long term ──
  const maturity = (() => {
    // The app's effective maturity first — it prefers a stated/manual maturity
    // date, which survives modifications and recasts that closed-date + term
    // cannot see (the sheet printed Jul 2050 while the app honored the
    // statement's Jun 2054 — Christo 2026-08-08). Closed + term is only the
    // fallback.
    const eff = c.refiEffMaturity ? new Date(c.refiEffMaturity) : null;
    if (eff && !isNaN(eff)) return eff.toLocaleDateString("en-US", { year: "numeric", month: "short" });
    if (!p.refiClosedDate) return null;
    const [y, m] = String(p.refiClosedDate).split("-").map(Number);
    if (!y || !m) return null;
    const termMos = (Number(p.refiOriginalTerm) || 30) * 12;
    const d = new Date(y, m - 1 + termMos, 1);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short" });
  })();
  const accel = c.refiAccelPayoff || {};
  const accelPayoffDate = accel.newPayoffMos > 0
    ? (() => { const d = new Date(); d.setMonth(d.getMonth() + accel.newPayoffMos); return d.toLocaleDateString("en-US", { year: "numeric", month: "short" }); })()
    : null;
  const fewerPayments = Math.max(0, (accel.curPayoffMos || 0) - (accel.newPayoffMos || 0));
  const samePayment = (c.refiNewPi || 0) + Math.max(0, c.refiMonthlySavings || 0);
  // Option 2's lifetime savings must price the SAME-PAYMENT plan — what the
  // section is about — not the minimum-payment comparison (which goes negative
  // whenever a short remaining term restarts at 360 and clamped to a useless
  // $0, Christo 2026-08-04).
  //
  // With a paid-off second (Christo 2026-08-05): the CURRENT plan's true cost
  // is first P&I PLUS the second's carry every month — and because an
  // interest-only HELOC never amortizes, its ENTIRE principal is still owed
  // when the first pays off. Charge the current plan both (carry to the
  // first's payoff, then the untouched balance as a lump — the floor; in
  // reality the carry runs longer). The same-payment plan retires both liens,
  // so the two columns both end debt-free.
  // Retired-lien balances count whether or not they billed monthly — a
  // deferred CalHFA/ZIP lien's balance still comes due on the current plan.
  // Consolidated consumer debts get the same floor: their carry rides the
  // current plan (revolving minimums barely amortize) and their balances
  // are owed either way.
  const accelLifetimeSavings = (accel.newPayoffMos > 0 && accel.curPayoffMos > 0 && c.refiEffPI > 0)
    ? ((c.refiEffPI + lienPmtSaved + debtPmtSaved) * accel.curPayoffMos)
      + (c.refiLienPayoffBalTotal || 0)
      + (c.refiDebtBalTotal || 0)
      - (samePayment * accel.newPayoffMos)
      - (c.totalClosingCosts || 0)
    : 0;

  // ── Cash to close + net cash ──
  const skipRows = (() => {
    const n = Number(p.refiSkipMonths) || 0;
    if (n <= 0 || !(c.refiCurTotalPmt > 0)) return [];
    // Which months get skipped (Christo 2026-08-04): closing early in the
    // month (2 skips) means the CLOSING month's own payment is the first one
    // skipped — close Sept 5 and you skip September AND October, not
    // October/November. Closing after the grace day (1 skip) made the
    // closing-month payment, so only the next month is skipped. The skipped
    // window is always the tail of [closing month, closing month + 1].
    const base = Number(p.closingMonth) || (new Date().getMonth() + 1);
    const first = base + (2 - Math.min(2, n));
    // A paid-off second stops billing at closing too — the skipped months
    // skip the WHOLE outlay, not just the first mortgage (Christo 2026-08-05).
    const perMonth = c.refiCurTotalPmt + (c.refiLienPmtSaved || 0);
    return Array.from({ length: n }, (_, i) => [`Skip ${monthName(first + i)} Payment`, perMonth]);
  })();

  return (
    <Document title={`Refi Savings Summary — ${p.scenarioName || ""}`} author={p.loanOfficer || "Loan Officer"}>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.loName}>{p.loanOfficer || "Loan Officer"}</Text>
            <Text style={s.loMeta}>Loan Officer{p.loNmls ? ` · NMLS #${p.loNmls}` : ""}</Text>
            {!!p.loPhone && <Text style={s.loMeta}>{p.loPhone}</Text>}
            {!!p.loEmail && <Text style={s.loMeta}>{p.loEmail}</Text>}
          </View>
          <View>
            <Text style={s.hTitle}>REFINANCE SAVINGS SUMMARY</Text>
            <Text style={s.hSub}>
              <Text style={{ color: INK, fontFamily: "Inter-Bold" }}>Real</Text>
              <Text style={{ color: INDIGO, fontFamily: "Inter-Bold" }}>Stack</Text>
              {"  ·  Blueprint"}
            </Text>
          </View>
        </View>
        <View style={s.rule} />
        <View style={s.metaRow}>
          <Text>{p.borrowerName ? `Prepared for ${p.borrowerName}` : " "}</Text>
          <Text>{propLine !== "—" ? `${propLine} · ${locLine}` : locLine}</Text>
          <Text>{dateStr}</Text>
        </View>

        {/* ── Option 1: Cash Flow Savings ── */}
        <View style={s.secHead}><Text style={s.secHeadText}>Option 1 · Cash Flow Savings</Text></View>
        <View style={s.th}>
          <Text style={[s.cLabel, s.bold, { color: INK }]}> </Text>
          <Text style={[s.cNum, s.bold]}>Current</Text>
          <Text style={[s.cNum, s.bold]}>New</Text>
          <Text style={[s.cNum, s.bold]}>Delta</Text>
        </View>
        {rows1.map(([l, a, b, d], i) => (
          <View key={i} style={s.tr}>
            <Text style={s.cLabel}>{l}</Text>
            <Text style={s.cNum}>{a}</Text>
            <Text style={s.cNum}>{b}</Text>
            <Text style={[s.cNum, { color: SUB }]}>{d}</Text>
          </View>
        ))}
        <View style={s.trTotal}>
          <Text style={[s.cLabel, s.bold, { color: INK }]}>{showTI ? "Monthly Payment" : "Monthly P&I + MI"}</Text>
          <Text style={[s.cNum, s.bold]}>{usd2(cur.total)}</Text>
          <Text style={[s.cNum, s.bold]}>{usd2(nw.total)}</Text>
          <Text style={[s.cNum, s.bold, { color: savings >= 0 ? GREEN : RED }]}>{savings >= 0 ? usd2(savings) + " saved" : signed2(nw.total - cur.total)}</Text>
        </View>
        <View style={[s.line, { borderBottomWidth: 0, marginTop: 3 }]}>
          <Text style={[s.lineLabel, s.bold, { color: INK }]}>{retiredPmtSaved > 0 ? "Monthly Savings (P&I + MI + retired debts — taxes/ins/HOA unchanged)" : "Monthly Savings (P&I + MI — taxes/ins/HOA unchanged)"}</Text>
          <Text style={[s.lineValue, s.bold, { color: piMiSavings >= 0 ? GREEN : RED }]}>{piMiSavings >= 0 ? usd2(piMiSavings) : signed2(-piMiSavings)}</Text>
        </View>
        <View style={[s.line, { borderBottomWidth: 0 }]}>
          <Text style={[s.lineLabel, s.bold, { color: INK }]}>Refi Cost (closing costs only)</Text>
          <Text style={[s.lineValue, s.bold]}>{usd2(c.totalClosingCosts)}</Text>
        </View>
        <View style={[s.line, { borderBottomWidth: 0 }]}>
          <Text style={[s.lineLabel, s.bold, { color: INK }]}>Months to Break Even</Text>
          <Text style={[s.lineValue, s.bold]}>{piMiSavings > 0 && c.totalClosingCosts > 0 ? (c.totalClosingCosts / piMiSavings).toFixed(1) : "—"}</Text>
        </View>

        {/* ── Option 2: Long Term Difference ── */}
        <View style={s.secHead}><Text style={s.secHeadText}>Option 2 · Long-Term Difference (Reinvest the Savings)</Text></View>
        {[
          ["Current loan maturity date", maturity || "—"],
          ["Savings from doing the refinance", usd2(Math.max(0, savings)) + "/mo"],
          ["Keep the same payment — pays off when?", accelPayoffDate || "—"],
          ["How many fewer payments?", fewerPayments > 0 ? String(fewerPayments) : "—"],
          ["Monthly payment (P&I, same-payment plan)", usd2(samePayment)],
        ].map(([l, v], i) => (
          <View key={i} style={s.line}>
            <Text style={s.lineLabel}>{l}</Text>
            <Text style={s.lineValue}>{v}</Text>
          </View>
        ))}
        <View style={s.lineTotal}>
          <Text style={[s.lineLabel, s.bold, { color: INK }]}>Savings over the life of the loan (same-payment plan)</Text>
          <Text style={[s.lineValue, s.bold, { color: accelLifetimeSavings >= 0 ? GREEN : RED }]}>{accelLifetimeSavings !== 0 ? usd(accelLifetimeSavings) : "—"}</Text>
        </View>
        {lienPmtSaved > 0 && (
          <Text style={s.note}>Current plan priced honestly: first P&I plus the {usd2(lienPmtSaved)}/mo junior-lien carry — and an interest-only lien never amortizes, so its full balance still comes due. The same-payment plan retires every lien.</Text>
        )}
        {lienPmtSaved === 0 && (c.refiLienPayoffBalTotal || 0) > 0 && (
          <Text style={s.note}>The junior lien{liens.length > 1 ? "s carry" : " carries"} no monthly payment, but {usd(c.refiLienPayoffBalTotal)} still comes due at payoff, sale, or refinance — the refinance retires {liens.length > 1 ? "them" : "it"} at closing.</Text>
        )}
        <Text style={s.note}>Option 3 is any blend of the two: bank part of the monthly savings, put the rest toward principal.</Text>

        {/* ── Cash to Close Summary ── */}
        <View style={s.twoCol}>
          <View style={s.col}>
            <View style={s.secHead}><Text style={s.secHeadText}>Cash to Close Summary</Text></View>
            {[
              ["Future Loan", "+", c.refiNetNewLoan],
              ["Closing Costs", "−", c.refiNetClosingCosts],
              ["Prepaid Expenses", "−", c.refiNetPrepaids],
              ["Loans / Debts to Payoff", "−", c.refiNetPayoff],
            ].map(([l, sign, v], i) => (
              <View key={i} style={s.line}>
                <Text style={s.lineLabel}>{l}</Text>
                <Text style={s.lineValue}>{sign} {usd2(v)}</Text>
              </View>
            ))}
            <View style={s.lineTotal}>
              <Text style={[s.lineLabel, s.bold, { color: INK }]}>{(c.refiEstCashOut || 0) >= 0 ? "Estimated Cash Out" : "Estimated Cash to Close"}</Text>
              <Text style={[s.lineValue, s.bold, { color: (c.refiEstCashOut || 0) >= 0 ? GREEN : RED }]}>{usd2(c.refiEstCashOut)}</Text>
            </View>
            {p.refiPurpose !== "Cash-Out" && (
              <Text style={s.note}>Max cash back on a Rate/Term refi is the greater of $2,000 or 1% of the new loan balance.</Text>
            )}
          </View>

          {/* ── Net Cash Out ── */}
          <View style={s.col}>
            <View style={s.secHead}><Text style={s.secHeadText}>Net Cash in Hand</Text></View>
            <View style={s.line}>
              {/* The sign lives in the number, not in a "+/−" prefix — that
                  prefix printed "+/− -$8,537.56" on any negative figure, a
                  double sign that reads as a typo. signed2 is what every other
                  row in this file already uses; the label follows the sign the
                  same way the Estimated Cash Out row above does, so a positive
                  figure never sits under a "Cash to close" label. */}
              <Text style={s.lineLabel}>{(c.refiEstCashOut || 0) >= 0 ? "Cash out at closing" : "Cash to close"}</Text>
              <Text style={s.lineValue}>{signed2(c.refiEstCashOut)}</Text>
            </View>
            {skipRows.map(([l, v], i) => (
              <View key={i} style={s.line}>
                <Text style={s.lineLabel}>{l}</Text>
                <Text style={s.lineValue}>+ {usd2(v)}</Text>
              </View>
            ))}
            <View style={s.line}>
              <Text style={s.lineLabel}>Current escrow balance (refunded)</Text>
              <Text style={s.lineValue}>+ {usd2(c.refiEscrowRefund)}</Text>
            </View>
            {/* Blank filler rows so this column's total band lands at the SAME
                height as Estimated Cash to Close on the left (4 rows there;
                2 + skip count here) — Christo 7.24. */}
            {Array.from({ length: Math.max(0, 4 - (2 + skipRows.length)) }, (_, i) => (
              <View key={"pad" + i} style={s.line}>
                <Text style={s.lineLabel}> </Text>
                <Text style={s.lineValue}> </Text>
              </View>
            ))}
            <View style={s.lineTotal}>
              <Text style={[s.lineLabel, s.bold, { color: INK }]}>Net Cash in Hand</Text>
              <Text style={[s.lineValue, s.bold, { color: (c.refiNetCashInHand || 0) >= 0 ? GREEN : RED }]}>{usd2(c.refiNetCashInHand)}</Text>
            </View>
            <Text style={s.note}>Skipped payments and the escrow refund arrive after closing — cash you keep, not cash the loan pays out.</Text>
          </View>
        </View>

        {/* ── Cost of Waiting — breakeven analysis (doc 7.23) ── */}
        {(c.refiCostOfWaiting || []).length > 0 && (
          <>
            <View style={s.secHead}><Text style={s.secHeadText}>Cost of Waiting · Breakeven Analysis</Text></View>
            <View style={s.th}>
              <Text style={[s.cwLabel, s.bold, { color: INK }]}>Waiting for</Text>
              {["1 Year", "2 Years", "3 Years", "4 Years"].map((h) => (
                <Text key={h} style={[s.cwNum, s.bold]}>{h}</Text>
              ))}
            </View>
            <View style={s.tr}>
              <Text style={s.cwLabel}>Lost Savings</Text>
              {c.refiCostOfWaiting[0].years.map((cell, j) => (
                <Text key={j} style={s.cwNum}>{usd(cell.lostSavings)}</Text>
              ))}
            </View>
            {c.refiCostOfWaiting.map((row, i) => (
              <View key={i} style={s.tr}>
                <Text style={s.cwLabel}>−{row.drop}% rate drop</Text>
                {row.years.map((cell, j) => (
                  <Text key={j} style={[s.cwNum, { color: cell.breakeven >= 120 ? RED : cell.breakeven >= 60 ? ORANGE : GREEN }]}>
                    {cell.breakeven >= 999 ? "Never" : `${cell.breakeven} mo`}
                  </Text>
                ))}
              </View>
            ))}
            <Text style={s.note}>Breakeven months: how long a future lower-rate refinance would take to catch up to the savings missed by waiting for that rate.</Text>
          </>
        )}

        {/* Footer */}
        <View style={s.foot}>
          <Text style={s.footText}>
            This summary is an estimate for discussion, not a loan commitment, Loan Estimate, or rate lock. Figures are based on the
            information provided and current assumptions; actual rates, fees, and terms will vary based on credit profile, property
            details, and lender guidelines.
          </Text>
          <Text style={s.footGen}>
            {p.companyName || ""}{p.companyNmls ? ` · Company NMLS #${p.companyNmls}` : ""} · Generated by Mortgage Blueprint — powered by RealStack · {dateStr}
          </Text>
        </View>
      </Page>

      {/* Optional page 2 — the Initial Fees Worksheet, identical to the
          standalone fees PDF. */}
      {p.includeFees ? <FeesWorksheetPage {...p} /> : null}
    </Document>
  );
}
