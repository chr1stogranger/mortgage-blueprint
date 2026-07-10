# PricePoint Audit — 2026-07-09

> Phase 0 deliverable for the PricePoint Overhaul. Working checklist, not a
> polished report. Method: read the code at commit `8975ed3` **and** walked the
> live app at https://blueprint.realstack.app on a 375px viewport (Daily → Free
> Play → Board), watching console + network and probing the API directly.
> Findings tagged **P0** (blocks the core loop), **P1** (quality), **P2** (nice-to-have).

## TL;DR

The guess pipeline is **not** uniformly broken — on a well-formed device (valid
`pp_players` row + `x-device-id` header) a Free Play guess writes to `pp_guesses`
(observed `POST → 201`) and updates the player (`PATCH → 204`). The real damage is
narrower and sharper than "nothing saves":

1. **The canonical daily is dead for the app's own default market.** The live app
   is set to **Los Angeles**, and `/api/pp-daily?market=la` returns
   `400 "Invalid market. Valid: sf, oakland, berkeley, alameda"`. Every LA (and San
   Diego) player silently falls back to the client-hash daily with `daily_id = null`.
   This is a **new P0** not in the original plan. **SF works** (200, real Zillow photo).
2. **Writes are fire-and-forget** — when they *do* fail (stale PWA clients missing
   `x-device-id` per migration 011, transient network), the guess is lost with no
   retry. Confirmed in code.
3. **`syncPlayerXP` overwrites** `total_xp` with the client's local number
   (`PATCH pp_players` observed) — server increments get clobbered.
4. **The leaderboard is embarrassing when empty** — LA · Daily · Today showed a
   single "You — 59.7%" row and nothing else.

