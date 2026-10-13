import React, { useEffect, useState } from "react";
import { FONT, MONO } from "../lib/fonts.js";
import Icon from "../Icon";
import BottomSheet from "../BottomSheet";
import { buildCalcSummary } from "../lib/calcSummary.js";
import { fetchScenarioVersions, fetchDeletedScenarios } from "../lib/supabaseClient";
import { whenLabel } from "../lib/whenLabel.js";

// ── Version history (Christo 2026-10-13) ──
// Lists a scenario's earlier versions (migration 024: automatic every 10 min
// of edits, "Before restore", and copies of deleted scenarios) with Restore
// and Open as a copy. LOs also get the client's recently deleted scenarios.

const money = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 1 : 2).replace(/\.?0+$/, "")}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
};

function summaryLine(state) {
  if (!state || typeof state !== "object") return "";
  const s = buildCalcSummary(state);
  const bits = [];
  if (s.salesPrice > 0) bits.push(money(s.salesPrice));
  if (s.salesPrice > 0) bits.push(`${Number(s.downPct) || 0}% down`);
  if (s.rate > 0) bits.push(`${Number(s.rate).toFixed(3).replace(/0$/, "")}%`);
  if (s.monthlyPI > 0) bits.push(`P&I $${Math.round(s.monthlyPI).toLocaleString("en-US")}`);
  return bits.join(" · ");
}

function kindLabel(v) {
  if (v.kind === "deleted") return "Deleted";
  if (v.kind === "named") return v.label || "Saved version";
  return "Autosave";
}

export default function VersionHistorySheet({
  T, isOpen, onClose, scenarioId, scenarioName, borrowerId,
  canRestore = true, canCopy = true, showDeleted = false,
  onRestore, onOpenCopy, onRecoverDeleted,
}) {
  const [state, setState] = useState({ loading: true, versions: [], missing: false });
  const [deleted, setDeleted] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let dead = false;
    setOpenId(null);
    setState(s => ({ ...s, loading: true }));
    (async () => {
      const r = await fetchScenarioVersions(scenarioId);
      if (!dead) setState({ loading: false, versions: r.versions || [], missing: !!r.missing });
      if (showDeleted && borrowerId) {
        const d = await fetchDeletedScenarios(borrowerId);
        if (!dead) setDeleted(d);
      } else if (!dead) setDeleted([]);
    })();
    return () => { dead = true; };
  }, [isOpen, scenarioId, borrowerId, showDeleted]);

  const act = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  };

  const pill = (primary) => ({
    display: "inline-flex", alignItems: "center", gap: 6, minHeight: 34, padding: "0 14px", borderRadius: 9999,
    border: primary ? "none" : `1px solid ${T.cardBorder}`, background: primary ? T.blue : T.card,
    color: primary ? "#fff" : T.text, fontSize: 12.5, fontWeight: 600, fontFamily: FONT, cursor: "pointer",
  });
  const microline = { fontSize: 10, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", color: T.textTertiary, padding: "14px 20px 6px" };

  const row = (v, actions) => {
    const open = openId === v.id;
    return (
      <div key={v.id} style={{ borderBottom: `1px solid ${T.separator}` }}>
        <button type="button" onClick={() => setOpenId(open ? null : v.id)} aria-expanded={open}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: open ? T.pillBg : "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: FONT }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{whenLabel(v.as_of || v.created_at)}</div>
            <div style={{ fontSize: 12, color: T.textTertiary, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {v.kind === "deleted" ? `${v.name || "Scenario"} · ` : ""}{kindLabel(v)}{v.saved_by === "borrower" && v.kind === "named" ? " (borrower)" : ""}
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: T.textSecondary, whiteSpace: "nowrap", textAlign: "right" }}>{summaryLine(v.state_data)}</div>
          <Icon name={open ? "chevron-up" : "chevron-down"} size={14} color={T.textTertiary} />
        </button>
        {open && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 20px 14px" }}>{actions}</div>}
      </div>
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} T={T} title="Version history" height="78vh">
      <div style={{ overflowY: "auto", flex: 1, paddingBottom: 12, fontFamily: FONT }}>
        <div style={{ padding: "12px 20px 4px", fontSize: 13, color: T.textSecondary, lineHeight: 1.5 }}>
          <strong style={{ color: T.text }}>{scenarioName}</strong>. Blueprint keeps a version every 10 minutes while it's being edited. Restoring saves the current numbers as a version first, so you can always go back.
        </div>
        {state.loading ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: T.textTertiary }}>Loading versions…</div>
        ) : state.missing ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: T.textTertiary }}>Version history turns on after the database update.</div>
        ) : state.versions.length === 0 ? (
          <div style={{ padding: "24px 20px", fontSize: 13, color: T.textTertiary }}>No earlier versions yet. The first one is kept the next time this scenario changes.</div>
        ) : (<>
          <div style={microline}>Earlier versions</div>
          {state.versions.map(v => row(v, (<>
            {canRestore && (
              <button type="button" style={pill(true)} disabled={!!busy}
                onClick={() => act(v.id + ":restore", async () => { await onRestore?.(v); onClose(); })}>
                <Icon name="rotate-ccw" size={13} color="#fff" />{busy === v.id + ":restore" ? "Restoring…" : "Restore this version"}
              </button>
            )}
            {canCopy && (
              <button type="button" style={pill(false)} disabled={!!busy}
                onClick={() => act(v.id + ":copy", async () => { await onOpenCopy?.(v); onClose(); })}>
                <Icon name="copy" size={13} color={T.textSecondary} />{busy === v.id + ":copy" ? "Opening…" : "Open as a copy"}
              </button>
            )}
            {!canRestore && !canCopy && <div style={{ fontSize: 12, color: T.textTertiary }}>This scenario is view-only.</div>}
          </>)))}
        </>)}
        {showDeleted && deleted.length > 0 && (<>
          <div style={microline}>Recently deleted from this client</div>
          {deleted.map(v => row(v, (
            <button type="button" style={pill(true)} disabled={!!busy}
              onClick={() => act(v.id + ":recover", async () => { await onRecoverDeleted?.(v); onClose(); })}>
              <Icon name="rotate-ccw" size={13} color="#fff" />{busy === v.id + ":recover" ? "Bringing it back…" : "Bring it back"}
            </button>
          )))}
        </>)}
      </div>
    </BottomSheet>
  );
}
