# Session Handoff — Real-Time Collaborative Blueprint Editing

**Date:** March 19, 2026
**Session:** Real-time collaborative blueprint editing feature
**Status:** Infrastructure complete, UI partially wired, next major feature ready to build

---

## What Was Built This Session

### Real-Time Collaboration Infrastructure (All 6 Phases)

We built Google Sheets-style live collaboration for Blueprint — where the LO and borrower can both be on the same Blueprint making edits in real-time.

**Phase 1 — Live Sync Core:**
- `src/lib/supabaseClient.js` — Browser-side Supabase client (anon key) for Realtime subscriptions, Presence channels, and Broadcast channels
- `src/hooks/useSyncedScenario.js` — Core sync hook with debounced writes (400ms), optimistic updates, remote merge with cooldown, field-level lock enforcement
- `src/hooks/useBlueprintSync.js` — Thin bridge hook that wraps the existing `getState()`/`loadState()` pattern in MortgageBlueprint.jsx without refactoring 80+ useState hooks

**Phase 2 — Field Locking:**
- LO can lock verified sections (Income, Debts, Credit Score, Assets, Employment) after reviewing documents
- Borrower sees "Verified" badges and can't edit locked fields
- Server-side enforcement in `api/collab.js` (handleSync) — even if borrower sends locked field values, server reverts them
- `src/components/LockControls.jsx` — LO toggle UI (built but not yet placed in a tab)

**Phase 3 — Version History:**
- `scenario_changes` table tracks every edit with field-level diffs (old → new values)
- `src/hooks/useVersionHistory.js` — Undo, revert-to-version, named bookmarks
- `src/components/VersionTimeline.jsx` — Visual timeline grouped by date (built but not yet placed in a tab)

**Phase 4 — Presence:**
- Supabase Presence channels show who's online on a specific scenario
- `src/hooks/usePresence.js` — Tracks online users, field-level editing indicators
- `src/components/PresenceBar.jsx` — Animated "LIVE" indicator with avatars, colored rings (indigo=LO, green=borrower)
- PresenceBar IS wired into MortgageBlueprint.jsx (shows below header when users are online)

**Phase 5 — Borrower Accounts:**
- `borrower_accounts` table with magic link auth (email-based, no password)
- Session tokens (signed HMAC-SHA256, 30-day expiry)
- `src/components/BorrowerAccountPrompt.jsx` — Nudge card for borrowers (built but not placed in SharePortal yet)

**Phase 6 — Activity Intelligence:**
- `activity_digest` table aggregates daily borrower activity
- Tracks: total edits, fields changed, session count, price ranges explored, most adjusted field
- Auto-generates agent tips ("Sarah explored $700K-$900K range, she's serious")
- `src/components/ActivityDashboard.jsx` — LO-facing intelligence panel (built but not placed in Ops yet)

### API Routes (Consolidated)

All new endpoints live in a single file to stay within Vercel's 12-function Hobby plan limit:

**`loan-pipeline/api/collab.js`** — Routes via `?resource=X` query parameter:
- `resource=changes` — Version history CRUD (authenticated)
- `resource=locks` — Field lock management (authenticated)
- `resource=digest` — Activity digest compute/fetch (authenticated)
- `resource=presence` — Who's online heartbeat (authenticated, merged from old presence.js)
- `resource=sync` — Borrower live editing via share token (public)
- `resource=borrower-auth` — Magic link auth for borrowers (public)

### Database Migration

**`loan-pipeline/migrations/007_realtime_collab.sql`** — Already run in Supabase. Created:
- `field_lock_events` — Lock audit trail
- `scenario_changes` — Version history with field diffs
- `scenario_presence` — Per-scenario presence tracking
- `borrower_accounts` — Borrower magic link auth
- `activity_digest` — Daily activity rollups
- Added `locked_fields` JSONB and `current_version` INTEGER to `scenarios` table
- All tables have RLS enabled and Realtime enabled

### UI Changes

- **SharePortal.jsx** — Completely redesigned with premium RealStack branding (glassmorphic header, hero section with gradient, animated loading, staggered card animations)
- **BorrowerPicker.jsx** — New searchable dropdown replacing the old `<select>`. Type-ahead search by name/email/phone, status badges, keyboard navigation, "+ New Borrower"
- **Summary/Share tab** — "Email" and "Copy Link" buttons moved to top, side by side
- **Desktop sidebar** — Green "Get Pre-Approved" button pinned to bottom
- **Header bar** — Shows "syncing..." / "live ✓" status + online user count

### Environment Variables Added

**mortgage-blueprint (Vercel):**
- `VITE_SUPABASE_URL` = `https://oqagrfvtgslyrpsxxlck.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = (publishable key from Supabase)
- `VITE_GOOGLE_CLIENT_ID` = (copied from loan-pipeline)

**Google Cloud Console:**
- Added `https://blueprint.realstack.app` to Authorized JavaScript origins AND Authorized redirect URIs for the "Loan Pipeline Web" OAuth 2.0 Client ID

