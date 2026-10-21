// ─── My Home — the client's Homebot home report (sidebar tab) ────────────────
// Ops (/api/homebot-report) looks the signed-in email up in Chris's Homebot
// account and returns that client's own report link; MortgageBlueprint only
// shows this tab when a link came back, so clients who aren't in Homebot never
// see an empty tab. Web opens the report in a new tab; the iOS app opens the
// in-app browser.
import { Capacitor } from "@capacitor/core";
import { FONT } from "../lib/fonts.js";
import Icon from "../Icon";

export default function MyHomeTab({ T, url }) {
  const open = async (e) => {
    if (!Capacitor.isNativePlatform()) return; // the link's own target=_blank handles web
    e.preventDefault();
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  };
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ background: T.card, borderRadius: 16, padding: 24, boxShadow: T.cardShadow, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: 9999, background: "rgba(59,107,245,0.12)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="key" size={18} color={T.blue} />
          </span>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: FONT }}>Your home report</div>
        </div>
        <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.6, fontFamily: FONT, marginBottom: 18 }}>
          See what your home is worth today, how much equity you've built, and when a refinance or cash-out could make sense for you. It updates every month.
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={open}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 24px", borderRadius: 9999, background: T.blue, color: "#fff",
            fontSize: 15, fontWeight: 700, fontFamily: FONT, textDecoration: "none",
          }}>
          Open my home report
        </a>
        <div style={{ fontSize: 12, color: T.textTertiary, fontFamily: FONT, marginTop: 10 }}>Opens your Homebot report in a new tab.</div>
      </div>
    </div>
  );
}
