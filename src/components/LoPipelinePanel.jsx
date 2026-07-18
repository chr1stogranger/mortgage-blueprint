/**
 * LoPipelinePanel — a signed-in LO's live loan pipeline, inside Blueprint.
 *
 * Data: GET {API_BASE}/api/pipeline-data?_route=my-pipeline via authFetch
 * (fetchMyPipeline in src/api.js). The Ops server filters to the
 * AUTHENTICATED LO's own loans — nothing another LO owns can appear here.
 *
 * v2 (2026-07-17): rows are classified Live vs Leads (server `class` field:
 * "live" | "funded" | "lead"; leads arrive in a separate `leads` array).
 * Segmented filter pills All | Live | Leads + borrower-name search. Rows
 * whose borrower email matched a Blueprint client (`bpClientId`) get a
 * "Blueprint" pill that opens that client in-app via onOpenClient.
 * Backward-compatible: against an older Ops deploy (no `class`/`leads`)
 * every loan is treated as live and no leads/links render.
 *
 * Layout (Grange): glass stat tiles (chrome) up top — Active loans / Leads /
 * Closed YTD / Funded volume YTD — then a SOLID T.card list (dense data
 * stays solid) grouped by milestone. FONT for names + figures (tabular-nums
 * is global), MONO only for the uppercase micro-labels. Pill radius 9999,
 * shared Icon, no emojis.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FONT, MONO } from "../lib/fonts.js";
import Icon from "../Icon.jsx";
import { fetchMyPipeline } from "../api.js";
import PipelineImportModal from "./PipelineImportModal.jsx";

// Milestone group order — mirrors the server's MY_PIPELINE_MILESTONES labels.
const MILESTONE_ORDER = [
  "Loan Setup", "Disclosures Out", "In Underwriting", "Conditions",
  "Clear to Close", "Docs & Signing", "Funded", "In Process",
];

// Lead-stage group order — mirrors MY_PIPELINE_LEAD_MILESTONES on the server.
const LEAD_MILESTONE_ORDER = ["Application", "Qualification", "Pre-Approved", "Leads"];

const LEAD_STATUSES = new Set(["APPLICATION_INTAKE", "QUALIFICATION", "PREAPPROVED"]);

function statusColor(status, T) {
  const s = String(status || "").toUpperCase();
  if (LEAD_STATUSES.has(s)) return T.purple; // leads — distinct from loan blues; green stays funded/CTC-only
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
    APPLICATION_INTAKE: "Application", QUALIFICATION: "Qualifying",
    PREAPPROVED: "Pre-Approved",
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

export default function LoPipelinePanel({ T, FONT: FONT_PROP, auth, isDesktop, onOpenClient, importCtx }) {
  const font = FONT_PROP || FONT;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { kind: 'auth' | 'network', message }
  const [fetchedAt, setFetchedAt] = useState(null);
  const [filter, setFilter] = useState("all"); // 'all' | 'live' | 'leads'
  const [query, setQuery] = useState("");
  // Import-from-Arive (2026-07-18): the row currently in the import modal, and
  // rowId → Blueprint client id for rows imported this session (flips the
  // Import pill to the normal Blueprint pill without waiting for a refetch).
  const [importRow, setImportRow] = useState(null);
  const [importedIds, setImportedIds] = useState({});
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
  // Older deployed Ops has no `leads` array / `class` field — degrade to
  // live-only (missing class counts as "live", leads simply absent).
  const leads = Array.isArray(data?.leads) ? data.leads : [];
  const rowClass = (l) => l.class || "live";
  const activeCount = loans.filter((l) => rowClass(l) === "live").length;

  const q = query.trim().toLowerCase();
  const matches = (l) => !q || String(l.borrower || "").toLowerCase().includes(q);
  const visibleLoans = filter === "leads" ? [] : loans.filter(matches);
  const visibleLeads = filter === "live" ? [] : leads.filter(matches);

  // Group by milestone, in pipeline order — live groups first, lead groups after.
  const loanGroups = MILESTONE_ORDER
    .map((m) => [m, visibleLoans.filter((l) => (l.milestone || "In Process") === m)])
    .filter(([, list]) => list.length > 0);
  const leadGroups = LEAD_MILESTONE_ORDER
    .map((m) => [m, visibleLeads.filter((l) => (l.milestone || "Leads") === m)])
    .filter(([, list]) => list.length > 0);
  const groups = [...loanGroups, ...leadGroups];
  const visibleCount = visibleLoans.length + visibleLeads.length;

  const microLabel = {
    fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: 1.2,
    textTransform: "uppercase", color: T.textTertiary,
  };

  const glassTile = {
    flex: 1, minWidth: 108, padding: "14px 16px", borderRadius: 16,
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

  const emptyCard = (icon, title, sub) => (
    <div style={{ padding: "40px 24px", textAlign: "center", background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16 }}>
      <Icon name={icon} size={22} style={{ color: T.textTertiary }} />
      <div style={{ marginTop: 10, fontFamily: font, fontSize: 14, fontWeight: 600, color: T.text }}>{title}</div>
      <div style={{ marginTop: 4, fontFamily: font, fontSize: 12.5, color: T.textSecondary }}>{sub}</div>
    </div>
  );

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
      <div style={{ display: "flex", gap: 10, flexWrap: isDesktop ? "nowrap" : "wrap", marginBottom: 14 }}>
        {[
          ["Active Loans", loading && !data ? "…" : String(activeCount)],
          ["Leads", loading && !data ? "…" : (data && !Array.isArray(data.leads) ? "—" : String(leads.length))],
          ["Closed YTD", loading && !data ? "…" : String(data?.closedYTD ?? "—")],
          ["Funded Volume YTD", loading && !data ? "…" : fmtVolume(data?.fundedVolumeYTD)],
        ].map(([label, value]) => (
          <div key={label} style={glassTile}>
            <div style={microLabel}>{label}</div>
            <div style={{ marginTop: 6, fontFamily: font, fontSize: 24, fontWeight: 700, color: T.text }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter pills (All | Live | Leads) + borrower search */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          ["all", "All", loans.length + leads.length],
          ["live", "Live", loans.length],
          ["leads", "Leads", leads.length],
        ].map(([key, label, count]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                ...pillBtn,
                background: active ? T.accent : T.glass,
                border: active ? `1px solid ${T.accent}` : `1px solid ${T.glassBorder}`,
                color: active ? "#fff" : T.text,
              }}
            >
              {label}
              <span style={{ ...microLabel, fontSize: 9.5, color: active ? "rgba(255,255,255,0.75)" : T.textTertiary }}>
                {count}
              </span>
            </button>
          );
        })}
        <div style={{ flex: 1, minWidth: 160, maxWidth: 320, display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9999, background: T.inputBg, border: `1px solid ${T.inputBorder}` }}>
          <Icon name="search" size={13} style={{ color: T.textTertiary, flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search borrower…"
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: font, fontSize: 12.5, color: T.text }}
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="Clear search" style={{ display: "inline-flex", padding: 0, background: "none", border: "none", cursor: "pointer", color: T.textTertiary }}>
              <Icon name="x" size={13} />
            </button>
          ) : null}
        </div>
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

      {/* Empty states */}
      {!loading && !error && data && visibleCount === 0 && (
        q
          ? emptyCard("search", "No matches", `Nothing in ${filter === "all" ? "your pipeline" : filter === "live" ? "live loans" : "leads"} matches "${query.trim()}".`)
          : filter === "leads"
            ? emptyCard("user", "No leads right now", "Arive leads assigned to you (Application, Qualification, Pre-Approved) will show up here.")
            : filter === "live"
              ? emptyCard("clipboard", "No active loans right now", "New Arive files assigned to you will show up here automatically.")
              : emptyCard("clipboard", "Nothing in your pipeline yet", "Arive loans and leads assigned to you will show up here automatically.")
      )}

      {/* Milestone-grouped list — solid card (dense data stays solid) */}
      {data && visibleCount > 0 && groups.map(([milestone, list]) => (
        <div key={milestone} style={{ marginBottom: 14 }}>
          <div style={{ ...microLabel, padding: "0 4px 6px" }}>{milestone} · {list.length}</div>
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 14, overflow: "hidden" }}>
            {list.map((l, i) => {
              const sc = statusColor(l.status, T);
              const isLead = rowClass(l) === "lead";
              // A row imported this session flips to the Blueprint pill via
              // importedIds without waiting for the next server refetch.
              const bpId = l.bpClientId || importedIds[l.id] || null;
              const canOpenBp = Boolean(bpId && onOpenClient);
              const canImport = Boolean(!bpId && importCtx);
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
                  {canImport && (
                    <button
                      onClick={() => setImportRow(l)}
                      title={`Import ${l.borrower || "this file"} from Arive into Blueprint`}
                      style={{
                        flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 9999, cursor: "pointer",
                        background: "transparent", border: `1px dashed ${T.accent}50`,
                        color: T.accent, fontFamily: font, fontSize: 11, fontWeight: 700,
                      }}
                    >
                      <Icon name="download" size={11} />
                      {isDesktop ? "Import" : null}
                    </button>
                  )}
                  {canOpenBp && (
                    <button
                      onClick={() => onOpenClient({ borrowerId: bpId, borrowerName: l.borrower || "" })}
                      title={`Open ${l.borrower || "this client"} in Blueprint`}
                      style={{
                        flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "3px 10px", borderRadius: 9999, cursor: "pointer",
                        background: `${T.accent}14`, border: `1px solid ${T.accent}40`,
                        color: T.accent, fontFamily: font, fontSize: 11, fontWeight: 700,
                      }}
                    >
                      <Icon name="external-link" size={11} />
                      {isDesktop ? "Blueprint" : "BP"}
                    </button>
                  )}
                  <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", background: `${sc}18`, color: sc, borderRadius: 9999, padding: "3px 10px", fontFamily: font, fontSize: 11, fontWeight: 700 }}>
                    {shortStatus(l.status)}
                  </span>
                  <span
                    title={isLead ? "Lead received" : "Estimated closing"}
                    style={{ flexShrink: 0, minWidth: 52, textAlign: "right", fontFamily: font, fontSize: 12, fontWeight: 500, color: (isLead ? l.created : l.estClosing) ? T.textSecondary : T.textTertiary }}
                  >
                    {fmtDate(isLead ? l.created : l.estClosing)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Import-from-Arive confirm + email flow */}
      {importCtx && (
        <PipelineImportModal
          open={!!importRow}
          row={importRow}
          T={T}
          fetchPayload={importCtx.fetchPayload}
          createClient={importCtx.create}
          loInfo={importCtx.loInfo}
          onClose={(result) => {
            if (result?.borrowerId && importRow) {
              setImportedIds((prev) => ({ ...prev, [importRow.id]: result.borrowerId }));
            }
            setImportRow(null);
          }}
        />
      )}
    </div>
  );
}
