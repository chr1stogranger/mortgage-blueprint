#!/usr/bin/env bash
# Build the latest main into the iOS app and upload it to App Store Connect.
#
# Everything an App Store update needs EXCEPT the final "Submit for Review"
# click on appstoreconnect.apple.com (see .claude/skills/ios-app-update).
#
#   scripts/ios-release.sh --check        preflight + "is there anything to ship?" only
#   scripts/ios-release.sh --sim          build main into the iOS simulator and launch it (smoke test)
#   scripts/ios-release.sh --build-only   full build + archive, no upload, no commit
#   scripts/ios-release.sh                full release: archive, upload, commit version bump
#   scripts/ios-release.sh --force        ship even if nothing changed / last release still pending
#   scripts/ios-release.sh --version 2.0  pick the marketing version (default: minor + 1)
#
# Exit codes: 0 done · 10 nothing new to ship · 11 last release not live yet · 1 failure
# The last line is always "RESULT: <status> ..." so a caller can parse it.

set -euo pipefail

# Everything sits in one { } block so bash parses the whole file before
# running it: editing this script mid-release (it runs 10-20 min) would
# otherwise make bash resume at the wrong byte offset.
{

TEAM_ID="L8MLCV6TV3"
BUNDLE_ID="com.xperthome.mortgageblueprint"
PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"
# Paths whose changes end up inside the app binary.
APP_PATHS=(src public index.html package.json package-lock.json vite.config.js capacitor.config.json ios)
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

MODE="release"; FORCE=0; NEW_VERSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --check) MODE="check" ;;
    --build-only) MODE="build" ;;
    --sim) MODE="sim" ;;
    --force) FORCE=1 ;;
    --version) NEW_VERSION="$2"; shift ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
  shift
done

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WT="$REPO/.claude/worktrees/ios-release"
LOG_DIR="$HOME/Library/Logs/mortgage-blueprint-ios-release"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
LOG="$LOG_DIR/$STAMP.log"

say()  { printf '\n==> %s\n' "$*"; }
die()  { echo "ERROR: $*"; echo "Full log: $LOG"; echo "RESULT: failed $*"; exit 1; }
# Run a noisy step, keep its output in the log, show the tail if it fails.
run()  { local label="$1"; shift
         echo "--- $label: $*" >>"$LOG"
         if ! "$@" >>"$LOG" 2>&1; then tail -40 "$LOG"; die "$label failed"; fi; }

# ---------------------------------------------------------------- preflight
say "Preflight"
[[ -d "$DEVELOPER_DIR" ]] || die "Xcode not found at $DEVELOPER_DIR"
xcodebuild -version >/dev/null 2>&1 || die "xcodebuild can't run (open Xcode once and accept the license)"
[[ -f "$REPO/.env.production.local" ]] || die ".env.production.local missing — without it the app ships with sync/maps disabled"
command -v npm >/dev/null || die "npm not on PATH"
echo "Xcode: $(xcodebuild -version | head -1)"

run "git fetch" git -C "$REPO" fetch origin main
MAIN="$(git -C "$REPO" rev-parse origin/main)"

# The last iOS release is the last commit that bumped the build number.
BASE="$(git -C "$REPO" log -1 --format=%H -G'CURRENT_PROJECT_VERSION' "$MAIN" -- "$PBXPROJ")"
REPO_VERSION="$(git -C "$REPO" show "$MAIN:$PBXPROJ" | sed -nE 's/.*MARKETING_VERSION = ([0-9.]+);.*/\1/p' | head -1)"
REPO_BUILD="$(git -C "$REPO" show "$MAIN:$PBXPROJ" | sed -nE 's/.*CURRENT_PROJECT_VERSION = ([0-9]+);.*/\1/p' | head -1)"
LIVE_VERSION="$(curl -fsS "https://itunes.apple.com/lookup?bundleId=$BUNDLE_ID&country=us&_cb=$RANDOM$RANDOM" \
  | python3 -c 'import json,sys; r=json.load(sys.stdin)["results"]; print(r[0]["version"] if r else "")' || true)"
