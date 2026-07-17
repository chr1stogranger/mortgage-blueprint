// src/lib/theme.js
//
// RealStack Blueprint theme tokens (CIO audit L-4, first step).
// Single in-repo source of truth for the DARK/LIGHT palettes — matches the
// Brand Kit "Grange" system (adopted 2026-07-17, replacing indigo #6366F1):
// Grange blue #3B6BF5 primary accent (#2B4FCE gradient partner ONLY — never
// a flat fill), navy #0a1120 dark ground / bright-cool light ground, glass
// chrome over the woven-ribbon canvas (see components/AppBackground.jsx).
// Light-mode borders keep Christo's 2026-07-05 contrast pass (darker than
// the old 6% grays so white cards still pop on the cool ground).
//
// FOLLOW-UP (cross-repo): loan-pipeline and realstack-web carry their own
// copies of these tokens. Promoting this file to a shared @realstack/theme
// package needs a publishing strategy (npm vs. workspace) — decide before
// attempting; until then, keep the three repos' palettes in sync manually.

export const DARK = {
 bg: "#0a1120", bg2: "#0d1524", card: "#121c30", cardBorder: "rgba(255,255,255,0.08)",
 cardShadow: "0 1px 3px rgba(0,0,0,0.5)", cardHover: "#1a2740",
 accent: "#3B6BF5", accentHover: "#6E90FF", accentDeep: "#2B4FCE", blue: "#3B6BF5",
 green: "#12a150", red: "#e5484d",
 purple: "#8b7bf0", orange: "#d98a0b", cyan: "#38c6c6", pink: "#EC4899", teal: "#38c6c6",
 text: "#EDEDED", textSecondary: "#A1A1A1", textTertiary: "#666666",
 separator: "rgba(255,255,255,0.08)", inputBg: "#162034", inputBorder: "rgba(255,255,255,0.12)",
 headerBg: "rgba(16,24,42,0.75)", tabActiveBg: "rgba(255,255,255,0.08)", tabActiveText: "#EDEDED",
 successBg: "rgba(18,161,80,0.12)", successBorder: "rgba(18,161,80,0.2)",
 errorBg: "rgba(229,72,77,0.12)", errorBorder: "rgba(229,72,77,0.2)",
 warningBg: "rgba(217,138,11,0.12)", warningBorder: "rgba(217,138,11,0.2)",
 ringTrack: "rgba(255,255,255,0.06)", pillBg: "rgba(255,255,255,0.06)",
 // Grange glass surfaces — translucent chrome over the ribbon canvas.
 // Dense data tables/cards stay solid (use `card`); glass is chrome + tiles.
 glass: "rgba(18,28,48,0.80)", glassStrong: "rgba(16,24,42,0.86)",
 glassBorder: "rgba(255,255,255,0.10)", sideBg: "rgba(16,24,42,0.75)",
 glassShadow: "0 1px 2px rgba(0,0,0,0.3), 0 18px 40px -14px rgba(0,0,0,0.55)",
};
export const LIGHT = {
 // Contrast pass (Christo 2026-07-05) preserved on the Grange cool ground:
 // borders/separators/inputs stay darker than the old 0.06 grays.
 bg: "#f4f9fc", bg2: "#FFFFFF", card: "#FFFFFF", cardBorder: "rgba(16,27,46,0.12)",
 cardShadow: "0 1px 5px rgba(16,27,46,0.08), 0 0 1px rgba(16,27,46,0.06)", cardHover: "#eff4fa",
 accent: "#3B6BF5", accentHover: "#6E90FF", accentDeep: "#2B4FCE", blue: "#3B6BF5",
 green: "#12a150", red: "#e5484d",
 purple: "#8b7bf0", orange: "#d98a0b", cyan: "#38c6c6", pink: "#EC4899", teal: "#38c6c6",
 text: "#171717", textSecondary: "#4B5563", textTertiary: "#6B7280",
 separator: "rgba(16,27,46,0.12)", inputBg: "#eef3f9", inputBorder: "rgba(16,27,46,0.18)",
 headerBg: "rgba(255,255,255,0.80)", tabActiveBg: "rgba(16,27,46,0.08)", tabActiveText: "#171717",
 successBg: "rgba(18,161,80,0.08)", successBorder: "rgba(18,161,80,0.15)",
 errorBg: "rgba(229,72,77,0.08)", errorBorder: "rgba(229,72,77,0.15)",
 warningBg: "rgba(217,138,11,0.08)", warningBorder: "rgba(217,138,11,0.15)",
 ringTrack: "rgba(16,27,46,0.10)", pillBg: "rgba(16,27,46,0.06)",
 glass: "rgba(255,255,255,0.76)", glassStrong: "rgba(255,255,255,0.93)",
 glassBorder: "rgba(255,255,255,0.75)", sideBg: "rgba(255,255,255,0.75)",
 glassShadow: "0 1px 2px rgba(16,27,46,0.04), 0 12px 32px -12px rgba(16,27,46,0.16)",
};

// Woven-ribbon background palette (Grange / Plaid-inspired spectrum), same
// values as loan-pipeline: teal → aqua → warm gold → blue → violet → pink.
export const RIBBONS = [
 [56, 198, 198],   // teal
 [72, 206, 190],   // aqua
 [240, 196, 96],   // warm gold (eased back at draw time)
 [59, 107, 245],   // blue
 [139, 123, 240],  // violet
 [222, 158, 205],  // soft pink
];
