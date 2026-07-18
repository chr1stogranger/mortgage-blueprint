/**
 * LoPipelinePanel — a signed-in LO's live loan pipeline, inside Blueprint.
 *
 * Data: GET {API_BASE}/api/pipeline-data?_route=my-pipeline via authFetch
 * (fetchMyPipeline in src/api.js). The Ops server filters to the
 * AUTHENTICATED LO's own loans — nothing another LO owns can appear here.
 *
 * Layout (Grange): glass stat tiles (chrome) up top — Active loans /
 * Closed YTD / Funded volume YTD — then a SOLID T.card list (dense data
 * stays solid) grouped by milestone. FONT for names + figures (tabular-nums
 * is global), MONO only for the uppercase micro-labels. Pill radius 9999,
 * shared Icon, no emojis.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FONT, MONO } from "../lib/fonts.js";
import Icon from "../Icon.jsx";
import { fetchMyPipeline } from "../api.js";

// Milestone group order — mirrors the server's MY_PIPELINE_MILESTONES labels.
const MILESTONE_ORDER = [
  "Loan Setup", "Disclosures Out", "In Underwriting", "Conditions",
  "Clear to Close", "Docs & Signing", "Funded", "In Process",
];

function statusColor(status, T) {
  const s = String(status || "").toUpperCase();
  if (s.includes("FUNDED") || s.includes("COMMISSION") || s.includes("BROKER_CHECK") || s.includes("CLEAR_TO_CLOSE")) return T.green;
  if (s.includes("CONDITION")) return T.orange;
  if (s.includes("SUSPEND") || s.includes("ADVERSE") || s.includes("DENIED") || s.includes("WITHDRAWN")) return T.red;
  return T.accent; // in-process default
}

function shortStatus(status) {
  const MAP = {
    LOAN_SETUP: "Setup", DISCLOSURE_SENT: "Disclosed",
    UNDERWRITING_SUBMITTED: "In UW", RE_SUBMITTAL: "Resubmitted",
    APPROVED_WITH_CONDITION: "Conditions", CLEAR_TO_CLOSE: "CTC",
    DOCS_OUT: "Docs Out", DOCS_SIGNED: "Docs Signed",
    LOAN_FUNDED: "Funded", BROKER_CHECK_RECEIVED: "Funded",
    COMMISSION_PAID: "Funded",
  };
  return MAP[status] || String(status || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || "—";
}

function fmtMoney(n) {
  if (!Number.isFinite(Number(n)) || !n) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n));
}

function fmtVolume(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${v}`;
}

function fmtRate(r) {
  const n = Number(r);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const pctVal = n <= 1 ? n * 100 : n; // tolerate decimal (0.06125) or percent (6.125) forms
  return `${pctVal.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

// Date-only strings parse as UTC and can display a day early — pin to local noon.
function fmtDate(s) {
  if (!s) return "—";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00` : s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function agoLabel(ts) {
  if (!ts) return "";
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "updated just now";
  if (mins < 60) return `updated ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `updated ${hrs}h ago`;
}

export default function LoPipelinePanel({ T, FONT: FONT_PROP, auth, isDesktop }) {
  const font = FONT_PROP || FONT;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { kind: 'auth' | 'network', message }
  const [fetchedAt, setFetchedAt] = useState(null);
  const [, setTick] = useState(0); // re-render so "updated Xm ago" stays honest
  const mounted = useRef(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMyPipeline();
      if (!mounted.current) return;
      setData(res);
      setFetchedAt(Date.now());
    } catch (e) {
      if (!mounted.current) return;
      const msg = String(e?.message || "");
      // authFetch clears bp_token and throws these on 401 / missing token —
      // same signals the borrowers/scenarios calls surface for re-auth.
      const isAuth = msg.includes("Session expired") || msg.includes("Not authenticated");
      setError({ kind: isAuth ? "auth" : "network", message: msg });
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => { mounted.current = false; clearInterval(t); };
  }, [load]);

  const loans = data?.loans || [];

  // Group by milestone, in pipeline order.
  const groups = MILESTONE_ORDER
    .map((m) => [m, loans.filter((l) => (l.milestone || "In Process") === m)])
    .filter(([, list]) => list.length > 0);

  const microLabel = {
    fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: 1.2,
    textTransform: "uppercase", color: T.textTertiary,
  };

  const glassTile = {
    flex: 1, minWidth: 120, padding: "14px 16px", borderRadius: 16,
    background: T.glass, border: `1px solid ${T.glassBorder}`,
    boxShadow: T.glassShadow, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
  };

  const pillBtn = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "6px 14px", borderRadius: 9999, cursor: "pointer",
    background: T.glass, border: `1px solid ${T.glassBorder}`,
    color: T.text, fontFamily: font, fontSize: 12, fontWeight: 600,
    backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
  };

  // ── Session expired → re-auth prompt ──
  if (error?.kind === "auth") {
    return (
      <div style={{ marginTop: 16, padding: "36px 24px", textAlign: "center", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16 }}>
        <Icon name="lock" size={22} style={{ color: T.textTertiary }} />
        <div style={{ marginTop: 10, fontFamily: font, fontSize: 14, fontWeight: 600, color: T.text }}>Your session expired</div>
        <div style={{ marginTop: 4, fontFamily: font, fontSize: 12.5, color: T.textSecondary }}>Sign in again to see your pipeline.</div>
        <button onClick={() => auth?.requestLogin?.()} style={{ ...pillBtn, marginTop: 14, background: T.accent, border: "none", color: "#fff" }}>
          <Icon name="key" size={13} /> Sign in
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* Header: title + refresh pill + updated caption */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontFamily: font, fontSize: 18, fontWeight: 700, color: T.text }}>My Pipeline</div>
          {data?.lo?.name ? (
            <div style={{ marginTop: 1, fontFamily: font, fontSize: 12, color: T.textTertiary }}>{data.lo.name}</div>
          ) : null}
        </div>
        <span style={{ fontFamily: font, fontSize: 11, color: T.textTertiary }}>{agoLabel(fetchedAt)}</span>
        <button onClick={load} disabled={loading} style={{ ...pillBtn, opacity: loading ? 0.6 : 1 }}>
          <Icon name="refresh-cw" size={13} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Stat tiles — glass (chrome-level summary, not dense data) */}
      <div style={{ display: "flex", gap: 10, flexWrap: isDesktop ? "nowrap" : "wrap", marginBottom: 16 }}>
        {[
          ["Active Loans", loading && !data ? "…" : String(loans.length)],
          ["Closed YTD", loading && !data ? "…" : String(data?.closedYTD ?? "—")],
          ["Funded Volume YTD", loading && !data ? "…" : fmtVolume(data?.fundedVolumeYTD)],
        ].map(([label, value]) => (
          <div key={label} style={glassTile}>
            <div style={microLabel}>{label}</div>
            <div style={{ marginTop: 6, fontFamily: font, fontSize: 24, fontWeight: 700, color: T.text }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Error (network) */}
      {error?.kind === "network" && (
        <div style={{ padding: "20px 18px", textAlign: "center", background: T.errorBg, border: `1px solid ${T.errorBorder}`, borderRadius: 16, marginBottom: 14 }}>
          <div style={{ fontFamily: font, fontSize: 13.5, fontWeight: 600, color: T.red }}>Couldn't reach Ops</div>
          <div style={{ marginTop: 3, fontFamily: font, fontSize: 12, color: T.textSecondary }}>{error.message || "The pipeline service didn't respond."}</div>
          <button onClick={load} style={{ ...pillBtn, marginTop: 12 }}>
            <Icon name="refresh-cw" size={13} /> Retry
          </button>
        </div>
      )}

      {/* Loading skeleton (first load only) */}
      {loading && !data && !error && (
        <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px", borderBottom: i < 3 ? `1px solid ${T.separator}` : "none" }}>
              <div style={{ width: "34%", height: 13, borderRadius: 6, background: T.pillBg }} />
              <div style={{ width: "22%", height: 11, borderRadius: 6, background: T.pillBg, opacity: 0.7 }} />
              <div style={{ marginLeft: "auto", width: 64, height: 18, borderRadius: 9999, background: T.pillBg }} />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && loans.length === 0 && (
        <div style={{ padding: "40px 24px", textAlign: "center", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16 }}>
          <Icon name="clipboard" size={22} style={{ color: T.textTertiary }} />
          <div style={{ marginTop: 10, fontFamily: font, fontSize: 14, fontWeight: 600, color: T.text }}>No active loans right now</div>
          <div style={{ marginTop: 4, fontFamily: font, fontSize: 12.5, color: T.textSecondary }}>
            New Arive files assigned to you will show up here automatically.
          </div>
        </div>
      )}

      {/* Milestone-grouped loan list — solid card (dense data stays solid) */}
      {data && loans.length > 0 && groups.map(([milestone, list]) => (
        <div key={milestone} style={{ marginBottom: 14 }}>
          <div style={{ ...microLabel, padding: "0 4px 6px" }}>{milestone} · {list.length}</div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: "hidden" }}>
            {list.map((l, i) => {
              const sc = statusColor(l.status, T);
              return (
                <div key={l.id || `${milestone}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < list.length - 1 ? `1px solid ${T.separator}` : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: font, fontSize: 13.5, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {l.borrower || "—"}
                    </div>
                    <div style={{ marginTop: 2, fontFamily: font, fontSize: 12, color: T.textSecondary }}>
                      {[l.loanType || null, l.loanAmount ? fmtMoney(l.loanAmount) : null, l.rate ? fmtRate(l.rate) : null].filter(Boolean).join(" · ") || "—"}
                      {l.lender ? <span style={{ color: T.textTertiary }}> · {l.lender}</span> : null}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", background: `${sc}18`, color: sc, borderRadius: 9999, padding: "3px 10px", fontFamily: font, fontSize: 11, fontWeight: 700 }}>
                    {shortStatus(l.status)}
                  </span>
                  <span title="Estimated closing" style={{ flexShrink: 0, minWidth: 52, textAlign: "right", fontFamily: font, fontSize: 12, fontWeight: 500, color: l.estClosing ? T.textSecondary : T.textTertiary }}>
                    {fmtDate(l.estClosing)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