echo "App Store live: ${LIVE_VERSION:-unknown} · main: $REPO_VERSION (build $REPO_BUILD) · last release commit: ${BASE:0:7}"

# ------------------------------------------------------------------- gates
# 1) A version newer than what's live means the last upload is still in
#    review / waiting to be released / rejected. Don't stack another on it.
if [[ $FORCE -eq 0 && -n "$LIVE_VERSION" && "$REPO_VERSION" != "$LIVE_VERSION" ]]; then
  echo "Version $REPO_VERSION was uploaded but the App Store still shows $LIVE_VERSION."
  echo "Check App Store Connect: it's in review, waiting for 'Release This Version', or was rejected."
  echo "RESULT: pending $REPO_VERSION not live yet (live $LIVE_VERSION)"
  exit 11
fi

# 2) Anything that lands in the binary changed since the last release?
CHANGES="$(git -C "$REPO" log --no-merges --format='%s' "$BASE..$MAIN" -- "${APP_PATHS[@]}" | grep -vE '^(chore|docs|test|ci)(\(|:)' || true)"
COUNT="$(printf '%s' "$CHANGES" | grep -c . || true)"
if [[ $FORCE -eq 0 && "$COUNT" -eq 0 ]]; then
  echo "No app changes on main since the last release."
  echo "RESULT: nothing-to-ship (live $LIVE_VERSION)"
  exit 10
fi

if [[ -z "$NEW_VERSION" ]]; then
  NEW_VERSION="$(echo "$REPO_VERSION" | awk -F. '{printf "%d.%d", $1, $2 + 1}')"
fi
NEW_BUILD=$((REPO_BUILD + 1))
echo "$COUNT app changes since the last release → next release $NEW_VERSION (build $NEW_BUILD)"

if [[ "$MODE" == "check" ]]; then
  echo "Change list (for the What's New text):"
  printf '%s\n' "$CHANGES" | head -60 | sed 's/^/  • /'
  echo "RESULT: ready $NEW_VERSION build $NEW_BUILD ($COUNT changes)"
  exit 0
fi

# ------------------------------------------------------- clean build tree
# A dedicated worktree at origin/main so the build never picks up whatever
# is half-edited in the main checkout (and never disturbs it).
say "Preparing a clean copy of main"
if [[ -d "$WT/.git" || -f "$WT/.git" ]]; then
  run "worktree reset" git -C "$WT" checkout --detach --force "$MAIN"
  run "worktree clean" git -C "$WT" clean -fdx -e node_modules
else
  run "worktree add" git -C "$REPO" worktree add --force --detach "$WT" "$MAIN"
fi
cp "$REPO/.env.production.local" "$WT/.env.production.local"
cd "$WT"

say "Installing packages (npm ci)"
run "npm ci" npm ci --no-audit --no-fund
say "Running tests"
run "npm test" npm test
say "Building the web app"
run "npm run build" npm run build
say "Copying it into the iOS project (cap sync)"
run "cap sync" npx cap sync ios

