import { FONT, MONO } from "../lib/fonts.js";
import React, { useState, useEffect, useRef, useCallback } from "react";
import Icon from "../Icon";
import { fetchDealTeam, saveDealTeam, fetchAriveDealTeam, addPartnerToDirectory } from "../api";


// ─── Role model ──────────────────────────────────────────────────────────────
// One slot per role (the deal_team array is the storage; these define the UI).
// dirType = which Ops Partners contact_type feeds the directory picker;
// 'team' = pick from the team_members roster instead.
const ROLE_DEFS = [
  { key: "lo",               label: "Loan Officer",           section: "loan",   dirType: "team" },
  { key: "loa",              label: "Loan Officer Assistant", section: "loan",   dirType: "team" },
  { key: "processor",        label: "Loan Processor",         section: "loan",   dirType: "team" },
  { key: "buyers_agent",     label: "Buyer's Agent",          section: "agents", dirType: "Real Estate Agent" },
  { key: "buyers_agent_tc",  label: "Transaction Coordinator (Buyer Side)", section: "agents", dirType: "Real Estate Agent" },
  { key: "listing_agent",    label: "Listing Agent",          section: "agents", dirType: "Real Estate Agent", purchaseOnly: true },
  { key: "listing_agent_tc", label: "Transaction Coordinator (Listing Side)", section: "agents", dirType: "Real Estate Agent", purchaseOnly: true },
  { key: "escrow",           label: "Escrow Officer",         section: "closing", dirType: "Escrow Officer" },
  { key: "title",            label: "Title Officer",          section: "closing", dirType: "Escrow Officer" },
  { key: "insurance",        label: "Insurance Agent",        section: "closing", dirType: "Insurance Agent" },
];

const ROLE_LABEL = Object.fromEntries(ROLE_DEFS.map(r => [r.key, r.label]));
ROLE_LABEL.coborrower = "Co-Borrower";
ROLE_LABEL.other = "Other";

// Which directory contact_type a manual add is filed under (write-back to Ops Partners)
const DIR_WRITEBACK = {
  buyers_agent: "Real Estate Agent", buyers_agent_tc: "Real Estate Agent",
  listing_agent: "Real Estate Agent", listing_agent_tc: "Real Estate Agent",
  escrow: "Escrow Officer", title: "Escrow Officer", insurance: "Insurance Agent",
};

const fmtPhone = (p) => {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return p || "";
};

// ─── Tap-to-contact pill (tel: / mailto:) ────────────────────────────────────
function ContactPill({ T, icon, href, label }) {
  return (
    <a href={href} onClick={e => e.stopPropagation()} style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px",
      borderRadius: 9999, background: `${T.blue}14`, border: `1px solid ${T.blue}30`,
      color: T.blue, fontSize: 13, fontWeight: 600, fontFamily: FONT, textDecoration: "none",
    }}>
      <Icon name={icon} size={14} />{label}
    </a>
  );
}

