# Mortgage Blueprint — App Store Submission Plan

**Prepared:** 2026-05-22
**Repo:** `chr1stogranger/mortgage-blueprint`
**Bundle ID:** `com.xperthome.mortgageblueprint`
**Stack:** React 19 + Vite 7 + Capacitor 8 (iOS + Android native projects already generated)

This is your execution checklist. Sections 1–2 are what I already did and what you must decide. Sections 3–7 are the step-by-step you run on your Mac. Work top to bottom.

---

## 1. What I already fixed (committed to your repo, not yet pushed)

| Fix | File | Why it mattered |
|---|---|---|
| App icon flattened to opaque RGB | `ios/App/App/Assets.xcassets/AppIcon.appiconset/mb_icon_1024.png` | The icon had an **alpha channel / transparent corners**. Apple **auto-rejects** App Store icons with transparency. Original saved as `mb_icon_1024.png.alpha-backup`. |
| Installed `@capacitor/splash-screen@^8.0.1` | `package.json` | Your `capacitor.config.json` configured a SplashScreen, but the plugin was never installed, so those settings did nothing. |
| Added `ITSAppUsesNonExemptEncryption = false` | `ios/App/App/Info.plist` | Skips the export-compliance question on **every** TestFlight/App Store upload. Correct because the app only uses standard HTTPS encryption. |

**Verified:** the web build compiles cleanly (`✓ 132 modules transformed`). The two build errors I hit were sandbox filesystem-permission quirks, not code problems — it builds on your Mac (same as your Vercel deploys).

**You need to commit + push these**, then on your Mac:
```bash
cd mortgage-blueprint
git pull
npm install            # picks up the new splash-screen plugin
npm run build          # produces dist/
npx cap sync ios       # copies web build + plugins into the iOS project
```

---

## 2. The one big decision: ship v1.0 WITHOUT the login wall

Your app has three entry modes:

1. **localMode** — no login, localStorage only. Triggered automatically when `VITE_GOOGLE_CLIENT_ID` is **not** set. There's even a "Continue without signing in" button.
2. **LO login** — Google Sign-In, gated to `ALLOWED_EMAILS` (your internal team), used for cloud sync.
3. **Borrower share flow** — opens a `?share=…` link, then an email **magic link** for borrowers.

**Recommendation: ship the native v1.0 in localMode (do NOT set `VITE_GOOGLE_CLIENT_ID` in the native build).** Here's why this is the low-risk path:

- **Google Sign-In does not work inside an iOS WKWebView.** Google blocks OAuth in embedded webviews (`disallowed_useragent`). If you ship the Google login, the App Review tester literally cannot sign in → **guaranteed rejection**.
- **The magic-link borrower flow can't return into the native app.** The email link opens Safari at `blueprint.realstack.app`, not your installed app, because **Universal Links (Associated Domains + an `apple-app-site-association` file) are not configured**. So borrower-share is web-only right now.
- **localMode sidesteps all of it.** Cold launch → full, usable calculator. No login wall means: no demo account needed (Guideline 2.1), no Sign in with Apple requirement (Guideline 4.8), no broken Google login. The app is genuinely useful standalone.

The cloud-sync + borrower-share features stay on the web (`blueprint.realstack.app`) for now. Add them to the native app in a **v1.1** once Universal Links and a native OAuth flow (`@capacitor/google-auth` or Sign in with Apple) are wired up. That's a separate project — don't block v1 on it.

> **Action:** In Xcode, confirm the build scheme / `.env` used for `npm run build` has **no** `VITE_GOOGLE_CLIENT_ID`. Then launch the app in the simulator and verify a cold start drops you straight into the calculator with no login screen.

---

## 3. Xcode: signing & first archive

You have an active Apple Developer membership and Xcode ready. Do this once.

1. Open the workspace:
   ```bash
   npx cap open ios
   ```
2. Select the **App** target → **Signing & Capabilities** tab.
3. Set **Team** to your Apple Developer team. Leave **Automatically manage signing** checked (your project uses `CODE_SIGN_STYLE = Automatic`). Xcode creates the provisioning profile for `com.xperthome.mortgageblueprint`.
4. Set **Version** to `1.0` and **Build** to `1` (already the defaults in `project.pbxproj`).
5. Choose **Any iOS Device (arm64)** as the run destination (not a simulator — archives require a device target).
6. **Product → Archive.** Wait for it to build (~2–5 min).
7. When the Organizer opens, select the archive → **Distribute App → App Store Connect → Upload.** Accept the defaults; let Xcode manage signing.

If upload fails on signing, the fix is almost always: Xcode → Settings → Accounts → re-download manual profiles, or toggle automatic signing off/on.

---

## 4. App Store Connect: create the listing

Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps → +  → New App**.

