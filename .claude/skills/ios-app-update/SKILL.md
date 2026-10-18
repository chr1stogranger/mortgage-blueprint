---
name: ios-app-update
description: Update the Mortgage Blueprint iPhone app on the App Store — build the latest main into the iOS binary, upload it to App Store Connect, submit it for review, and confirm it. Use when asked to "update the iPhone app", "ship the iOS app", "push a new App Store build", "release the app", or when the weekly Monday iOS release task fires. Not for web deploys (those go out automatically from main via Vercel).
---

# Update the iPhone app (Mortgage Blueprint)

The iOS app carries its own copy of the web code (Capacitor `webDir: "dist"`),
so a Vercel deploy never reaches App Store users. Getting it there takes a new
binary: build → archive → upload → submit for review → Apple approves (usually
24–48 h) → it's on the App Store automatically.

`scripts/ios-release.sh` does every step except the last click in App Store
Connect. You (Claude) do that click in the user's Chrome.

Facts you need:
- App Store Connect app id `6773117288`, bundle `com.xperthome.mortgageblueprint`, team `L8MLCV6TV3`.
- Public listing: https://apps.apple.com/us/app/mortgage-blueprint/id6773117288
- Version = what users see (1.4 → 1.5). Build must always go up (7 → 8). The script picks both.
- `xcode-select` points at Command Line Tools; the script sets `DEVELOPER_DIR` to
  `/Applications/Xcode.app` itself — don't run `sudo xcode-select`.
- Logs: `~/Library/Logs/mortgage-blueprint-ios-release/`. Archives show up in Xcode → Window → Organizer.

---

## Step 1 — Is there anything to ship?

```bash
cd ~/Desktop/Projects/mortgage-blueprint && scripts/ios-release.sh --check
```

Read the last line (`RESULT: …`):

| RESULT | Meaning | What to do |
|---|---|---|
| `ready 1.5 build 8 (N changes)` | New code is waiting | Go to Step 2. Keep the change list; it's your What's New source. |
| `nothing-to-ship` | No app changes since the last release | Stop. Report "nothing new, App Store is current at X". |
| `pending 1.5 not live yet` | Last upload is still in review, waiting for release, or rejected | Don't build. Go to Step 4 to check its status in App Store Connect and report it. If it's been rejected, tell the user the reason; don't resubmit unasked. |
| `failed …` | Preflight broke | See Troubleshooting. |

## Step 2 — Build and upload (10–20 min)

```bash
cd ~/Desktop/Projects/mortgage-blueprint && scripts/ios-release.sh
```

Run it in the background (it's long) and wait for the exit. It:
1. makes a clean copy of `origin/main` in `.claude/worktrees/ios-release` (your
   main checkout is never touched),
2. runs `npm ci`, `npm test`, `npm run build`, `npx cap sync ios`,
3. checks the Supabase keys got baked into the bundle,
4. bumps version + build, archives with Xcode, checks the archive's numbers,
5. uploads to App Store Connect,
6. commits `iOS release X (build N)` to main and pushes it.

Success = `RESULT: uploaded 1.5 build 8 …`. Anything else: Troubleshooting.
A dry run that stops before uploading: `scripts/ios-release.sh --build-only`.

## Step 3 — Submit for review (App Store Connect, in Chrome)

Apple processes the upload for 5–30 min first. Use Claude in Chrome (the user is
signed in there; never type their Apple password — if you hit a sign-in page,
stop and ask them to sign in).

1. Open `https://appstoreconnect.apple.com/apps/6773117288/distribution/ios/version/inflight`
   (or the app page → left sidebar → **iOS App**). If no editable version
   exists yet, click the **+** next to "iOS App" → type the new version (e.g.
   `1.5`) → **Create**.
2. **What's New in This Version** — 3–5 short bullets in plain words for
   borrowers/agents, written from the `--check` change list. Lead with the
   biggest user-facing features; skip internal/SEO/a11y plumbing; end with
   "Performance and polish fixes throughout." No emojis.
3. **Build** section → **Add Build** → pick the new build number → **Done**.
   If it isn't listed, it's still processing: wait 5 min and reload (up to ~45 min).
   If asked about encryption: Info.plist already declares
   `ITSAppUsesNonExemptEncryption = false`, so it shouldn't ask; if it does, answer
   that the app uses only standard HTTPS (exempt).
4. **App Store Version Release** → **Automatically release this version**
   (so the weekly cycle doesn't stall on a manual release click).
5. **Save** (top right) → **Add for Review** → **Submit for Review**
   (in the panel that slides in, confirm the submission).

Screenshots, description, keywords, privacy answers all carry over — don't touch them.

## Step 4 — Confirm it's updated

Confirm each, and report what you actually saw:
- App Store Connect shows the new version with status **Waiting for Review**
  (or In Review). That's "submitted" — done for today.
- `git log -1 origin/main` is the `iOS release X (build N)` commit.
- After Apple approves (1–2 days), the public App Store shows it:
  ```bash
  curl -s "https://itunes.apple.com/lookup?bundleId=com.xperthome.mortgageblueprint&country=us&_cb=$RANDOM" | python3 -c "import json,sys;r=json.load(sys.stdin)['results'][0];print(r['version'],r['currentVersionReleaseDate'])"
  ```
  The next `--check` also reports `pending` until this flips, then `ready`/`nothing-to-ship`.

Final report: version + build, what's in it (the What's New bullets), status in
App Store Connect, and anything that needs the user (rejection, sign-in, etc.).

---

## Troubleshooting

- **`.env.production.local missing`** — the app would ship without sync/maps.
  Christo pulls it from Vercel; don't build without it.
- **`npm test failed`** — main is broken; don't ship. Report the failing test.
- **`xcodebuild archive failed` with signing / "No Account"** — Xcode → Settings →
  Accounts: the Apple ID must be signed in (user does this). Then rerun.
- **`upload failed` "bundle version must be higher" / redundant binary** — that build
  number was already uploaded (e.g. an earlier run uploaded but didn't push its
  commit). Rerun with the next build: edit `CURRENT_PROJECT_VERSION` on main, or
  pass `--force` after bumping.
- **Version-bump commit didn't push** — upload is fine; push from
  `.claude/worktrees/ios-release` (`git push origin HEAD:main`).
- **Build missing in App Store Connect after 45 min** — check the user's email for
  an Apple "ITMS-…" rejection of the binary; report it.
- **App on the phone still looks old after approval** — delete the app, reinstall
  from the App Store (WKWebView caches hard).

## Doing it by hand (Christo, no Claude)

1. Open **Terminal**, paste, press Return, wait for the `RESULT:` line:
   `cd ~/Desktop/Projects/mortgage-blueprint && scripts/ios-release.sh`
2. Wait ~15 min for Apple's processing email.
3. appstoreconnect.apple.com → My Apps → Mortgage Blueprint → Step 3 above.