---

## What's Wired vs. What's Built But Not Wired

### Wired and Working:
- `useBlueprintSync` hook in MortgageBlueprint.jsx (subscribes to Realtime, debounced writes)
- `PresenceBar` renders below header when other users are online
- Sync status ("syncing..." / "live ✓") in header bar
- `BorrowerPicker` searchable dropdown (replaces old select)
- "Copy Share Link" button (borrower picker bar + Summary tab)
- Redesigned `SharePortal` for borrowers
- All API routes deployed and functional

### Built But NOT Yet Placed in UI:
- `LockControls.jsx` — Needs to be added to a tab (probably Summary or a new "Collaboration" section)
- `VersionTimeline.jsx` — Needs to be added to UI (could be a drawer/panel or a section in Summary)
- `BorrowerAccountPrompt.jsx` — Needs to be added to SharePortal (show after borrower has been using it)
- `ActivityDashboard.jsx` — Needs to be added to Ops (MortgagePipeline.jsx) or as a panel in Blueprint

---

## What To Build Next (In Priority Order)

### 0. SharePortal → Full Calculator Auto-Load (CRITICAL UX FIX)

The SharePortal currently shows a summary card view where borrowers can "adjust" a few numbers. This is a dead end — borrowers should land directly in the full Blueprint calculator, not a watered-down portal.

**Decision:** When a borrower clicks a share link, after a brief branded loading screen (RealStack logo, 1-2 sec), they should be auto-loaded into the full `MortgageBlueprint` component with their scenario pre-loaded. Same calculator the LO uses, same tabs — just in "borrower mode" where LO-locked fields are read-only.

**Decision: Borrowers MUST authenticate to see their Blueprint.** Financial data (credit scores, income, debts, assets) should not be accessible to anyone who happens to get the link. The magic link auth system (Phase 5) was built this session and handles this.

**Implementation:** In `App.jsx`, when `?share=TOKEN` is detected:
1. Show branded RealStack splash screen with the borrower's first name ("Welcome, Sarah")
2. Check for existing borrower session token in localStorage (`bp_borrower_session`)
3. If valid session exists → skip to step 6
4. If no session → show email input: "Enter your email to access your Blueprint"
5. Borrower enters email → magic link sent → they click it → session created (30-day expiry)
6. Fetch share data (validate token + session, get borrower + scenarios)
7. If only 1 scenario: auto-load it into `MortgageBlueprint` via `setFullCalcState(scenario.state_data)`
8. If multiple scenarios: show a quick scenario picker, then load the selected one
9. The `MortgageBlueprint` component needs a `borrowerMode` prop that: hides the LO-only features (borrower picker, settings), shows the PresenceBar, respects field locks, and routes saves through the share-sync endpoint instead of the authenticated endpoint.

The `onEnterFullCalculator` callback already exists in App.jsx — it does exactly this. We just need to gate it behind borrower auth and auto-trigger it instead of requiring a button click.

The magic link auth is already built:
- `BorrowerAccountPrompt.jsx` has the email input UI
- `api/collab.js?resource=borrower-auth` handles request/verify/me endpoints
- `borrower_accounts` table stores accounts + hashed magic tokens
- Session tokens are signed HMAC-SHA256 with 30-day expiry
- First visit: enter email, click link in inbox (~15 seconds)
- Return visits: session still valid, straight into calculator (zero friction)

### 1. Two-Step Borrower + Blueprint Picker (NEXT SESSION — START HERE)

The current BorrowerPicker is one flat list. It should be:
1. **Step 1:** Search/select a client from the full Ops client list (Supabase `borrowers` table)
2. **Step 2:** See that client's Blueprints (scenarios) — pick one to load, or auto-create "Scenario 1"

When auto-creating a new scenario, it should **pre-populate from Arive data** if available:
- Credit score, income, debts, assets from the `borrowers` table (synced from Arive)
- Property price, rate, loan amount from the `leads` table (Arive loan data)
- Co-borrower information from Arive's `loanBorrowers` array
- The borrower's financial profile (`incomes`, `debts`, `assets` JSONB arrays on borrowers table)

**Architecture:** Create a new API endpoint like `/api/collab?resource=borrower-prefill&borrower_id=UUID` that:
1. Fetches the borrower record (financial profile)
2. Fetches the linked lead record (Arive loan data)
3. Fetches business contacts for co-borrower info
4. Returns a pre-built `state_data` object that can be passed directly to `loadState()`

The `loadState()` function in MortgageBlueprint.jsx already handles all fields — see lines ~1627-1762. The Arive field mapping is documented in CLAUDE.md under "Arive LOS API — Field Mapping Reference."

