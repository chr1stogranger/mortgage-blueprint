// ─── Loan timeline — where a loan in process stands (sidebar tab) ────────────
// One timeline, shared with Ops. After each live Arive sync, Ops saves a small
// borrower-safe snapshot of the client's loan on their Blueprint client row
// (`borrowers.live_loan`, see loan-pipeline api/helpers/_liveLoanSnapshot.js):
// stage, six phases, the borrower-visible steps with dates, and key dates.
// This tab only draws that snapshot. It never computes a status and never
// calls Arive, so the loan officer and the borrower read the same thing.
//
// MortgageBlueprint shows the tab (and the Overview chip below) only when the
// client has a snapshot, so a lead or pre-approval never sees an empty tab.
// Read-only in both roles; the loan officer edits steps and dates in Ops.
import { FONT, MONO } from "../lib/fonts.js";
import Icon from "../Icon";

/** The snapshot if it is one this build understands, else null. */
export function readLiveLoan(borrower) {
  const s = borrower?.live_loan;
  return s && s.v === 1 && Array.isArray(s.phases) && s.phases.length && Array.isArray(s.steps) ? s : null;
}

const FUNDED = new Set(["LOAN_FUNDED", "BROKER_CHECK_RECEIVED", "COMMISSION_PAID"]);

// "2026-12-11" → a local Date (never through UTC: that lands a day early).
const parseYmd = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const sameYear = (d) => d.getFullYear() === new Date().getFullYear();
const fmtShort = (v) => {
  const d = parseYmd(v);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear(d) ? {} : { year: "numeric" }) }) : "";
};
const fmtLong = (v) => {
  const d = parseYmd(v);
  return d ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", ...(sameYear(d) ? {} : { year: "numeric" }) }) : "";
};
const fmtKey = (v) => {
  const d = parseYmd(v);
  return d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", ...(sameYear(d) ? {} : { year: "numeric" }) }) : "";
};
/** Whole days from today to a date (negative = past); null without a date. */
export function daysUntil(v, now = new Date()) {
  const d = parseYmd(v);
  if (!d) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d - today) / 86400000);
}

const HEADLINE = {
  LOAN_SETUP: "Your loan is getting started",
  DISCLOSURE_SENT: "Your loan disclosures are out",
  UNDERWRITING_SUBMITTED: "Your loan is in underwriting",
  RE_SUBMITTAL: "Your loan is back in underwriting",
  APPROVED_WITH_CONDITION: "Your loan is conditionally approved",
  CLEAR_TO_CLOSE: "You are clear to close",
  DOCS_OUT: "Your loan documents are out",
  DOCS_SIGNED: "Your loan documents are signed",
};

/** One line for the Overview chip: "Closing Fri, Dec 11 · 18 days". */
function closingLine(liveLoan) {
  if (FUNDED.has(liveLoan.stage)) return "";
  const closing = liveLoan.key_dates?.closing;
  const n = daysUntil(closing);
  if (n === null) return "";
  if (n > 1) return `Closing ${fmtKey(closing)} · ${n} days`;
  if (n === 1) return `Closing tomorrow, ${fmtKey(closing)}`;
  if (n === 0) return "Closing today";
  return `Target closing was ${fmtKey(closing)}`;
}

function Mark({ T, state, size = 22 }) {
  if (state === "done") {
    return (
      <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 9999, background: T.green, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name="check" size={Math.round(size * 0.6)} color="#fff" />
      </span>
    );
  }
  if (state === "now") {
    return (
      <span aria-hidden="true" style={{ width: size, height: size, boxSizing: "border-box", borderRadius: 9999, border: `2px solid ${T.blue}`, background: T.card, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ width: size * 0.45, height: size * 0.45, borderRadius: 9999, background: T.blue }} />
      </span>
    );
  }
  return <span aria-hidden="true" style={{ width: size, height: size, boxSizing: "border-box", borderRadius: 9999, border: `2px solid ${T.inputBorder}`, background: T.card, flexShrink: 0 }} />;
}

