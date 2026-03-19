/**
 * BlueprintPane — Self-contained mortgage calculator for Workspace panes
 *
 * Each workspace pane gets its own instance with isolated state.
 * Contains a focused calc engine (P&I, tax, insurance, PMI, closing costs, DTI)
 * and a compact single-column UI with core inputs + key metrics.
 *
 * Phase 2 of Workspace: real, interactive calculators in each pane.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { CA_CITY_TAX_RATES, CA_CITY_NAMES, STATE_CITIES } from "./citiesData.js";
import Icon from "./Icon";

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace";

// ── Theme (passed in as prop, but need a module-level ref for components) ──
let T = {};

// ── Utility Functions (mirrored from main app) ──
function fmt(v) {
  if (v == null || !isFinite(v) || isNaN(v)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);
}
function pct(v, d = 1) { return ((v || 0) * 100).toFixed(d) + "%"; }
function calcPI(loanAmt, annualRate, termYears) {
  if (!loanAmt || loanAmt <= 0) return 0;
  const mr = (annualRate / 100) / 12;
  const np = termYears * 12;
  if (mr <= 0 || np <= 0) return loanAmt / (np || 1);
  return (loanAmt * mr * Math.pow(1 + mr, np)) / (Math.pow(1 + mr, np) - 1);
}
function getPMIRate(ltv, fico) {
  const matrix = {
    97: { 760: 0.0058, 740: 0.0070, 720: 0.0087, 700: 0.0099, 680: 0.0121, 660: 0.0154, 640: 0.0165, 620: 0.0186 },
    95: { 760: 0.0038, 740: 0.0048, 720: 0.0059, 700: 0.0068, 680: 0.0087, 660: 0.0111, 640: 0.0119, 620: 0.0138 },
    90: { 760: 0.0030, 740: 0.0039, 720: 0.0046, 700: 0.0056, 680: 0.0067, 660: 0.0087, 640: 0.0096, 620: 0.0111 },
    85: { 760: 0.0019, 740: 0.0020, 720: 0.0023, 700: 0.0025, 680: 0.0028, 660: 0.0038, 640: 0.0042, 620: 0.0044 },
  };
  const ltvPct = ltv * 100;
  const bucket = ltvPct > 95 ? 97 : ltvPct > 90 ? 95 : ltvPct > 85 ? 90 : 85;
  const score = fico || 700;
  const ficoBucket = score >= 760 ? 760 : score >= 740 ? 740 : score >= 720 ? 720 : score >= 700 ? 700 : score >= 680 ? 680 : score >= 660 ? 660 : score >= 640 ? 640 : 620;
  return matrix[bucket][ficoBucket] || matrix[bucket][700];
}

const STATE_PROPERTY_TAX_RATES = {
  "Alabama": 0.0040, "Alaska": 0.0118, "Arizona": 0.0062, "Arkansas": 0.0061,
  "California": null, "Colorado": 0.0051, "Connecticut": 0.0215, "Delaware": 0.0057,
  "Florida": 0.0086, "Georgia": 0.0090, "Hawaii": 0.0029,
  "Idaho": 0.0063, "Illinois": 0.0214, "Indiana": 0.0085, "Iowa": 0.0153,
  "Kansas": 0.0141, "Kentucky": 0.0086, "Louisiana": 0.0055, "Maine": 0.0136,
  "Maryland": 0.0107, "Massachusetts": 0.0123, "Michigan": 0.0154, "Minnesota": 0.0113,
  "Mississippi": 0.0065, "Missouri": 0.0097, "Montana": 0.0083, "Nebraska": 0.0173,
  "Nevada": 0.0053, "New Hampshire": 0.0218, "New Jersey": 0.0223, "New Mexico": 0.0067,
  "New York": 0.0172, "North Carolina": 0.0082, "North Dakota": 0.0098, "Ohio": 0.0157,
  "Oklahoma": 0.0087, "Oregon": 0.0097, "Pennsylvania": 0.0153, "Rhode Island": 0.0163,
  "South Carolina": 0.0057, "South Dakota": 0.0128, "Tennessee": 0.0066, "Texas": 0.0168,
  "Utah": 0.0058, "Vermont": 0.0188, "Virginia": 0.0082, "Washington": 0.0092,
  "West Virginia": 0.0058, "Wisconsin": 0.0178, "Wyoming": 0.0057,
};

const LOAN_TYPES = ["Conventional", "FHA", "VA", "Jumbo"];
const PROP_TYPES = ["Single Family", "Condo", "Townhouse", "2-Unit", "3-Unit", "4-Unit"];
const CONDO_TYPES = new Set(["Condo", "Townhouse"]);
const CONF_LIMIT = 832750;

// ── Compact UI Components ──
function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  return (<span style={{ position: "relative", display: "inline-flex", marginLeft: 5, verticalAlign: "middle" }}
    onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
    <span onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", background: open ? T.blue : `${T.blue}20`, color: open ? "#fff" : T.blue, fontSize: 9, fontWeight: 700, cursor: "pointer", fontFamily: FONT, lineHeight: 1 }}>i</span>
    {open && (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
        <div style={{ position: "relative", zIndex: 1, background: T.card, border: `1px solid ${T.separator}`, borderRadius: 14, padding: 18, fontSize: 12, lineHeight: 1.6, color: T.textSecondary, width: "min(260px, 85vw)", boxShadow: "0 8px 30px rgba(0,0,0,0.25)" }}>
          {text}
          <button onClick={() => setOpen(false)} style={{ marginTop: 10, width: "100%", padding: 8, background: T.blue, border: "none", borderRadius: 10, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: FONT }}>Got it</button>
        </div>
      </div>
    )}
  </span>);
}

function PaneInp({ label, value, onChange, prefix = "$", suffix, step = 1, min = 0, max, tip, glow }) {
  const [focused, setFocused] = useState(false);
  const [editStr, setEditStr] = useState(null);
  const inputRef = useRef(null);
  const fmtComma = (n) => { if (n === 0 || n === "") return ""; const parts = String(n).split("."); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); return parts.join("."); };
  const clamp = (n) => { if (isNaN(n)) return 0; if (min !== undefined && n < min) return min; if (max !== undefined && n > max) return max; return n; };
  const display = editStr !== null ? editStr : (value === 0 && focused ? "" : fmtComma(value));
  const glowStyle = glow && value === 0 ? { boxShadow: `0 0 0 2px ${T.blue}60, 0 0 12px ${T.blue}20`, border: `2px solid ${T.blue}` } : {};

  return (<div style={{ marginBottom: 10 }}>
    {label && <div style={{ display: "flex", alignItems: "center", fontSize: 11, fontWeight: 500, color: glow && value === 0 ? T.blue : T.textSecondary, marginBottom: 4, fontFamily: FONT }}>{label}{glow && value === 0 && <span style={{ color: T.blue, marginLeft: 3, fontSize: 11, fontWeight: 700 }}>*</span>}{tip && <InfoTip text={tip} />}</div>}
    <div style={{ display: "flex", alignItems: "center", background: T.inputBg, borderRadius: 10, padding: "8px 10px", border: focused ? `2px solid ${T.blue}` : `1px solid ${T.inputBorder}`, transition: "all 0.3s", ...glowStyle }}>
      {prefix && <span style={{ color: T.textSecondary, fontSize: 14, fontWeight: 600, marginRight: 3 }}>{prefix}</span>}
      <input ref={inputRef} type="text" inputMode="decimal" value={display}
        onFocus={() => { setFocused(true); setEditStr(null); }}
        onBlur={() => { setFocused(false); if (editStr !== null) { const n = clamp(parseFloat(editStr.replace(/,/g, ""))); onChange(isNaN(n) ? 0 : n); setEditStr(null); } }}
        onChange={e => { const raw = e.target.value.replace(/,/g, ""); if (raw === "" || raw === "-") { setEditStr(""); return; } if (/^-?\d*\.?\d*$/.test(raw)) { const n = parseFloat(raw); setEditStr(raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",")); if (!isNaN(n)) onChange(n); } }}
        style={{ background: "transparent", border: "none", outline: "none", color: T.text, fontSize: 14, fontWeight: 600, fontFamily: FONT, width: "100%", letterSpacing: "-0.02em" }} />
      {suffix && <span style={{ color: T.textTertiary, fontSize: 11, marginLeft: 4 }}>{suffix}</span>}
    </div>
  </div>);
}

function PaneSel({ label, value, onChange, options }) {
  return (<div style={{ marginBottom: 10 }}>
    {label && <div style={{ fontSize: 11, fontWeight: 500, color: T.textSecondary, marginBottom: 4, fontFamily: FONT }}>{label}</div>}
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", background: T.inputBg, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: "8px 10px", color: T.text, fontSize: 13, fontWeight: 500, outline: "none", cursor: "pointer", fontFamily: FONT, WebkitAppearance: "none" }}>
      {options.map(o => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
    </select>
  </div>);
}

function PaneCard({ children, style: s }) {
  return (<div style={{ background: T.card, borderRadius: 12, padding: 14, boxShadow: T.cardShadow, marginBottom: 10, ...s }}>{children}</div>);
}

function PaneRow({ label, value, sub, color, bold }) {
  return (<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "6px 0", borderBottom: `1px solid ${T.separator}` }}>
    <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 600 : 400, color: bold ? T.text : T.textSecondary, fontFamily: FONT }}>
      {label}{sub && <span style={{ color: T.textTertiary, fontSize: 10, marginLeft: 4 }}>{sub}</span>}
    </span>
    <span style={{ fontSize: bold ? 15 : 13, fontWeight: 600, fontFamily: MONO, color: color || T.text, letterSpacing: "-0.02em" }}>{value}</span>
  </div>);
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export default function BlueprintPane({ theme, paneId, paneConfig, onCalcUpdate, onStateUpdate, linkedValues, isRefiMode, liveRate, liveRates, sharedIncomes, sharedDebts, sharedOtherIncome, sharedReos, loadedScenario, linkedDownPayment }) {
  T = theme; // set module-level theme ref

  // ── Core State ──
  const [salesPrice, setSalesPrice] = useState(1000000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.5);

  const [term, setTerm] = useState(30);
  const [loanType, setLoanType] = useState("Conventional");

  // ── Apply live rate when pushed from workspace, auto-update on loan type/term change ──
  const hasLiveRates = useRef(false);
  useEffect(() => {
    if (liveRates && liveRates["30yr_fixed"]) {
      hasLiveRates.current = true;
      const rateMap = {
        "Conventional": term === 15 ? liveRates["15yr_fixed"] : liveRates["30yr_fixed"],
        "FHA": liveRates["30yr_fha"] || liveRates["30yr_fixed"],
        "VA": liveRates["30yr_va"] || liveRates["30yr_fixed"],
        "Jumbo": liveRates["30yr_jumbo"] || liveRates["30yr_fixed"],
        "USDA": liveRates["30yr_fixed"],
      };
      const matched = rateMap[loanType] || liveRates["30yr_fixed"];
      if (matched && !isNaN(matched)) setRate(matched);
    } else if (liveRate && !hasLiveRates.current && !isNaN(liveRate)) {
      setRate(liveRate);
    }
  }, [liveRates, liveRate, loanType, term]);
  const [propType, setPropType] = useState("Single Family");
  const [city, setCity] = useState("Alameda");
  const [propertyState, setPropertyState] = useState("California");
  const [hoa, setHoa] = useState(0);
  const [annualIns, setAnnualIns] = useState(1500);
  const [creditScore, setCreditScore] = useState(760);
  const [includeEscrow, setIncludeEscrow] = useState(true);

  // ── Auto-set insurance for condos ──
  const prevPropType = useRef(propType);
  useEffect(() => {
    if (propType !== prevPropType.current) {
      if (CONDO_TYPES.has(propType)) setAnnualIns(750);
      else if (CONDO_TYPES.has(prevPropType.current)) setAnnualIns(1500);
      prevPropType.current = propType;
    }
  }, [propType]);

  const hoaRequired = CONDO_TYPES.has(propType);

  // ── Refi-specific state ──
  const [refiCurrentRate, setRefiCurrentRate] = useState(0);
  const [refiCurrentBalance, setRefiCurrentBalance] = useState(0);
  const [refiCurrentPayment, setRefiCurrentPayment] = useState(0);

  // ── Scenario label ──
  const [scenarioLabel, setScenarioLabel] = useState(paneConfig?.label || "Scenario");

  // ── Load saved scenario when loadedScenario prop changes ──
  const prevLoadedScenario = useRef(null);
  useEffect(() => {
    if (loadedScenario && loadedScenario !== prevLoadedScenario.current) {
      prevLoadedScenario.current = loadedScenario;
      const s = loadedScenario;
      if (s.salesPrice !== undefined) setSalesPrice(s.salesPrice);
      if (s.downPct !== undefined) setDownPct(s.downPct);
      if (s.rate !== undefined) setRate(s.rate);
      if (s.term !== undefined) setTerm(s.term);
      if (s.loanType) setLoanType(s.loanType.startsWith("VA") ? "VA" : s.loanType);
      if (s.propType) setPropType(s.propType);
      if (s.city) setCity(s.city);
      if (s.propertyState) setPropertyState(s.propertyState);
      if (s.hoa !== undefined) setHoa(s.hoa);
      if (s.annualIns !== undefined) setAnnualIns(s.annualIns);
      if (s.creditScore !== undefined) setCreditScore(s.creditScore);
      if (s.includeEscrow !== undefined) setIncludeEscrow(s.includeEscrow);
      if (s.scenarioName) setScenarioLabel(s.scenarioName);
    }
  }, [loadedScenario]);

  // ── Apply linked down payment from Sell→Buy proceeds flow ──
  const prevLinkedDown = useRef(null);
  useEffect(() => {
    if (linkedDownPayment != null && linkedDownPayment > 0 && linkedDownPayment !== prevLinkedDown.current) {
      prevLinkedDown.current = linkedDownPayment;
      // Set down payment as dollar amount, recalculate %
      if (salesPrice > 0) {
        const newPct = Math.round(linkedDownPayment / salesPrice * 10000) / 100;
        setDownPct(Math.min(newPct, 100));
      }
    }
  }, [linkedDownPayment, salesPrice]);

  // ── Apply linked values for refi mode ──
  useEffect(() => {
    if (isRefiMode && linkedValues) {
      if (linkedValues.purchasePropertyValue > 0) setSalesPrice(linkedValues.purchasePropertyValue);
      if (linkedValues.purchaseLoanAmount > 0) setRefiCurrentBalance(linkedValues.purchaseLoanAmount);
      if (linkedValues.purchaseRate > 0) setRefiCurrentRate(linkedValues.purchaseRate);
    }
  }, [isRefiMode, linkedValues?.purchasePropertyValue, linkedValues?.purchaseLoanAmount, linkedValues?.purchaseRate]);

  // ── Calculation Engine ──
  const calc = useMemo(() => {
    const dp = salesPrice * (downPct / 100);
    const baseLoan = salesPrice - dp;
    const ltv = salesPrice > 0 ? baseLoan / salesPrice : 0;

    // FHA upfront MIP / VA funding fee
    const fhaUp = loanType === "FHA" ? baseLoan * 0.0175 : 0;
    const vaFF = loanType === "VA" ? baseLoan * 0.023 : 0;
    const loan = baseLoan + fhaUp + vaFF;

    // Loan category
    const loanCategory = loanType === "FHA" ? "FHA" : loanType === "VA" ? "VA" :
      loan > CONF_LIMIT * 1.5 ? "Jumbo" : loan > CONF_LIMIT ? "High Balance" : "Conforming";

    // P&I
    const pi = calcPI(loan, rate, term);

    // Property tax — CA_CITY_TAX_RATES are already decimals (e.g. 0.012127 = 1.2127%)
    let yearlyTax;
    if (propertyState === "California" && CA_CITY_TAX_RATES[city]) {
      yearlyTax = salesPrice * CA_CITY_TAX_RATES[city];
    } else {
      const stateRate = STATE_PROPERTY_TAX_RATES[propertyState] || 0.0125;
      yearlyTax = salesPrice * stateRate;
    }
    const monthlyTax = yearlyTax / 12;

    // Insurance
    const ins = annualIns / 12;

    // PMI / MIP
    let monthlyMI = 0;
    if (loanType === "FHA") {
      monthlyMI = loan * 0.0055 / 12;
    } else if (loanType !== "VA" && ltv > 0.80) {
      monthlyMI = loan * getPMIRate(ltv, creditScore) / 12;
    }

    // Housing payment
    const housingPayment = pi + monthlyTax + ins + monthlyMI + hoa;
    const displayPayment = includeEscrow ? housingPayment : pi + monthlyMI + hoa;

    // Closing costs (simplified but realistic)
    const origCharges = loan * 0.005 + 500; // ~0.5% + processing
    const titleEscrow = Math.max(3000, salesPrice * 0.003);
    const prepaidInt = (loan * rate / 100 / 365) * 15;
    const prepaidIns = annualIns;
    const initialEscrow = (monthlyTax + ins) * 3;
    const totalClosingCosts = origCharges + titleEscrow;
    const cashToClose = dp + totalClosingCosts + prepaidInt + prepaidIns + initialEscrow;

    // Total interest over life
    const totalInt = pi * term * 12 - loan;

    // Refi savings (if in refi mode)
    const refiMonthlySavings = isRefiMode && refiCurrentPayment > 0 ? refiCurrentPayment - displayPayment : 0;

    // Apply proceeds paydown for refi mode
    let adjustedLoan = loan;
    let adjustedPayment = displayPayment;
    if (isRefiMode && linkedValues) {
      const proceeds = linkedValues.proceedsUseAll ? linkedValues.sellNetAfterTax : linkedValues.proceedsToApply;
      if (proceeds > 0) {
        adjustedLoan = Math.max(0, loan - proceeds);
        const adjPI = calcPI(adjustedLoan, rate, term);
        const adjMI = loanType !== "VA" && (adjustedLoan / salesPrice) > 0.80 ? adjustedLoan * getPMIRate(adjustedLoan / salesPrice, creditScore) / 12 : 0;
        adjustedPayment = adjPI + monthlyTax + ins + adjMI + hoa;
      }
    }

    // ── DTI from shared income/debts ──
    const incArr = sharedIncomes || [];
    const debtArr = sharedDebts || [];
    const reoArr = sharedReos || [];
    const monthlyIncome = incArr.reduce((s, inc) => {
      const amt = Number(inc.monthly) || 0;
      return s + amt;
    }, 0) + (Number(sharedOtherIncome) || 0);

    // Monthly debts (exclude debts linked to investment REOs — they net via rental income)
    const investReoIds = new Set(reoArr.filter(r => r.propUse === "Investment").map(r => String(r.id)));
    const linkedDebtIds = new Set(debtArr.filter(d => d.linkedReoId && investReoIds.has(d.linkedReoId) && (d.type === "Mortgage" || d.type === "HELOC")).map(d => d.id));
    const monthlyDebts = debtArr.filter(d => !linkedDebtIds.has(d.id)).reduce((s, d) => s + (Number(d.payment || d.monthly) || 0), 0);

    // Investment property netting (75% of rent - PITIA)
    let reoInvNet = 0;
    reoArr.filter(r => r.propUse === "Investment").forEach(r => {
      const linked = debtArr.filter(d => d.linkedReoId === String(r.id));
      const linkedPmt = linked.reduce((s, d) => s + (Number(d.monthly || d.payment) || 0), 0);
      const pitia = linked.length > 0 ? linkedPmt : (Number(r.payment) || 0);
      reoInvNet += ((Number(r.rentalIncome) || 0) * 0.75) - pitia;
    });

    // Primary/Second Home REO debt
    let reoPrimDebt = 0;
    reoArr.filter(r => r.propUse !== "Investment").forEach(r => {
      const linked = debtArr.filter(d => d.linkedReoId === String(r.id));
      if (linked.length === 0) reoPrimDebt += (Number(r.payment) || 0);
    });

    const reoIncAdd = reoInvNet > 0 ? reoInvNet : 0;
    const reoDebtAdd = (reoInvNet < 0 ? Math.abs(reoInvNet) : 0) + reoPrimDebt;
    const qualifyingIncome = monthlyIncome + reoIncAdd;
    const totalPaymentForDTI = housingPayment + monthlyDebts + reoDebtAdd;
    const yourDTI = qualifyingIncome > 0 ? totalPaymentForDTI / qualifyingIncome : 0;

    return {
      dp, baseLoan, loan, ltv, loanCategory,
      pi, monthlyTax, yearlyTax, ins, monthlyMI, hoa,
      housingPayment, displayPayment,
      totalClosingCosts, cashToClose, prepaidInt, prepaidIns, initialEscrow, titleEscrow, origCharges,
      totalInt, totalIntStandard: totalInt,
      refiMonthlySavings,
      adjustedLoan, adjustedPayment,
      yourDTI, qualifyingIncome, monthlyDebts, monthlyIncome,
    };
  }, [salesPrice, downPct, rate, term, loanType, propType, city, propertyState, hoa, annualIns, creditScore, includeEscrow, isRefiMode, linkedValues, refiCurrentPayment, sharedIncomes, sharedDebts, sharedOtherIncome, sharedReos]);

  // ── Report calc + state back to workspace context ──
  useEffect(() => {
    if (onCalcUpdate) onCalcUpdate(paneId, calc);
  }, [calc, paneId]);

  useEffect(() => {
    if (onStateUpdate) onStateUpdate(paneId, { salesPrice, downPct, rate, term, loanType, propType, scenarioName: scenarioLabel, annualIns, hoa, creditScore });
  }, [salesPrice, downPct, rate, term, loanType, propType, scenarioLabel, paneId]);

  // ── Notify linked values (purchase pane → context) ──
  useEffect(() => {
    if (!isRefiMode && linkedValues && typeof linkedValues._updateFromPurchase === "function") {
      linkedValues._updateFromPurchase({
        purchaseSalesPrice: salesPrice,
        purchaseLoanAmount: calc.loan,
        purchaseRate: rate,
        purchasePropertyValue: salesPrice,
      });
    }
  }, [salesPrice, calc.loan, rate, isRefiMode]);

  // ── Active section toggle ──
  const [activeSection, setActiveSection] = useState("inputs"); // "inputs" | "results" | "costs"

  const effectivePayment = isRefiMode ? calc.adjustedPayment : calc.displayPayment;
  const effectiveLoan = isRefiMode ? calc.adjustedLoan : calc.loan;

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Hero metric */}
      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: FONT, color: T.text, letterSpacing: "-0.04em", lineHeight: 1 }}>
          {fmt(effectivePayment)}
        </div>
        <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 4, fontFamily: FONT }}>
          {includeEscrow ? "Monthly Payment" : "P&I Only"} · {fmt(isRefiMode ? calc.adjustedLoan : calc.cashToClose)} {isRefiMode ? "loan" : "to close"}
        </div>
      </div>

      {/* Quick metrics strip */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 16 }}>
        {[
          { label: "Loan", value: fmt(effectiveLoan), color: T.text },
          { label: "LTV", value: pct(isRefiMode ? (calc.adjustedLoan / salesPrice) : calc.ltv, 0), color: calc.ltv > 0.80 ? T.orange : T.green },
          { label: "Rate", value: rate + "%", color: T.blue },
        ].map((m, i) => (
          <div key={i} style={{ textAlign: "center", padding: "8px 4px", background: T.pillBg, borderRadius: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: m.color, letterSpacing: "-0.02em" }}>{m.value}</div>
            <div style={{ fontSize: 9, color: T.textTertiary, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1px" }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {[["inputs", "Inputs"], ["results", "Breakdown"], ["costs", "Costs"]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveSection(key)} style={{
            flex: 1, padding: "6px 8px", borderRadius: 8, border: "none",
            background: activeSection === key ? `${T.accent}15` : "transparent",
            color: activeSection === key ? T.accent : T.textTertiary,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── INPUTS SECTION ── */}
      {activeSection === "inputs" && (
        <PaneCard>
          <PaneInp label="Purchase Price" value={salesPrice} onChange={setSalesPrice} tip="The sale price or appraised value of the property." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <PaneInp label="Down %" value={downPct} onChange={setDownPct} prefix="" suffix="%" step={0.5} max={100} />
            <PaneInp label="Down $" value={Math.round(salesPrice * downPct / 100)} onChange={v => setDownPct(salesPrice > 0 ? Math.round(v / salesPrice * 10000) / 100 : 0)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <PaneInp label="Rate" value={rate} onChange={setRate} prefix="" suffix="%" step={0.125} max={15} />
            <PaneSel label="Term" value={term} onChange={v => setTerm(Number(v))} options={[{value: 30, label: "30 yr"}, {value: 20, label: "20 yr"}, {value: 15, label: "15 yr"}, {value: 10, label: "10 yr"}]} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <PaneSel label="Loan Type" value={loanType} onChange={setLoanType} options={LOAN_TYPES} />
            <PaneSel label="Property Type" value={propType} onChange={setPropType} options={PROP_TYPES} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <PaneInp label="HOA" value={hoa} onChange={setHoa} tip="Monthly HOA dues" glow={hoaRequired} />
            <PaneInp label="Annual Insurance" value={annualIns} onChange={setAnnualIns} />
          </div>
          <PaneInp label="Credit Score" value={creditScore} onChange={setCreditScore} prefix="" min={300} max={850} tip="Used for PMI rate lookup" />
          {propertyState === "California" && (
            <PaneSel label="City (Tax Rate)" value={city} onChange={setCity} options={CA_CITY_NAMES} />
          )}
        </PaneCard>
      )}

      {/* ── BREAKDOWN SECTION ── */}
      {activeSection === "results" && (<>
        {/* Monthly Payment Breakdown */}
        <PaneCard>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary, marginBottom: 6 }}>Monthly Payment</div>
          <PaneRow label="P&I" value={fmt(calc.pi)} />
          <PaneRow label="Property Tax" value={fmt(calc.monthlyTax)} sub={`${fmt(calc.yearlyTax)}/yr`} />
          <PaneRow label="Insurance" value={fmt(calc.ins)} sub={`${fmt(annualIns)}/yr`} />
          {calc.monthlyMI > 0 && <PaneRow label={loanType === "FHA" ? "MIP" : "PMI"} value={fmt(calc.monthlyMI)} color={T.orange} />}
          {hoa > 0 && <PaneRow label="HOA" value={fmt(hoa)} />}
          <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 4, paddingTop: 4 }}>
            <PaneRow label="Total Payment" value={fmt(calc.housingPayment)} bold color={T.text} />
          </div>
        </PaneCard>
        {/* Cash to Close Waterfall */}
        <PaneCard>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary, marginBottom: 6 }}>Cash to Close</div>
          <PaneRow label="Purchase Price" value={fmt(salesPrice)} bold />
          <PaneRow label="Loan Amount" value={`-${fmt(calc.loan)}`} color={T.blue} />
          <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 4, paddingTop: 4 }}>
            <PaneRow label="Down Payment" value={fmt(calc.dp)} sub={`${downPct}%`} bold />
          </div>
          <PaneRow label="Closing Costs" value={fmt(calc.totalClosingCosts)} sub="lender + title" />
          <PaneRow label="Prepaids + Escrow" value={fmt(calc.prepaidInt + calc.prepaidIns + calc.initialEscrow)} sub={`${fmt(calc.prepaidInt)} int · ${fmt(calc.prepaidIns)} ins · ${fmt(calc.initialEscrow)} escrow`} />
          <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 4, paddingTop: 4 }}>
            <PaneRow label="Cash to Close" value={fmt(calc.cashToClose)} bold color={T.blue} />
          </div>
        </PaneCard>
        {/* Loan Details */}
        <PaneCard>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary, marginBottom: 6 }}>Loan Details</div>
          <PaneRow label="LTV" value={pct(calc.ltv, 1)} color={calc.ltv > 0.80 ? T.orange : T.green} />
          <PaneRow label="Loan Category" value={calc.loanCategory} />
          {calc.qualifyingIncome > 0 && <PaneRow label="DTI" value={pct(calc.yourDTI, 1)} color={calc.yourDTI > 0.50 ? T.red : calc.yourDTI > 0.43 ? T.orange : T.green} bold />}
          {calc.qualifyingIncome > 0 && <PaneRow label="Income" value={fmt(calc.qualifyingIncome) + "/mo"} sub={fmt(calc.monthlyDebts) + " debts"} />}
          <PaneRow label="Total Interest" value={fmt(calc.totalInt)} sub={`over ${term} years`} />
        </PaneCard>
        {isRefiMode && calc.adjustedLoan < calc.loan && (
          <PaneCard style={{ background: T.successBg, border: `1px solid ${T.successBorder}` }}>
            <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, color: T.green, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4 }}>
              After Proceeds Applied
            </div>
            <PaneRow label="Adjusted Loan" value={fmt(calc.adjustedLoan)} color={T.green} bold />
            <PaneRow label="New Payment" value={fmt(calc.adjustedPayment)} color={T.green} bold />
            <PaneRow label="Savings" value={fmt(calc.housingPayment - calc.adjustedPayment) + "/mo"} color={T.green} />
          </PaneCard>
        )}
      </>)}

      {/* ── COSTS SECTION (detailed closing cost breakdown) ── */}
      {activeSection === "costs" && (
        <PaneCard>
          <div style={{ fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary, marginBottom: 6 }}>Closing Cost Detail</div>
          <PaneRow label="Origination & Lender" value={fmt(calc.origCharges)} />
          <PaneRow label="Title & Escrow" value={fmt(calc.titleEscrow)} />
          <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 4, paddingTop: 4 }}>
            <PaneRow label="Total Closing Costs" value={fmt(calc.totalClosingCosts)} bold />
          </div>
          <div style={{ marginTop: 8, fontSize: 10, fontWeight: 600, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "1.5px", color: T.textTertiary, marginBottom: 6 }}>Prepaids & Escrow</div>
          <PaneRow label="Prepaid Interest" value={fmt(calc.prepaidInt)} sub="~15 days" />
          <PaneRow label="Prepaid Insurance" value={fmt(calc.prepaidIns)} sub="12 months" />
          <PaneRow label="Initial Escrow" value={fmt(calc.initialEscrow)} sub="tax + ins ~3 mo" />
          <div style={{ borderTop: `1px solid ${T.separator}`, marginTop: 4, paddingTop: 4 }}>
            <PaneRow label="Total Prepaids" value={fmt(calc.prepaidInt + calc.prepaidIns + calc.initialEscrow)} bold />
          </div>
          <div style={{ marginTop: 8, borderTop: `2px solid ${T.separator}`, paddingTop: 6 }}>
            <PaneRow label="Down Payment" value={fmt(calc.dp)} sub={`${downPct}%`} />
            <PaneRow label="+ Closing Costs" value={fmt(calc.totalClosingCosts)} />
            <PaneRow label="+ Prepaids & Escrow" value={fmt(calc.prepaidInt + calc.prepaidIns + calc.initialEscrow)} />
            <div style={{ borderTop: `2px solid ${T.separator}`, marginTop: 4, paddingTop: 4 }}>
              <PaneRow label="Cash to Close" value={fmt(calc.cashToClose)} bold color={T.blue} />
            </div>
          </div>
        </PaneCard>
      )}

      {/* Loan type badge */}
      <div style={{ textAlign: "center", marginTop: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, fontFamily: MONO,
          textTransform: "uppercase", letterSpacing: "1px",
          padding: "3px 10px", borderRadius: 9999,
          background: calc.loanCategory === "Conforming" ? `${T.green}12` : calc.loanCategory === "FHA" ? `${T.blue}12` : `${T.orange}12`,
          color: calc.loanCategory === "Conforming" ? T.green : calc.loanCategory === "FHA" ? T.blue : T.orange,
        }}>
          {calc.loanCategory} · {term}yr {loanType}
        </span>
      </div>
    </div>
  );
}