// ─── One filled contact card ─────────────────────────────────────────────────
function ContactCard({ T, entry, roleLabel, onEdit, onRemove, readOnly }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.separator}`, borderRadius: 14,
      padding: "14px 16px", marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 4 }}>
            {roleLabel}
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT, letterSpacing: "-0.02em" }}>
            {entry.name || <span style={{ color: T.textTertiary, fontWeight: 500 }}>Name pending</span>}
          </div>
          {entry.company && (
            <div style={{ fontSize: 13, color: T.textSecondary, fontFamily: FONT, marginTop: 2 }}>{entry.company}</div>
          )}
        </div>
        {!readOnly && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={onEdit} aria-label={`Edit ${roleLabel}`} style={{ background: "none", border: "none", cursor: "pointer", color: T.textTertiary, padding: 6 }}>
              <Icon name="edit" size={15} />
            </button>
            <button onClick={onRemove} aria-label={`Remove ${roleLabel}`} style={{ background: "none", border: "none", cursor: "pointer", color: T.textTertiary, padding: 6 }}>
              <Icon name="x" size={15} />
            </button>
          </div>
        )}
      </div>
      {(entry.phone || entry.email) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {entry.phone && <ContactPill T={T} icon="phone" href={`tel:${String(entry.phone).replace(/[^\d+]/g, "")}`} label={fmtPhone(entry.phone)} />}
          {entry.email && <ContactPill T={T} icon="mail" href={`mailto:${entry.email}`} label="Email" />}
        </div>
      )}
    </div>
  );
}

// ─── Empty slot: directory picker + manual add ───────────────────────────────
function EmptySlot({ T, role, candidates, onPick, onManual }) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [draft, setDraft] = useState({ name: "", company: "", email: "", phone: "" });
  const inp = (field, placeholder, inputMode) => (
    <input value={draft[field]} placeholder={placeholder} inputMode={inputMode}
      onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
      style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: T.text, fontSize: 14, outline: "none", fontFamily: FONT, marginBottom: 8 }} />
  );

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%", boxSizing: "border-box",
        background: "transparent", border: `1.5px dashed ${T.separator}`, borderRadius: 14,
        padding: "13px 16px", marginBottom: 10, cursor: "pointer", color: T.textSecondary,
        fontSize: 14, fontWeight: 500, fontFamily: FONT, textAlign: "left",
      }}>
        <Icon name="plus" size={15} /> Add {ROLE_LABEL[role]}
      </button>
    );
  }

  return (
    <div style={{ background: T.card, border: `1px solid ${T.blue}50`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT }}>Add {ROLE_LABEL[role]}</span>
        <button onClick={() => { setOpen(false); setManual(false); }} style={{ background: "none", border: "none", cursor: "pointer", color: T.textTertiary, padding: 4 }}>
          <Icon name="x" size={15} />
        </button>
      </div>
      {!manual && candidates.length > 0 && (
        <>
          <select defaultValue="" onChange={e => {
            const c = candidates[Number(e.target.value)];
            if (c) { onPick(c); setOpen(false); }
          }} style={{ width: "100%", background: T.inputBg, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: "11px 12px", color: T.text, fontSize: 14, fontWeight: 500, outline: "none", cursor: "pointer", fontFamily: FONT, WebkitAppearance: "none", marginBottom: 8 }}>
            <option value="" disabled>Choose from your contacts…</option>
            {candidates.map((c, i) => (
              <option key={i} value={i}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>
            ))}
          </select>
          <button onClick={() => setManual(true)} style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, padding: 0 }}>
            + Enter details manually instead
          </button>
        </>
      )}
      {(manual || candidates.length === 0) && (
        <>
          {inp("name", "Full name")}
          {DIR_WRITEBACK[role] && inp("company", "Company")}
          {inp("email", "Email", "email")}
          {inp("phone", "Phone", "tel")}
          <button disabled={!draft.name.trim() && !draft.email.trim()} onClick={() => { onManual(draft); setOpen(false); setManual(false); setDraft({ name: "", company: "", email: "", phone: "" }); }}
            style={{ width: "100%", padding: "11px 0", borderRadius: 9999, border: "none", background: T.blue, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer", opacity: (!draft.name.trim() && !draft.email.trim()) ? 0.5 : 1 }}>
            Add to team
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────
export default function TeamContent({
  T, isDesktop, isBorrower, isCloud, isRefi, activeBorrower, borrowerMode, auth,
  Hero, Card, Sec, Note, TextInp, onRenameClient,
}) {
  const borrowerId = isBorrower ? borrowerMode?.borrower?.id : activeBorrower?.id;

  const [team, setTeam] = useState(() =>
    isBorrower ? (borrowerMode?.borrower?.deal_team || []) : []
  );
  const [coEmail, setCoEmail] = useState("");
  const [directory, setDirectory] = useState({ partners: [], team: [] });
  const [loading, setLoading] = useState(!isBorrower);
  const [saveState, setSaveState] = useState("");        // '', 'saving', 'saved', 'error'
  const [ariveState, setAriveState] = useState("");      // '', 'loading', 'done', 'none', 'error'
  const [ariveMsg, setAriveMsg] = useState("");
  const [editingRole, setEditingRole] = useState(null);
  const [editingName, setEditingName] = useState(false);   // inline-edit the client's name
  const [nameDraft, setNameDraft] = useState("");
  const saveTimer = useRef(null);
  const loadedRef = useRef(false);

  const getEntry = (role) => team.find(e => e.role === role) || null;

  // ── Load roster + directory (LO mode) ──
  useEffect(() => {
    if (isBorrower || !borrowerId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    loadedRef.current = false;
    fetchDealTeam(borrowerId, true)
      .then(data => {
        if (cancelled) return;
        let t = Array.isArray(data.deal_team) ? data.deal_team : [];
        const dirTeam = data.directory?.team || [];
        // Auto-fill the loan team from the roster on first open: signed-in LO,
        // plus the first LOA/processor linked to them. Marked source 'team';
        // saved only when the LO actually changes something else (or via the
        // debounced save these fills trigger below).
        const loEmail = (auth?.user?.email || "").toLowerCase();
        const me = dirTeam.find(m => (m.email || "").toLowerCase() === loEmail);
        const fills = [];
        if (me && !t.some(e => e.role === "lo")) {
          fills.push({ role: "lo", name: me.name, email: me.email, phone: me.phone || "", company: "", source: "team" });
        }
        // LOA/processor: only auto-fill when the roster explicitly links them
        // to the signed-in LO (team_members.linked_los).
        const linkedTo = (m) => Array.isArray(m.linked_los) && m.linked_los.map(x => String(x).toLowerCase()).includes(loEmail);
        for (const roleKey of ["loa", "processor"]) {
          if (t.some(e => e.role === roleKey)) continue;
          const linked = dirTeam.find(x => x.role === roleKey && linkedTo(x));
          if (linked) fills.push({ role: roleKey, name: linked.name, email: linked.email, phone: linked.phone || "", company: "", source: "team" });
        }
        if (fills.length) t = [...t, ...fills];
        setTeam(t);
        setCoEmail(data.coborrower_email || "");
        setDirectory({ partners: data.directory?.partners || [], team: dirTeam });
        loadedRef.current = true;
        // Persist roster auto-fills right away so Ops + borrower view see them
        if (fills.length) queueSave(t, data.coborrower_email || "");
      })
      .catch(() => { if (!cancelled) setSaveState("error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrowerId, isBorrower]);

  // ── Debounced save (LO mode) ──
  const queueSave = useCallback((nextTeam, nextCoEmail) => {
    if (isBorrower || !borrowerId) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDealTeam(borrowerId, nextTeam, nextCoEmail)
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error"));
    }, 700);
  }, [isBorrower, borrowerId]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const updateTeam = (updater) => {
    setTeam(prev => {
      const next = updater(prev);
      queueSave(next, coEmail);
      return next;
    });
  };

  const setRoleEntry = (role, data, source = "manual") => {
    updateTeam(prev => {
      const rest = prev.filter(e => e.role !== role);
      return [...rest, { role, name: data.name || "", email: data.email || "", phone: data.phone || "", company: data.company || "", source }];
    });
  };

  const removeRole = (role) => updateTeam(prev => prev.filter(e => e.role !== role));

  const handleManualAdd = (role, draft) => {
    setRoleEntry(role, draft, "manual");
    // Write back to the shared Ops Partners directory (deduped server-side)
    if (DIR_WRITEBACK[role] && (draft.name || "").trim()) {
      addPartnerToDirectory({
        name: draft.name.trim(), company: (draft.company || "").trim(),
        email: (draft.email || "").trim(), phone: (draft.phone || "").trim(),
        contact_type: DIR_WRITEBACK[role],
      }).catch(() => {});
    }
  };

  // ── Arive auto-fill (fills empty slots only) ──
  const runAriveFill = async () => {
    const email = activeBorrower?.email;
    if (!email) { setAriveState("error"); setAriveMsg("This client has no email on file — add one first."); return; }
    setAriveState("loading"); setAriveMsg("");
    try {
      const data = await fetchAriveDealTeam(email);
      if (!data.found || !data.suggestions) {
        setAriveState("none"); setAriveMsg("No Arive loan matches this client's email yet.");
        return;
      }
      const s = data.suggestions;
      // Compute the merged roster OUTSIDE setState so the fill count and the
      // co-borrower email sync are exact (no double-run updater surprises).
      const next = [...team];
      let filled = 0;
      const has = (role) => next.some(e => e.role === role);
      const put = (role, c) => {
        if (!c || !(c.name || c.email) || has(role)) return;
        next.push({ role, name: c.name || "", email: c.email || "", phone: c.phone || "", company: c.company || "", source: "arive" });
        filled++;
      };
      put("coborrower", s.coborrower);
      put("buyers_agent", s.buyers_agent);
      put("buyers_agent_tc", s.buyers_agent_tc);
      put("listing_agent", s.listing_agent);
      put("listing_agent_tc", s.listing_agent_tc);
      put("escrow", s.escrow);
      put("insurance", s.insurance);
      // Loan team: resolve LO/processor names against the roster for emails/phones
      const roster = directory.team || [];
      const resolve = (c) => {
        if (!c) return c;
        const m = roster.find(x => (x.email && c.email && x.email.toLowerCase() === c.email.toLowerCase())
          || (x.name && c.name && x.name.toLowerCase() === c.name.toLowerCase()));
        return m ? { ...c, email: c.email || m.email, phone: c.phone || m.phone || "" } : c;
      };
      put("lo", resolve(s.lo));
      put("processor", resolve(s.processor));

      const nextCoEmail = (!coEmail && s.coborrower?.email) ? s.coborrower.email : coEmail;
      if (nextCoEmail !== coEmail) setCoEmail(nextCoEmail);
      setTeam(next);
      if (filled > 0 || nextCoEmail !== coEmail) queueSave(next, nextCoEmail);
      setAriveState("done");
      setAriveMsg(filled > 0
        ? `Filled ${filled} contact${filled === 1 ? "" : "s"} from Arive${data.loan?.lender ? ` (${data.loan.lender} file)` : ""}.`
        : "Arive loan found, but every slot is already filled — nothing overwritten.");
    } catch {
      setAriveState("error"); setAriveMsg("Couldn't reach Arive — try again in a minute.");
    }
  };

  // ── Directory candidates per role ──
  const candidatesFor = (role) => {
    const def = ROLE_DEFS.find(r => r.key === role);
    if (!def) return [];
    if (def.dirType === "team") {
      const want = role === "lo" ? ["admin", "lo", "team_lo"] : [role];
      return (directory.team || [])
        .filter(m => want.includes(m.role))
        .map(m => ({ name: m.name, email: m.email, phone: m.phone || "", company: "" }));
    }
    return (directory.partners || [])
      .filter(p => (p.contact_type || "Real Estate Agent") === def.dirType)
      .map(p => ({ name: p.name || "", email: p.email || "", phone: p.phone || "", company: p.company || "" }));
  };

  // ── Role slot renderer (LO mode) ──
  const renderSlot = (role) => {
    const entry = getEntry(role);
    if (editingRole === role && entry) {
      return (
        <EditCard key={role} T={T} role={role} entry={entry}
          onSave={(draft) => { setRoleEntry(role, draft, entry.source || "manual"); setEditingRole(null); }}
          onCancel={() => setEditingRole(null)} />
      );
    }
    if (entry) {
      return (
        <ContactCard key={role} T={T} entry={entry} roleLabel={ROLE_LABEL[role]}
          onEdit={() => setEditingRole(role)} onRemove={() => removeRole(role)} />
      );
    }
    return (
      <EmptySlot key={role} T={T} role={role} candidates={candidatesFor(role)}
        onPick={(c) => setRoleEntry(role, c, "directory")}
        onManual={(draft) => handleManualAdd(role, draft)} />
    );
  };

  // ════════ BORROWER MODE — read-only "here's your team" ════════
  if (isBorrower) {
    const order = ["lo", "loa", "processor", "buyers_agent", "buyers_agent_tc", "listing_agent", "listing_agent_tc", "escrow", "title", "insurance", "other"];
    const visible = order.map(r => ({ role: r, entry: getEntry(r) })).filter(x => x.entry);
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 10 }}>
        <Hero value="Your Deal Team" label="The people working on your home loan — one tap to reach any of them" />
        {visible.length === 0 ? (
          <Card>
            <div style={{ textAlign: "center", padding: "24px 8px", color: T.textSecondary, fontFamily: FONT, fontSize: 14, lineHeight: 1.6 }}>
              <Icon name="users" size={28} />
              <div style={{ marginTop: 10 }}>Your loan officer is putting your deal team together.<br />Check back soon!</div>
            </div>
          </Card>
        ) : (
          visible.map(({ role, entry }) => (
            <ContactCard key={role} T={T} entry={entry} roleLabel={ROLE_LABEL[role]} readOnly />
          ))
        )}
      </div>
    );
  }

  // ════════ LO MODE ════════
  if (!isCloud || !borrowerId) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 10 }}>
        <Hero value="Deal Team" label="Who's working this deal — borrowers, agents, escrow, title, insurance" />
        <Note>Open a cloud client (sign in and pick a client) to build their deal team.</Note>
      </div>
    );
  }

  const statusText = saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed — retrying on next change" : "";

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 10 }}>
      <Hero value="Deal Team" label={`Everyone working ${activeBorrower?.name ? `${activeBorrower.name}'s` : "this"} deal — shared with Ops and visible in the client's blueprint`} />

      {/* Arive auto-fill + save status row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={runAriveFill} disabled={ariveState === "loading"} style={{
          display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px",
          borderRadius: 9999, border: "none", cursor: ariveState === "loading" ? "wait" : "pointer",
          background: "linear-gradient(135deg, #3B6BF5, #2B4FCE)", color: "#fff",
          fontSize: 13.5, fontWeight: 700, fontFamily: FONT, opacity: ariveState === "loading" ? 0.7 : 1,
          boxShadow: "0 0 20px rgba(59,107,245,0.25)",
        }}>
          <Icon name="zap" size={14} />{ariveState === "loading" ? "Checking Arive…" : "Auto-fill from Arive"}
        </button>
        {statusText && (
          <span style={{ fontSize: 12, fontFamily: FONT, color: saveState === "error" ? T.red : T.textTertiary }}>{statusText}</span>
        )}
      </div>
      {ariveMsg && (
        <Note color={ariveState === "error" || ariveState === "none" ? T.orange : T.green}>{ariveMsg}</Note>
      )}

      {loading ? (
        <Card><div style={{ textAlign: "center", padding: 20, color: T.textSecondary, fontFamily: FONT, fontSize: 14 }}>Loading deal team…</div></Card>
      ) : (
        <>
          {/* ── Borrowers ── */}
          <Sec title="Borrowers">
            <Card>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 4 }}>Borrower</div>
              {editingName ? (
                <input
                  value={nameDraft}
                  autoFocus
                  onChange={e => setNameDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { const v = nameDraft.trim(); if (v && v !== activeBorrower?.name && onRenameClient) onRenameClient(v); setEditingName(false); }
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  onBlur={() => { const v = nameDraft.trim(); if (v && v !== activeBorrower?.name && onRenameClient) onRenameClient(v); setEditingName(false); }}
                  style={{ width: "100%", maxWidth: 320, boxSizing: "border-box", background: T.inputBg || T.card, border: `1px solid ${T.blue}`, borderRadius: 8, padding: "6px 10px", fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT, outline: "none" }}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: FONT }}>{activeBorrower?.name || "—"}</div>
                  {onRenameClient && !isBorrower && activeBorrower?.id && (
                    <button
                      onClick={() => { setNameDraft(activeBorrower?.name || ""); setEditingName(true); }}
                      title="Rename client"
                      style={{ width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", background: `${T.blue}12`, border: `1px solid ${T.blue}30`, borderRadius: 8, cursor: "pointer", color: T.blue, flexShrink: 0, padding: 0 }}
                    >
                      <Icon name="edit" size={14} color={T.blue} />
                    </button>
                  )}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {activeBorrower?.phone && <ContactPill T={T} icon="phone" href={`tel:${String(activeBorrower.phone).replace(/[^\d+]/g, "")}`} label={fmtPhone(activeBorrower.phone)} />}
                {activeBorrower?.email && <ContactPill T={T} icon="mail" href={`mailto:${activeBorrower.email}`} label={activeBorrower.email} />}
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: MONO, color: T.textTertiary, marginBottom: 8 }}>Co-Borrower</div>
              <TextInp label="Name" value={getEntry("coborrower")?.name || ""} placeholder="Co-borrower's full name"
                onChange={v => setRoleEntry("coborrower", { ...(getEntry("coborrower") || {}), name: v }, getEntry("coborrower")?.source || "manual")} sm />
              <TextInp label="Email" value={coEmail || getEntry("coborrower")?.email || ""} placeholder="name@email.com" inputMode="email"
                onChange={v => {
                  setCoEmail(v);
                  const cur = getEntry("coborrower") || {};
                  setTeam(prev => {
                    const rest = prev.filter(e => e.role !== "coborrower");
                    const next = [...rest, { role: "coborrower", name: cur.name || "", email: v, phone: cur.phone || "", company: "", source: cur.source || "manual" }];
                    queueSave(next, v); // pass the NEW email — updateTeam would close over the old one
                    return next;
                  });
                }} sm />
              <TextInp label="Phone" value={getEntry("coborrower")?.phone || ""} placeholder="(555) 555-5555" inputMode="tel"
                onChange={v => setRoleEntry("coborrower", { ...(getEntry("coborrower") || {}), phone: v }, getEntry("coborrower")?.source || "manual")} sm />
              <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, marginTop: 6, lineHeight: 1.5 }}>
                The co-borrower email links their sign-in to this blueprint — they'll co-edit the same file.
              </div>
            </Card>
          </Sec>

          {/* ── Loan Team ── */}
          <Sec title="Loan Team">
            {["lo", "loa", "processor"].map(renderSlot)}
          </Sec>

          {/* ── Agents (purchase) ── */}
          {!isRefi && (
            <Sec title="Real Estate Agents">
              {["buyers_agent", "buyers_agent_tc", "listing_agent", "listing_agent_tc"].map(renderSlot)}
            </Sec>
          )}

          {/* ── Escrow / Title / Insurance ── */}
          <Sec title="Escrow, Title & Insurance">
            {["escrow", "title", "insurance"].map(renderSlot)}
          </Sec>
        </>
      )}
    </div>
  );
}