# Keys must be baked in, or the app says "Sync is not configured" (July 2026).
SUPA_HOST="$(sed -nE 's/^VITE_SUPABASE_URL="?https?:\/\/([^/"]+).*/\1/p' .env.production.local)"
[[ -f ios/App/App/public/index.html ]] || die "ios/App/App/public/index.html missing after cap sync"
if [[ -n "$SUPA_HOST" ]] && ! grep -rqF "$SUPA_HOST" ios/App/App/public/assets; then
  die "Supabase URL is not baked into the bundle — env file wasn't read"
fi

if [[ "$MODE" == "sim" ]]; then
  # Native-only bugs (no location permission, status bar style, deep links)
  # never show up on the web — look at the real shell before uploading.
  say "Building for the iOS simulator"
  SIM="$(xcrun simctl list devices available | sed -nE 's/^ +iPhone 17 Pro Max \(([0-9A-F-]+)\).*/\1/p' | head -1)"
  [[ -n "$SIM" ]] || die "no iPhone 17 Pro Max simulator installed"
  run "simulator build" xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
    -sdk iphonesimulator -destination "platform=iOS Simulator,id=$SIM" -derivedDataPath "$LOG_DIR/simbuild" \
    CODE_SIGNING_ALLOWED=NO build
  SIM_APP="$LOG_DIR/simbuild/Build/Products/Release-iphonesimulator/App.app"
  xcrun simctl boot "$SIM" 2>/dev/null || true
  xcrun simctl bootstatus "$SIM" -b >/dev/null 2>&1 || true
  xcrun simctl status_bar "$SIM" override --time "9:41" --batteryState charged --batteryLevel 100 >/dev/null 2>&1 || true
  xcrun simctl location "$SIM" set 37.7599,-122.4889 >/dev/null 2>&1 || true
  open -a Simulator --args -CurrentDeviceUDID "$SIM"
  run "simulator install" xcrun simctl install "$SIM" "$SIM_APP"
  run "simulator launch" xcrun simctl launch "$SIM" "$BUNDLE_ID"
  echo "RESULT: sim-ready $NEW_VERSION build $NEW_BUILD device=$SIM app=$SIM_APP"
  exit 0
fi

say "Setting version $NEW_VERSION (build $NEW_BUILD)"
sed -i '' -E "s/MARKETING_VERSION = [0-9.]+;/MARKETING_VERSION = $NEW_VERSION;/; s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = $NEW_BUILD;/" "$PBXPROJ"
grep -q "MARKETING_VERSION = $NEW_VERSION;" "$PBXPROJ" || die "version bump didn't apply"

ARCHIVE_DIR="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)"
ARCHIVE="$ARCHIVE_DIR/MortgageBlueprint $NEW_VERSION ($NEW_BUILD) $STAMP.xcarchive"
mkdir -p "$ARCHIVE_DIR"
say "Archiving in Xcode (a few minutes)"
run "xcodebuild archive" xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" -allowProvisioningUpdates archive
APP_INFO="$ARCHIVE/Products/Applications/App.app/Info.plist"
[[ "$(plutil -extract CFBundleShortVersionString raw "$APP_INFO")" == "$NEW_VERSION" ]] || die "archive has the wrong version"
[[ "$(plutil -extract CFBundleVersion raw "$APP_INFO")" == "$NEW_BUILD" ]] || die "archive has the wrong build number"
echo "Archive: $ARCHIVE"

if [[ "$MODE" == "build" ]]; then
  git -C "$WT" checkout -- "$PBXPROJ"
  echo "RESULT: built $NEW_VERSION build $NEW_BUILD (not uploaded) archive=$ARCHIVE"
  exit 0
fi

say "Uploading to App Store Connect"
EXPORT_OPTS="$LOG_DIR/ExportOptions.plist"
cat >"$EXPORT_OPTS" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict>
</plist>
PLIST
run "upload" xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$EXPORT_OPTS" \
  -exportPath "$LOG_DIR/export-$STAMP" -allowProvisioningUpdates
grep -qiE "Upload succeeded|EXPORT SUCCEEDED|Uploaded" "$LOG" || die "upload didn't report success"

# Record the release on main so the repo matches what shipped and the next
# run knows where this release started.
say "Committing the version bump to main"
# Tracked files cap sync rewrote (e.g. CapApp-SPM/Package.swift after a
# Capacitor bump) shipped in this binary, so they go in with the bump.
git -C "$WT" add -u ios
git -C "$WT" commit -q -m "iOS release $NEW_VERSION (build $NEW_BUILD)" -m "Uploaded to App Store Connect by scripts/ios-release.sh."
for attempt in 1 2 3; do
  if git -C "$WT" push -q origin HEAD:main >>"$LOG" 2>&1; then PUSHED=1; break; fi
  git -C "$WT" fetch -q origin main && git -C "$WT" rebase -q origin/main >>"$LOG" 2>&1 || true
done
[[ "${PUSHED:-0}" == 1 ]] || echo "WARNING: uploaded fine, but the version-bump commit didn't push — push it by hand from $WT"

echo "RESULT: uploaded $NEW_VERSION build $NEW_BUILD ($COUNT changes) archive=$ARCHIVE"
exit
}