The Phase 1 server-side endpoint + canonical-daily fix + Phase 2 leaderboard v2
address all four. The market-whitelist mismatch (#1) must be handled explicitly.

---

## CTO — Data Pipeline Integrity

### P0 — `pp-daily` 400s for LA/SD: canonical daily unreachable for the default market
- **Live evidence:** console repeated `[PricePointDB] fetchDaily HTTP error: 400`
  on every PricePoint load. Direct probe:
  - `GET /api/pp-daily?market=la` → **400** `{"error":"Invalid market. Valid: sf, oakland, berkeley, alameda"}`
  - `GET /api/pp-daily?market=sf` → **200** (700 Ellsworth St, Bernal Heights, real photo)
- **Root cause:** `api/pp-daily.js` validates market against a 4-market Bay Area
  whitelist. But the client ships LA/SD markets (LA is the active market on this
  device), and `cron-pool-seed.js` per the brand kit seeds SF/Alameda/Oakland/
  Berkeley/**LA/San Diego** — so the whitelist and the seed list disagree.
- **Impact:** `supabaseDaily` is null → daily renders from the client hash
  (`getDailyProperty`) → guess inserts with `daily_id = null` → daily-mode
  leaderboard can't group by challenge, and two devices see different "dailies."
- **Fix path:** add `la`/`san-diego` (and any shipped market) to the pp-daily
  whitelist **and** ensure their pools/challenges are seeded; the Phase 1 endpoint
  must also degrade gracefully (Edge Case 4: `daily_id` null → score as freeplay).

### P0 — Fire-and-forget writes lose guesses silently
- `handleDailyGuess` (~1477), `handleFpGuess` (~1572), `handleLiveGuess` (~1845)
  all call `submitGuess(...).catch(console.warn)` + `syncPlayerXP(...).catch(...)`.
  Any rejection = permanent loss, no queue, no user signal.
- **Nuance from the live walk:** on this device the writes *succeed*
  (`POST pp_guesses → 201`, `PATCH pp_players → 204`). The silent-loss risk is real
  but hits **stale/native clients without `x-device-id`** (migration 011 RLS) and
  transient failures — not every device. Don't over-state it; the fix is the
  server endpoint + retry queue, which makes it moot.

### P0 — `syncPlayerXP` clobbers server XP
- `pricePointDB.js` `syncPlayerXP` does `UPDATE pp_players SET total_xp = <client calcXP>`.
  Observed live as `PATCH pp_players?id=eq… → 204`. Two devices / any server-side
  increment get overwritten by whichever client wrote last. Replace with a
  server-side `pp_award_xp` increment (Phase 1a) and delete the overwrite.

### P0 — `getExistingDailyGuess` fetched then ignored
- `initSupabase` (~1139) fetches the existing daily guess and only `console.log`s
  it (~1143). Clearing localStorage = play the daily again. Server should be the
  lock; reconstruct `dailyResult` from the row on load.

### P1 — `daily_id` recorded may not match the property shown
- Even when `supabaseDaily` loads, the property is still the client-hash pick, so
  the stamped `daily_id` (~1479) can reference a different home than the one scored.

### Env / quota notes
- **`SUPABASE_SERVICE_KEY` — must confirm in Vercel.** All server writes use
  `SERVICE_KEY || ANON_KEY`. If the service key is missing, pool/cache/challenge
  writes hit RLS and fail silently (server-only tables have no public policies).
  Live app can't see this; **ask Christo to verify** in Vercel → mortgage-blueprint
  → Settings → Environment Variables. (SF pp-daily returning 200 suggests seeding
  has worked at least once, but confirm before Phase 1 deploy.)
- **RapidAPI/RentCast quota:** on-demand enrichment fires per card view (see P1
  below). Nightly `cron-enrich` (Phase 3) should cap at ~240 RapidAPI calls/run;
  RentCast stays ~6 calls/week via the Monday pool-seed — inside the 50/mo free tier.

---

## CEO — Funnel & Retention

### Good
- **Time-to-first-guess is fast.** Cold load landed straight on a guessable daily
  (map, beds/baths/sqft, "Tap to enter price") in well under 10s. No blocking
  onboarding gate.
- **Name capture is deferred** to *after* the first reveal ("Claim your spot" modal
  with "Maybe later") — exactly the funnel order Phase 4 recommends. Largely
  already done; verify it holds for a truly first-time device.
- **Three modes are discoverable** — bottom nav (Daily / Free / Live / Stats /
  Board) on mobile + sidebar on desktop; modes are visually distinct.

### P1 — Retention loop is weak where it matters most
- The daily reveal + countdown-to-tomorrow exists, but the **streak is not
  surfaced on the daily card**. Streak is the core return hook (Phase 4). Compute
  from `allResults` dates and show a mono "STREAK n" chip.
- Because the LA daily is client-hash (not canonical), "come back tomorrow" doesn't
  guarantee a *shared* property — undercuts the social/competitive reason to return.

### P2 — Live vs Free Play distinction is subtle
- Three game tabs is a lot; folding Live into Free Play as a "Sold vs Active" toggle
  would cut nav to two. Flag for Christo — **decision, not a build.**

---

## CMO — Social Proof, Share, Brand

### P0 (social proof) — Leaderboard looks empty/embarrassing
- LA · Daily · Today rendered a single **"You — 59.7%"** row + "Play more dailies to
  climb." No other players, no rank context. New/quiet markets look dead.
- Two causes: (a) daily writes carry `daily_id = null` in LA so they don't group;
  (b) v1 RPC requires `HAVING COUNT(*) >= 3`. Phase 2 empty-state CTA + v2 RPC
  (period-scaled minimums, own-row union) fixes the optics.

### Brand compliance — passing
- Indigo `#6366F1` accents, JetBrains-Mono numerics (prices, XP, "Lv.1"), pill
  buttons, no emojis, dark `#050505` base. Map fallback hero (Mapbox dark style)
  renders cleanly on photo-less cards. On-brand.

### P1 — Free Play card quality depends on a user having viewed it
- First view of 4632 Abner St: **map fallback, no description, no real list price.**
  After I viewed/guessed it, lazy enrichment backfilled a **real photo, full
  description, and List Price $995,000.** So county (RentCast) rows look empty until
  someone happens to open them — the exact Phase 3 gap. Fix = proactive
  `cron-enrich` nightly backfill.

### To confirm (not yet walked)
- **Share/challenge OG unfurl** end-to-end (send a `?c=` link, check preview) — code
  path exists (`challenge.js` SSR), verify live in Phase 1/2.
- **"Run the numbers" → Blueprint handoff** lead-gen hook presence on the reveal.

---

## Confirmation of pre-identified P0s (from the prompt)

| Pre-identified | Status |
|---|---|
| Guesses fire-and-forget, fail silently | ✅ Confirmed (code); writes *do* land on good devices (201/204 live) |
| Daily shown ≠ server canonical | ✅ Confirmed, and worse: LA daily 400s entirely (market whitelist) |
| Leaderboard degrades to local "You" | ✅ Confirmed live (single "You — 59.7%" row) |
| `getExistingDailyGuess` ignored | ✅ Confirmed (~1143 console.log only) |
| RentCast rows: no photo / fake list price | ✅ Confirmed live (map fallback → enriched on view) |
| Mapbox static-map fallback built | ✅ Confirmed rendering live on LA daily + Free Play |

## New findings this audit added

1. **P0 — market whitelist mismatch:** `pp-daily.js` only allows sf/oakland/
   berkeley/alameda; the app's default market (LA) and San Diego 400. This is *the*
   reason the live daily is on the hash fallback right now.
2. **CEO — name capture already deferred** to post-reveal (Phase 4 item partly done).
3. **P0 nuance — pipeline works on well-formed devices;** failures concentrate in
   stale/native clients (011 RLS) and unsupported markets, not universally.

## Open question for Christo (blocks Phase 1 deploy)
- Is **`SUPABASE_SERVICE_KEY`** set in Vercel (mortgage-blueprint)? Needed before
  the new server-side guess endpoint and pool writes can bypass RLS.
