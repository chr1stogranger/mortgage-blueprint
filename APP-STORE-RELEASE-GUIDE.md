# Mortgage Blueprint — App Store Update Guide (Dummy-Proof)

Last updated: 2026-07-14. Reusable every release — just bump the version numbers.

**Current live version:** 1.2 (build 4)
**This release:** **1.3 (build 5)**  ← use these two numbers in Step 6

> ✅ For the 1.3 release, Phase 1 (npm build + cap sync) is ALREADY DONE, and the
> version is ALREADY SET to 1.3 / build 5 in the Xcode project. You only need to
> run `npx cap open ios` (Phase 1, last step) and then do Phases 2–4.

> Why a new binary at all? The iOS app ships the web code *bundled inside it*
> (Capacitor `webDir: "dist"`, no live-server URL). So even though
> blueprint.realstack.app already shows the fixed PricePoint, the App Store app
> won't get it until you rebuild and upload a new binary. That's what this does.

---

## Before you start — one-time checklist
You only need these the FIRST time; after that they're already set up.
- [ ] You're on your Mac (this cannot be done from the phone).
- [ ] Xcode is installed and opened at least once.
- [ ] In Xcode → Settings → Accounts, your Apple Developer account is signed in.
- [ ] You can log in to https://appstoreconnect.apple.com

---

## PHASE 1 — Build the latest code into the app (Terminal)

Open the **Terminal** app, then copy-paste these one line at a time. Press Return after each and wait for it to finish before the next.

```bash
cd ~/Desktop/Projects/mortgage-blueprint
```

```bash
npm install
```

```bash
npm run build
```
*(This creates the `dist` folder — the web app that gets wrapped.)*

```bash
npx cap sync ios
```
*(This copies `dist` into the iOS app and updates native plugins.)*

```bash
npx cap open ios
```
*(This opens the project in Xcode. Wait for Xcode to fully load — bottom status bar stops showing "Indexing/Loading".)*

---

## PHASE 2 — Set the version number (in Xcode)

1. In Xcode's left sidebar, click the blue **App** icon at the very top.
2. In the middle panel, under **TARGETS**, click **App**.
3. Click the **General** tab.
4. Find the **Identity** section:
   - **Version** → should already say `1.3` (I set it for you — just confirm)
   - **Build** → should already say `5` (I set it for you — just confirm)

> Rule for next time: **Version** is what users see (1.2, 1.3, 2.0…).
> **Build** must ALWAYS be a higher number than last time (3 → 4 → 5…),
> even if the Version stayed the same. If Apple says "build already exists,"
> you forgot to raise the Build number.

---

## PHASE 3 — Archive and upload (in Xcode)

1. At the **top center** of Xcode, next to the "App" name, there's a device picker.
   Click it and choose **Any iOS Device (arm64)**.
   ⚠️ It must say "Any iOS Device" — NOT a simulator. Archive is greyed out if a simulator is selected.
2. Top menu bar: **Product → Archive**.
3. Wait. This takes a few minutes. (If it fails, see Troubleshooting below.)
4. When it finishes, the **Organizer** window opens showing your new archive at the top.
5. Click **Distribute App** (blue button, right side).
6. Choose **App Store Connect** → click **Distribute** (keep all default options;
   automatic signing is fine since v1.1 already shipped this way).
7. Wait for **"Upload Successful"** → click **Done**.

> The build now needs to "process" on Apple's side. This takes **5–30 minutes**.
> You'll get an email when it's ready, or just refresh App Store Connect in Phase 4.

---

## PHASE 4 — Submit for review (App Store Connect website)

1. Go to https://appstoreconnect.apple.com → **My Apps** → **Mortgage Blueprint**.
2. Top-left, click the blue **(+) Version or Platform** → choose **iOS** →
   type version `1.3` → **Create**.
3. Scroll to **"What's New in This Version"** and write a short note, e.g.:
   > • PricePoint: faster, more reliable daily challenges and free play, now with
   >   live server-scored guesses and a revamped leaderboard across all markets.
   > • Clients: rename or delete a client, and tap a client to jump straight to
   >   their most recent loan.
   > • Calculator: inline-editable closing costs & fees, PMI rate lock, updated
   >   2025–26 property tax rates, and a one-click emailable Fees Worksheet PDF.
   > • Performance and polish fixes throughout.
4. Scroll to the **Build** section → click **(+)** (or "Add Build") and select
   **build 5**.
   - If no build appears yet, it's still processing — wait a few minutes and refresh.
5. (Screenshots, description, keywords carry over from 1.1 — no need to redo them.)
6. Top-right: **Save**, then **Add for Review** → **Submit for Review**.
7. If asked about **Export Compliance / encryption**: standard answer is **No**
   (you only use HTTPS, which is exempt). Confirm.

✅ Done. Status goes to **"Waiting for Review."** Apple usually reviews within
24–48 hours. You'll get an email when it's approved and live.

---

## After it's approved — test on your phone (important)
The app caches aggressively. To make sure you're seeing the new version:
1. Delete the old app from your phone.
2. Reinstall from the App Store.
3. Open PricePoint → Daily and Free Play → confirm a property loads and scores.

---

## Troubleshooting
- **"Archive" is greyed out** → you picked a simulator. Set device picker to
  **Any iOS Device (arm64)** (Phase 3, step 1).
- **"No account / signing error"** → Xcode → Settings → Accounts, sign into your
  Apple Developer account. Then in the App target → **Signing & Capabilities**,
  check **Automatically manage signing** and pick your Team.
- **"This build already exists" / "redundant binary"** → you reused a Build
  number. Raise the **Build** number (Phase 2) and re-archive.
- **`npx cap sync` fails** → run `npm install` again, then retry.
- **Build not showing in App Store Connect** → it's still processing; wait
  5–30 min and refresh. Make sure Phase 3 ended in "Upload Successful."
- **Housekeeping note:** the version bump from the last release was never
  committed to git (the repo still shows 1.0/build 1 committed, while the live
  app is 1.1/build 3). Not a blocker, but after this release you may want to
  commit the version change so the repo matches what's shipped.