### 2. Wire LockControls into UI

Add the `LockControls` component to the Summary tab or create a small "Collaboration" panel. The LO should be able to see and toggle locks. The component is already built at `src/components/LockControls.jsx` and takes `scenarioId`, `lockedFields`, `userType`, and `lockableSections` as props.

### 3. Wire VersionTimeline into UI

Add `VersionTimeline` as a collapsible panel in the Summary tab or as a slide-out drawer. Needs `useVersionHistory` hook connected. All components are built.

### 4. Add BorrowerAccountPrompt to SharePortal

After the borrower uses the share link for a bit, show the `BorrowerAccountPrompt` component to encourage them to create an account (magic link auth). Already built, just needs to be placed in the SharePortal JSX.

### 5. Wire ActivityDashboard into Ops

Add the `ActivityDashboard` to MortgagePipeline.jsx as a new tab or section. Shows borrower activity intelligence with agent tips.

### 6. Email Integration for Magic Links + Activity Digests

The borrower auth system (`handleBorrowerAuth` in collab.js) currently logs magic links to console. Need to wire in an email provider (Resend, SendGrid, or Gmail API) to actually send:
- Magic link emails to borrowers
- Daily activity digest emails to the LO

---

## Key Files Reference

### mortgage-blueprint (frontend)
| File | Purpose |
|------|---------|
| `src/MortgageBlueprint.jsx` | Main calculator (67KB, 8000+ lines). Lines 1261-1276: sync hook setup. Lines 1590-1762: getState/loadState. Lines 1904-1932: save timer + sync trigger. |
| `src/SharePortal.jsx` | Borrower-facing share view (redesigned this session) |
| `src/App.jsx` | Route logic — detects `?share=TOKEN` |
| `src/api.js` | API client — all endpoints use `/api/collab?resource=X` pattern |
| `src/lib/supabaseClient.js` | Supabase Realtime client (anon key) |
| `src/hooks/useBlueprintSync.js` | Bridge hook wired into MortgageBlueprint.jsx |
| `src/hooks/useSyncedScenario.js` | Full sync hook (alternative to bridge — not currently used) |
| `src/hooks/usePresence.js` | Presence tracking hook |
| `src/hooks/useVersionHistory.js` | Version history + undo/revert hook |
| `src/components/BorrowerPicker.jsx` | Searchable client dropdown |
| `src/components/PresenceBar.jsx` | "LIVE" indicator with user avatars |
| `src/components/LockControls.jsx` | Field lock toggle UI |
| `src/components/VersionTimeline.jsx` | Visual change history timeline |
| `src/components/BorrowerAccountPrompt.jsx` | Magic link account creation prompt |
| `src/components/ActivityDashboard.jsx` | Borrower activity intelligence panel |

### loan-pipeline (backend API)
| File | Purpose |
|------|---------|
| `api/collab.js` | Consolidated collab API (changes, locks, digest, presence, sync, borrower-auth) |
| `api/scenarios.js` | Scenario CRUD (existing) |
| `api/share.js` | Share link data (existing — GET/POST for share tokens) |
| `api/_auth.js` | Google JWT verification, CORS, rate limiting |
| `api/_middleware.js` | Security wrapper (withSecurity) |
| `migrations/007_realtime_collab.sql` | All new tables + columns (already run) |

### Key Architecture Notes
- Vercel Hobby plan: max 12 serverless functions. Currently at exactly 12. Any new API file must be merged into `collab.js` or an existing file.
- Files starting with `_` (like `_auth.js`, `_middleware.js`) don't count as serverless functions.
- The `presence.js` endpoint was merged INTO `collab.js` this session. MortgagePipeline.jsx references it as `/api/collab?resource=presence`.
- Supabase anon key is safe for client-side (RLS enforces access). Service key is server-side only (in Vercel env vars, not VITE_ prefixed).

---

## How to Test Real-Time Collaboration

1. Sign in at `blueprint.realstack.app` with Google
2. Select a borrower → load or create a scenario
3. Click "Share Link" to copy the borrower's share URL
4. Open that URL in incognito or on your phone
5. Change numbers on either side → the other should update within ~1 second
6. The PresenceBar should show "1 online" when both are viewing

**Known limitation:** The SharePortal (borrower view) currently shows the old "adjust and save as new scenario" flow, not live in-place editing. The `useBlueprintSync` hook + live editing is wired on the LO side. The borrower side needs the sync wiring connected to the SharePortal component — this is part of the "wire remaining components" work.

---

## User Preferences Confirmed This Session

- **Always auto-push to GitHub** after making changes (no need to ask)
- Auto-create blank scenario when borrower is selected (no "Create First Blueprint" button)
- Pre-populate scenarios from Arive data when available
- Support multiple borrowers from same Arive application
- Borrower picker should be two-step: pick client first, then pick/create blueprint
