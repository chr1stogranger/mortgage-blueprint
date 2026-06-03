// src/lib/theme.js
//
// RealStack Blueprint theme tokens (CIO audit L-4, first step).
// Single in-repo source of truth for the DARK/LIGHT palettes — matches the
// Brand Kit (Indigo #6366F1 primary accent, #050505 base, 6%-opacity borders).
//
// FOLLOW-UP (cross-repo): loan-pipeline and realstack-web carry their own
// copies of these tokens. Promoting this file to a shared @realstack/theme
// package needs a publishing strategy (npm vs. workspace) — decide before
// attempting; until then, keep the three repos' palettes in sync manually.

export const DARK = {
 bg: "#050505", bg2: "#0A0A0A", card: "#0F0F0F", cardBorder: "rgba(255,255,255,0.06)",
 cardShadow: "0 1px 3px rgba(0,0,0,0.5)", cardHover: "#141414",
 accent: "#6366F1", blue: "#3B82F6", green: "#10B981", red: "#EF4444",
 purple: "#8B5CF6", orange: "#F59E0B", cyan: "#06B6D4", pink: "#EC4899", teal: "#06B6D4",
 text: "#EDEDED", textSecondary: "#A1A1A1", textTertiary: "#666666",
 separator: "rgba(255,255,255,0.06)", inputBg: "#1A1A1A", inputBorder: "rgba(255,255,255,0.12)",
 headerBg: "rgba(5,5,5,0.7)", tabActiveBg: "rgba(255,255,255,0.08)", tabActiveText: "#EDEDED",
 successBg: "rgba(16,185,129,0.12)", successBorder: "rgba(16,185,129,0.2)",
 errorBg: "rgba(239,68,68,0.12)", errorBorder: "rgba(239,68,68,0.2)",
 warningBg: "rgba(245,158,11,0.12)", warningBorder: "rgba(245,158,11,0.2)",
 ringTrack: "rgba(255,255,255,0.06)", pillBg: "rgba(255,255,255,0.06)",
};
export const LIGHT = {
 bg: "#FAFAFA", bg2: "#FFFFFF", card: "#FFFFFF", cardBorder: "rgba(0,0,0,0.06)",
 cardShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.04)", cardHover: "#F5F5F5",
 accent: "#6366F1", blue: "#3B82F6", green: "#10B981", red: "#EF4444",
 purple: "#8B5CF6", orange: "#F59E0B", cyan: "#06B6D4", pink: "#EC4899", teal: "#06B6D4",
 text: "#171717", textSecondary: "#525252", textTertiary: "#737373",
 separator: "rgba(0,0,0,0.06)", inputBg: "#F0F0F0", inputBorder: "rgba(0,0,0,0.12)",
 headerBg: "rgba(250,250,250,0.85)", tabActiveBg: "rgba(0,0,0,0.06)", tabActiveText: "#171717",
 successBg: "rgba(16,185,129,0.08)", successBorder: "rgba(16,185,129,0.15)",
 errorBg: "rgba(239,68,68,0.08)", errorBorder: "rgba(239,68,68,0.15)",
 warningBg: "rgba(245,158,11,0.08)", warningBorder: "rgba(245,158,11,0.15)",
 ringTrack: "rgba(0,0,0,0.06)", pillBg: "rgba(0,0,0,0.04)",
};