// ─── Inline edit card ────────────────────────────────────────────────────────
function EditCard({ T, role, entry, onSave, onCancel }) {
  const [draft, setDraft] = useState({ name: entry.name || "", company: entry.company || "", email: entry.email || "", phone: entry.phone || "" });
  const inp = (field, placeholder, inputMode) => (
    <input value={draft[field]} placeholder={placeholder} inputMode={inputMode}
      onChange={e => setDraft(d => ({ ...d, [field]: e.target.value }))}
      style={{ width: "100%", boxSizing: "border-box", background: T.inputBg, borderRadius: 10, border: `1px solid ${T.inputBorder}`, padding: "10px 12px", color: T.text, fontSize: 14, outline: "none", fontFamily: FONT, marginBottom: 8 }} />
  );
  return (
    <div style={{ background: T.card, border: `1px solid ${T.blue}50`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: FONT, marginBottom: 10 }}>Edit {ROLE_LABEL[role]}</div>
      {inp("name", "Full name")}
      {inp("company", "Company")}
      {inp("email", "Email", "email")}
      {inp("phone", "Phone", "tel")}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSave(draft)} style={{ flex: 1, padding: "10px 0", borderRadius: 9999, border: "none", background: T.blue, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer" }}>Save</button>
        <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 9999, border: `1px solid ${T.separator}`, background: "transparent", color: T.textSecondary, fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: "pointer" }}>Cancel</button>
      </div>
    </div>
  );
}
