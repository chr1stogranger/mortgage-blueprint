import React from "react";
import { FONT } from "../lib/fonts.js";
import Icon from "../Icon";
import { BUREAUS, SCORE_MAX, qualifyingScore, reportDates, cleanReport, hasVantage } from "../lib/creditReport.js";

// Debts tab, below the summary: Credit Report. The three bureaus side by side:
// FICO, VantageScore, and the date each was pulled. The middle FICO is the
// one that qualifies the loan, so it is marked and offered to the scenario's
// credit score. LO-entered; a share-link borrower sees it read-only, and only
// once it has scores in it.

const RULE_LABEL = { middle: "Middle score", lower: "Lower of two", only: "Only score" };
const fmtLong = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtShort = (d) => d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" });
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };

export default function CreditReportCard({ T, isDesktop, Sec, Card, creditReport, setCreditReport, canEdit, creditScore, setCreditScore, ficoMin, loanType }) {
  const [draft, setDraft] = React.useState(null);
  const editing = draft !== null;
  const report = creditReport || null;

  if (!report && !canEdit) return null;

  const startEdit = () => {
    const d = {};
    for (const b of BUREAUS) {
      const r = report?.[b.key] || {};
      d[b.key] = { fico: r.fico ? String(r.fico) : "", vantage: r.vantage ? String(r.vantage) : "", pulled: r.pulled || "" };
    }
    setDraft(d);
  };
  const patch = (key, field, value) => setDraft((d) => {
    const next = { ...d, [key]: { ...d[key], [field]: value } };
    // A tri-merge is one pull: the first date entered fills the blanks.
    if (field === "pulled" && value) for (const b of BUREAUS) if (!next[b.key].pulled) next[b.key] = { ...next[b.key], pulled: value };
    return next;
  });
  const save = () => {
    const raw = {};
    for (const b of BUREAUS) raw[b.key] = { fico: parseInt(draft[b.key].fico, 10) || 0, vantage: parseInt(draft[b.key].vantage, 10) || 0, pulled: draft[b.key].pulled };
    const clean = cleanReport(raw);
    setCreditReport(clean);
    const q = qualifyingScore(clean);
    if (q.score > 0) setCreditScore(q.score);
    setDraft(null);
  };

  const label = { fontSize: 12, fontWeight: 600, color: T.textSecondary, fontFamily: FONT };
  const sub = { fontSize: 10.5, color: T.textTertiary, fontFamily: FONT, fontWeight: 500 };
  const pill = (primary) => ({ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 9999, padding: "8px 16px", fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer", border: primary ? "none" : `1px solid ${T.inputBorder}`, background: primary ? T.blue : "transparent", color: primary ? "#fff" : T.text });
  const input = { width: "100%", minWidth: 0, boxSizing: "border-box", background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: 10, padding: "8px 6px", color: T.text, fontSize: 16, fontWeight: 600, fontFamily: FONT, outline: "none", textAlign: "center", fontVariantNumeric: "tabular-nums" };

  // ── Empty: one line and a way in ──
  if (!report && !editing) {
    return (
      <Sec title="Credit Report">
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, lineHeight: 1.5, flex: "1 1 220px" }}>
              List the score from each bureau and the date it was pulled. The middle FICO becomes the qualifying score.
            </div>
            <button onClick={startEdit} style={pill(true)}><Icon name="plus" size={14} />Add bureau scores</button>
          </div>
        </Card>
      </Sec>
    );
  }

  // ── Editing: one row per bureau (fits a phone; date inputs are wide) ──
  if (editing) {
    const scoreInput = (b, field, name) => (
      <input type="text" inputMode="numeric" aria-label={`${b.name} ${name}`} placeholder="—" value={draft[b.key][field]}
        onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); patch(b.key, field, v === "" ? "" : String(Math.min(parseInt(v, 10), SCORE_MAX))); }}
        style={input} />
    );
    const cols = isDesktop ? "140px 1fr 1fr 1.4fr" : "1fr 1fr 2.2fr";
    return (
      <Sec title="Credit Report">
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: cols, columnGap: 10, rowGap: 8, alignItems: "center" }}>
            {isDesktop && <div />}
            <div style={{ ...label, textAlign: "center" }}>FICO</div>
            <div style={{ ...label, textAlign: "center" }}>VantageScore</div>
            <div style={{ ...label, textAlign: "center" }}>Pulled</div>
            {BUREAUS.map((b) => (
              <React.Fragment key={b.key}>
                <div style={{ gridColumn: isDesktop ? "auto" : "1 / -1", marginTop: isDesktop ? 0 : 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: FONT }}>{b.name}</span>
                  <span style={{ ...sub, marginLeft: 8 }}>{b.ficoModel}</span>
                </div>
                {scoreInput(b, "fico", "FICO")}
                {scoreInput(b, "vantage", "VantageScore")}
                <input type="date" aria-label={`${b.name} pull date`} value={draft[b.key].pulled} max={ymd(new Date())}
                  onChange={(e) => patch(b.key, "pulled", e.target.value)}
                  style={{ ...input, fontSize: isDesktop ? 14 : 16, fontWeight: 500, padding: "8px 4px" }} />
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.separator}` }}>
            <div style={sub}>VantageScore is optional. Saving sets the scenario's credit score to the middle FICO.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setDraft(null)} style={pill(false)}>Cancel</button>
              <button onClick={save} style={pill(true)}>Save scores</button>
            </div>
          </div>
        </Card>
      </Sec>
    );
  }

  // ── Read view ──
  const q = qualifyingScore(report);
  const showVantage = hasVantage(report);
  const dates = reportDates(report);
  const fmtDate = isDesktop ? fmtLong : fmtShort;
  const meets = q.score > 0 && q.score >= ficoMin;
  const status = !dates ? null
    : dates.daysLeft < 0 ? { color: T.red, text: `Expired ${fmtLong(dates.goodThrough)}` }
    : dates.daysLeft <= 14 ? { color: T.orange, text: `Expires in ${dates.daysLeft} day${dates.daysLeft === 1 ? "" : "s"}` }
    : { color: T.green, text: `Good through ${fmtLong(dates.goodThrough)}` };
  const cell = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "10px 2px", borderTop: `1px solid ${T.separator}`, minWidth: 0 };
  const rowLabel = { ...label, display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px 0", borderTop: `1px solid ${T.separator}` };
  const num = (big) => ({ fontSize: big ? (isDesktop ? 26 : 22) : (isDesktop ? 18 : 16), fontWeight: big ? 700 : 600, color: T.text, fontFamily: FONT, lineHeight: 1.15, letterSpacing: "-0.01em" });

  return (
    <Sec title="Credit Report">
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT }}>
            {!dates ? "No pull date entered" : dates.sameDay ? `Pulled ${fmtLong(dates.oldest)}` : `Pulled ${fmtLong(dates.oldest)} to ${fmtLong(dates.newest)}`}
          </div>
          {status && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${status.color}18`, color: status.color, borderRadius: 9999, padding: "4px 11px", fontSize: 12, fontWeight: 700, fontFamily: FONT, whiteSpace: "nowrap" }}>
              <Icon name="clock" size={12} />{status.text}
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `${isDesktop ? 130 : 74}px repeat(3, minmax(0, 1fr))`, columnGap: isDesktop ? 8 : 4 }}>
          <div />
          {BUREAUS.map((b) => (
            <div key={b.key} style={{ textAlign: "center", paddingBottom: 8, minWidth: 0 }}>
              <div style={{ fontSize: isDesktop ? 13 : 12, fontWeight: 700, color: T.text, fontFamily: FONT }}>{b.name}</div>
              <div style={sub}>{b.ficoModel}</div>
            </div>
          ))}

          <div style={rowLabel}>FICO</div>
          {BUREAUS.map((b) => {
            const s = report[b.key]?.fico || 0;
            const isQ = q.key === b.key;
            return (
              <div key={b.key} style={{ ...cell, ...(isQ ? { borderTop: "none", boxShadow: `inset 0 0 0 1.5px ${T.blue}`, borderRadius: 12 } : {}) }}>
                <span style={{ ...num(true), color: s ? (isQ ? T.blue : T.text) : T.textTertiary }}>{s || "—"}</span>
                {isQ && <span style={{ fontSize: 10.5, fontWeight: 700, color: T.blue, fontFamily: FONT, whiteSpace: "nowrap" }}>{RULE_LABEL[q.rule]}</span>}
              </div>
            );
          })}

          {showVantage && <>
            <div style={rowLabel}>{isDesktop ? "VantageScore" : "Vantage"}<span style={sub}>4.0</span></div>
            {BUREAUS.map((b) => {
              const s = report[b.key]?.vantage || 0;
              return <div key={b.key} style={cell}><span style={{ ...num(false), color: s ? T.text : T.textTertiary }}>{s || "—"}</span></div>;
            })}
          </>}

          <div style={rowLabel}>Pulled</div>
          {BUREAUS.map((b) => {
            const d = parse(report[b.key]?.pulled);
            return <div key={b.key} style={cell}><span style={{ fontSize: isDesktop ? 13 : 12, fontWeight: 500, color: d ? T.text : T.textTertiary, fontFamily: FONT, whiteSpace: "nowrap" }}>{d ? fmtDate(d) : "—"}</span></div>;
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", paddingTop: 12, borderTop: `1px solid ${T.separator}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: T.textSecondary, fontFamily: FONT, flex: "1 1 220px" }}>
            {q.score > 0 ? <>
              <Icon name={meets ? "check" : "x"} size={15} style={{ color: meets ? T.green : T.red, flexShrink: 0 }} />
              <span>Qualifying FICO <strong style={{ color: T.text }}>{q.score}</strong> · {loanType} needs {ficoMin}+
                {creditScore > 0 && creditScore !== q.score && <> · this scenario is using <strong style={{ color: T.text }}>{creditScore}</strong></>}
              </span>
            </> : <span>Enter a FICO score to set the qualifying score.</span>}
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 8 }}>
              {q.score > 0 && creditScore !== q.score && <button onClick={() => setCreditScore(q.score)} style={pill(true)}>Use {q.score}</button>}
              <button onClick={startEdit} style={pill(false)}><Icon name="edit" size={14} />Edit scores</button>
            </div>
          )}
        </div>
      </Card>
    </Sec>
  );
}