const micro = (T) => ({ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: T.textTertiary });
const PHASE_TAG = { done: "Done", now: "In progress", todo: "Up next" };
const phaseDate = (p) => (p.date ? (p.state === "done" ? fmtShort(p.date) : `Target ${fmtShort(p.date)}`) : "");

/** The status line on Overview. Renders nothing without a snapshot. */
export function LoanTimelineChip({ T, liveLoan, onOpen }) {
  if (!liveLoan) return null;
  const line = closingLine(liveLoan);
  return (
    <button type="button" onClick={onOpen} data-loan-timeline-chip
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", width: "100%", minHeight: 52, padding: "10px 18px", marginTop: 16, marginBottom: 4, borderRadius: 9999, background: T.card, border: `1px solid ${T.cardBorder}`, boxShadow: T.cardShadow, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 9999, background: T.green, flexShrink: 0 }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{liveLoan.stage_label}</span>
        {line && <span style={{ fontSize: 14, color: T.textSecondary }}>{line}</span>}
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 14, fontWeight: 600, color: T.blue, flexShrink: 0 }}>
        Loan timeline<Icon name="chevron-right" size={14} color={T.blue} />
      </span>
    </button>
  );
}

export default function LoanTimelineTab({ T, isDesktop, isBorrower, liveLoan, clientName, Sec, Note }) {
  if (!liveLoan) return null;
  const { phases, steps, key_dates: kd = {}, stage } = liveLoan;
  const funded = FUNDED.has(stage);
  const closing = kd.closing;
  const n = daysUntil(closing);
  const headline = funded ? "Your loan has funded" : (HEADLINE[stage] || "Your loan is in process");
  const updated = liveLoan.updated_at ? new Date(liveLoan.updated_at) : null;
  const updatedText = updated && !isNaN(updated)
    ? updated.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  const keyDates = [
    ["Loan contingency removal", kd.loan_contingency],
    ["Appraisal contingency removal", kd.appraisal_contingency],
    [funded ? "Closed" : "Closing", closing],
    ["Rate lock expires", funded ? null : kd.lock_expiration],
    ["First payment due", kd.first_payment],
  ].filter(([, v]) => parseYmd(v));

  const card = { background: T.card, borderRadius: 16, boxShadow: T.cardShadow, border: `1px solid ${T.cardBorder}` };
  const stepState = (s) => (s.status === "Done" ? "done" : s.status === "In progress" ? "now" : "todo");
  const stepTag = (s) => (s.status === "Done" ? "Done" : s.date ? "Target" : s.status === "In progress" ? "In progress" : "");

  return (
    <div data-loan-timeline style={{ marginTop: 20, fontFamily: FONT }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 16, padding: "0 4px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...micro(T), fontSize: 11, marginBottom: 6 }}>Loan timeline{!isBorrower && clientName ? ` · ${clientName}` : ""}</div>
          <h1 style={{ margin: 0, fontSize: isDesktop ? 28 : 23, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em", color: T.text }}>
            {isBorrower ? headline : liveLoan.stage_label}
          </h1>
        </div>
        {updatedText && <div style={{ fontSize: 13, color: T.textSecondary }}>Updated {updatedText}</div>}
      </div>

      {/* Where it stands: the countdown and the six phases. */}
      <div style={{ ...card, padding: isDesktop ? "24px 26px" : "20px 18px", marginBottom: 12 }}>
        {!funded && n !== null && n >= 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "8px 20px", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: isDesktop ? 48 : 42, lineHeight: 1, fontWeight: 700, letterSpacing: "-0.03em", color: T.text }}>{n === 0 ? "Today" : n}</span>
              {n > 0 && <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>{n === 1 ? "day to closing" : "days to closing"}</span>}
              {n === 0 && <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>is closing day</span>}
            </div>
            <div style={{ fontSize: 14, color: T.textSecondary }}>Target closing <strong style={{ color: T.text, fontWeight: 600 }}>{fmtLong(closing)}</strong></div>
          </div>
        )}
        {!funded && n !== null && n < 0 && (
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 18 }}>Target closing was <strong style={{ color: T.text, fontWeight: 600 }}>{fmtLong(closing)}</strong>. Your loan officer will update it.</div>
        )}
        {funded && closing && (
          <div style={{ fontSize: 14, color: T.textSecondary, marginBottom: 18 }}>Closed <strong style={{ color: T.text, fontWeight: 600 }}>{fmtLong(closing)}</strong></div>
        )}

        {isDesktop ? (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))`, gap: 10 }}>
            {phases.map((p) => (
              <div key={p.id} data-phase={p.id} data-state={p.state} style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                <span aria-hidden="true" style={{ height: 6, borderRadius: 9999, background: p.state === "done" ? T.green : p.state === "now" ? `linear-gradient(90deg, ${T.blue} 0%, ${T.blue} 55%, ${T.ringTrack} 55%)` : T.ringTrack }} />
                <span style={micro(T)}>{PHASE_TAG[p.state]}</span>
                <span style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25, color: T.text }}>{p.label}</span>
                <span style={{ fontSize: 13, color: T.textSecondary }}>{phaseDate(p)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {phases.map((p, i) => (
              <div key={p.id} data-phase={p.id} data-state={p.state} style={{ display: "flex", gap: 14, minHeight: 54 }}>
                <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 22, flexShrink: 0 }}>
                  <Mark T={T} state={p.state} />
                  {i < phases.length - 1 && <span style={{ flex: 1, width: 2, background: T.separator }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", gap: 10, paddingBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: T.text }}>{p.label}</span>
                  <span style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: T.text }}>{p.date ? fmtShort(p.date) : ""}</span>
                    <span style={micro(T)}>{p.state === "done" ? "Done" : p.date ? "Target" : PHASE_TAG[p.state]}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: "0 20px", alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <Sec title="Step by step" hero>
            <div style={{ ...card, padding: "4px 20px 6px", marginBottom: 12 }}>
              {steps.map((s, i) => (
                <div key={s.key} data-step={s.key} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "12px 0", borderBottom: i < steps.length - 1 ? `1px solid ${T.separator}` : "none" }}>
                  <span style={{ marginTop: 1, display: "inline-flex" }}><Mark T={T} state={stepState(s)} /></span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: s.status === "Done" ? 500 : 600, lineHeight: 1.4, color: s.status === "Done" ? T.textSecondary : T.text }}>{s.label}</span>
                  <span style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: T.text }}>{fmtShort(s.date)}</span>
                    <span style={micro(T)}>{stepTag(s)}</span>
                  </span>
                </div>
              ))}
            </div>
          </Sec>
        </div>

        <div style={{ minWidth: 0 }}>
          {keyDates.length > 0 && (
            <Sec title="Key dates" hero>
              <div style={{ ...card, padding: "4px 20px 6px", marginBottom: 12 }}>
                {keyDates.map(([label, v], i) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "12px 0", borderBottom: i < keyDates.length - 1 ? `1px solid ${T.separator}` : "none" }}>
                    <span style={{ fontSize: 14, color: T.textSecondary }}>{label}</span>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: T.text, textAlign: "right" }}>{fmtKey(v)}</span>
                  </div>
                ))}
              </div>
            </Sec>
          )}
          <div style={{ marginTop: keyDates.length ? 0 : 20 }}>
            <Note>Dates marked target are estimates and can move. This page updates from the same file your loan officer works in.</Note>
            {!isBorrower && (
              <Note title="This is what your client sees"
                action={<a href="https://ops.realstack.app/#live" target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 9999, background: T.pillBg, color: T.text, fontSize: 13, fontWeight: 600, fontFamily: FONT, textDecoration: "none" }}>Open Ops</a>}>
                Internal steps stay in Ops. Change a step or a date on the loan's Timeline tab there and it shows here after the next sync.
              </Note>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
