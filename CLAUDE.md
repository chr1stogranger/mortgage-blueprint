# Mortgage Blueprint — repo-level Claude instructions

## Product naming (adopted 2026-07-24)
- Consumer products are product-first with a platform badge:
  **Mortgage Blueprint — powered by RealStack** and
  **PricePoint — powered by RealStack**. The LO console is
  **RealStack Ops** and never takes the badge — Ops *is* the platform,
  so "powered by" would be circular.
- The badge appears **once per surface**, never inline in body copy.
  Prose/`<title>`/OG use the em-dash form; UI chrome uses a `MONO`
  uppercase microline (`POWERED BY REALSTACK`, ~10px, `0.15em`,
  `T.textTertiary`) under the wordmark.
- Full name on external surfaces (titles, OG, legal, PDF footers); short
  name ("Blueprint") where space is tight — PWA `short_name`,
  `apple-mobile-web-app-title` (iOS truncates ~12 chars), nav labels, and
  the mobile `UnifiedHeader` wordmark (desktop shows the full name).
- The RealStack shell drawer is the umbrella surface: it carries the
  RealStack logo/wordmark and short product names in its nav. It gets
  **no** badge — a platform doesn't badge its own products.
- **"Homebase" is reserved** for a possible future borrower portal. Don't
  use it as a product name; note that `loan-pipeline` already uses
  `homebase*` as internal localStorage keys and a realtime topic.

## Brand (Grange kit, adopted 2026-07-17)
- Grange blue `#3B6BF5` is the primary accent (`#2B4FCE` is the gradient
  partner ONLY — never a flat fill). All palette tokens live in
  `src/lib/theme.js` (`DARK`/`LIGHT` + glass tokens + `RIBBONS`).
- Fonts come from `src/lib/fonts.js` — never re-declare local FONT/MONO
  consts. `FONT` (Inter) for everything including numerals (alignment via
  the global `font-variant-numeric: tabular-nums` in index.css). `MONO`
  (Geist Mono) ONLY for uppercase labels/overlines/NMLS accents.
  **JetBrains Mono is retired — never reintroduce it** (its name survives
  only as a last-resort fallback inside the MONO stack).
- Visual language is "Grange" liquid-glass: navy `#0a1120` dark ground /
  bright-cool light ground, with a per-mode background canvas
  (`src/components/AppBackground.jsx`, decision by Christo 2026-07-17):
  Blueprint = blueprint-paper 3D wireframe-house canvas ("house" variant),
  PricePoint = thin-line target canvas ("target"), Markets = ascending
  stock-line canvas ("chart", Christo 2026-07-18). The woven ribbons
  ("ribbons", palette in `theme.js` `RIBBONS`) are retired from all modes
  but remain the code default — do not reintroduce them. Glass chrome via
  `T.glass`/`T.glassStrong`/`T.glassBorder`. Dense data
  surfaces stay solid (`T.card`) — glass is chrome + tiles. The Pause
  control lives in Settings → Appearance; the canvas honors
  `prefers-reduced-motion`.
- Pill buttons (`border-radius: 9999px`); no emojis in UI (shared `Icon`).
- The Fees Worksheet PDF (`src/lib/FeesWorksheetPdf.jsx`) bundles Inter
  TTFs; figures render Inter/Inter-Bold — do not re-add mono ttfs.

## Workflow
- Deploy target: `https://blueprint.realstack.app` (Vercel auto-deploy from
  `main`). `npm run build` must pass before any commit.
- **Parallel sessions use separate `git worktree`s** — three working-tree
  collisions to date (July 2026). Never `git add -A` at repo root; stage
  exact paths. Never touch `Chris Saves Here/` (scratch folder).
- This is a PWA + Capacitor app (iOS/Android in `ios/`, `android/`).
  Native icons/splash/App Store screenshots ship with releases via Xcode —
  web changes alone don't update them.

### Verifying a deploy
1. Wait for Vercel (30–90s), open blueprint.realstack.app, hard-reload with
   `location.replace('?_cb=' + Date.now())` — stale-bundle/service-worker
   phantoms are a repeat offender here (black screen ≈ stale SW, never
   auth/API; a kill-switch SW pattern exists in ops for reference).
2. Confirm the bundle hash changed; console clean; spot-check the change.
3. PWA gotcha: Google Fonts are cached CacheFirst for 1 year — font-stack
   changes require bumping the workbox `google-fonts-cache-vN` name in
   `vite.config.js` (done v1→v2 on 2026-07-17).

## Gotchas
- `email-templates/*.html` are pasted into Supabase Auth settings by hand —
  editing the files does NOT deploy them; remind Christo to re-paste.
- **`migrations/*.sql` and `sql/*.sql` do NOT auto-apply** — they are pasted
  into the Supabase SQL Editor by hand, so a merged migration can sit unapplied
  for weeks while code silently degrades. Two live cases found 2026-07-19:
  `sql/2026-06-11-pp_city_cache.sql` (never run → /api/pricepoint has NO L2
  cache, every request re-fans-out ~16 RapidAPI calls) and migration 016
  (Daily sold-date pill renders nothing until applied). Write API code to
  tolerate the un-applied state (PGRST204 strip-and-retry, null-safe reads),
  and ALWAYS remind Christo to run the SQL in the same message that ships it.
- Light-mode contrast pass (Christo 2026-07-05): borders/separators/inputs
  are deliberately darker than 6% gray — keep it when touching LIGHT tokens.
- Markets/PricePoint render inside MortgageBlueprint's shell (one root,
  one background canvas). `Markets.jsx` receives `FONT` as a prop.