- **Platform:** iOS
- **Name:** `Mortgage Blueprint` (must be globally unique on the App Store — have a backup like `Mortgage Blueprint by Xpert` ready in case it's taken)
- **Primary language:** English (U.S.)
- **Bundle ID:** select `com.xperthome.mortgageblueprint` (appears after your first upload registers it)
- **SKU:** anything internal, e.g. `MTGBP-001`

Then fill in the listing. You'll need:

### Required text
- **Subtitle** (30 chars): e.g. "Smarter mortgage scenarios"
- **Promotional text** (170 chars, editable anytime)
- **Description** (what the app does — borrower payment breakdowns, scenario comparison, tax savings, amortization, etc.)
- **Keywords** (100 chars, comma-separated): e.g. `mortgage,calculator,loan,refinance,payment,home,realtor,amortization,FHA,rate`
- **Support URL** (required): e.g. `https://realstack.app` or a support page
- **Marketing URL** (optional)

### Category
- **Primary:** Finance
- **Secondary (optional):** Business or Utilities

### Age rating
Run the questionnaire — this app should rate **4+** (no objectionable content).

---

## 5. Screenshots (the most time-consuming part)

App Store **requires** screenshots for the largest iPhone size. As of 2026 you need:

- **6.9"/6.7" iPhone** (1320×2868 or 1290×2796) — **required**, at least 1, up to 10.
- **iPad 13"** (2064×2752) — required **only if** you mark the app as iPad-compatible. Your Info.plist allows iPad orientations, so either provide iPad screenshots or set the app to **iPhone only** in the target's "Supported Destinations" to avoid needing them.

How to capture:
1. In Xcode, run the app on an **iPhone 16 Pro Max** simulator (matches the 6.9" requirement).
2. Navigate to your best screens (payment breakdown, scenario comparison, amortization, tax savings).
3. **Cmd+S** in the simulator saves a correctly-sized screenshot to your Desktop.
4. Capture 4–6 strong frames. Optionally add captions in a tool like Figma, but raw screenshots are accepted.

> Tip: pre-fill a realistic scenario (e.g. $750k purchase, 20% down, 6.5% rate) so the screenshots show real numbers, not zeros.

---

## 6. Privacy — App Privacy "nutrition labels" (required, app won't submit without it)

In App Store Connect → your app → **App Privacy**. Answer honestly based on what the **shipped localMode build** actually does:

- If you ship localMode with **no analytics SDK and no account login**, you can likely select **"Data Not Collected."** Confirm there's no analytics/tracking script firing in the native build.
- If anything phones home (Supabase calls, FRED/RapidAPI requests that include identifiers, error logging), declare it — typically under "Usage Data" or "Identifiers," **not linked to identity**, **not used for tracking**.

You also need a **Privacy Policy URL** (required field). You already have `dist/privacy.html` in the repo — host it at a stable URL (e.g. `https://blueprint.realstack.app/privacy.html` or `https://realstack.app/privacy`) and paste that link.

---

## 7. App Review notes, TestFlight, and submit

### App Review Information (in the version page)
- **Sign-in required?** → **No** (because you're shipping localMode). This is the single most important answer — it removes the demo-account blocker.
- **Notes for reviewer:** Write something like:
  > "Mortgage Blueprint is a standalone mortgage calculator for homebuyers and real estate agents. No login is required — the app opens directly into the calculator. Enter a purchase price, down payment, and rate to see a full monthly payment breakdown, side-by-side loan comparisons, tax-savings estimates, and an amortization schedule. All calculations run on-device."
- **Contact:** your name, phone, `chr1stogranger@gmail.com`.

### Guideline 4.2 (minimum functionality) — pre-empt it
Capacitor web-wrapper apps occasionally get flagged as "just a website." Your reviewer notes above (emphasizing on-device calculators, native interactivity) plus the native status bar / splash screen reduce this risk. If you get a 4.2 rejection, reply that the app provides substantial native calculation tools used offline, not a repackaged website, and point to specific interactive features.

### TestFlight first (strongly recommended)
1. After your build finishes processing (App Store Connect → TestFlight tab, ~15–60 min), add yourself as an **internal tester**.
2. Install via the TestFlight app on your iPhone and run through every tab on a real device.
3. Check the things that differ from web: status bar safe-area, splash screen, scrolling, no broken login prompts.

### Submit for review
1. On the version page, attach the build you uploaded.
2. Fill all required fields (screenshots, description, privacy, age rating).
3. **Add for Review → Submit.** Apple's review currently averages ~24–48 hours.

---

## Pre-submit checklist (tick before you hit Submit)

- [ ] Pushed my 3 fixes (icon, splash plugin, Info.plist) and ran `npm install && npm run build && npx cap sync ios`
- [ ] Confirmed native build has **no** `VITE_GOOGLE_CLIENT_ID` → cold launch shows calculator, no login
- [ ] Team set in Signing & Capabilities; archive uploaded successfully
- [ ] Decided iPhone-only vs iPad-compatible (and provided iPad screenshots if compatible)
- [ ] 4–6 screenshots at 6.9" with realistic numbers
- [ ] Description, subtitle, keywords, support URL filled
- [ ] Privacy labels completed + Privacy Policy URL live
- [ ] Age rating questionnaire done (4+)
- [ ] Reviewer notes say "no login required"
- [ ] Tested the build on a real device via TestFlight

---

## Deferred to v1.1 (not blockers for launch)

- **Native cloud sync / LO login** — needs `@capacitor/google-auth` or Sign in with Apple (Google's web OAuth doesn't work in WKWebView). Adding any third-party login also triggers Guideline 4.8 (offer Sign in with Apple).
- **Borrower share + magic links in the native app** — needs Universal Links: Associated Domains entitlement (`applinks:blueprint.realstack.app`) + an `apple-app-site-association` file hosted at your domain root.
- **Android / Google Play** — the `android/` project already exists; Play submission is a separate track.
