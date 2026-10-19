#!/usr/bin/env node
// App Store Connect API helper for the iPhone release — no browser, no Apple
// sign-in. Auth is the API key in ~/.appstoreconnect/blueprint-release.env
// (see .claude/skills/ios-app-update).
//
//   node scripts/asc.mjs status                      what's live / in flight
//   node scripts/asc.mjs prepare 1.5 8 notes.txt     create/locate the version, attach
//                                                    the build, set What's New, auto-release
//   node scripts/asc.mjs screenshots 1.5 a.png b.png …   replace the iPhone 6.9" set, in order
//   node scripts/asc.mjs submit 1.5                  submit that version for review
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP_ID = "6773117288";
const API = "https://api.appstoreconnect.apple.com";

function loadKey() {
  const envFile = path.join(os.homedir(), ".appstoreconnect", "blueprint-release.env");
  const env = {};
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^(\w+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace("$HOME", os.homedir());
  }
  return { keyId: env.ASC_KEY_ID, issuer: env.ASC_ISSUER_ID, pem: fs.readFileSync(env.ASC_KEY_PATH, "utf8") };
}

const b64url = (b) => Buffer.from(b).toString("base64url");
function token() {
  const { keyId, issuer, pem } = loadKey();
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: issuer, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" }));
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: pem, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}

async function api(method, url, body) {
  const res = await fetch(url.startsWith("http") ? url : API + url, {
    method,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const errs = (json.errors || []).map((e) => `${e.code}: ${e.detail || e.title}`).join("; ");
    throw new Error(`${method} ${url} → ${res.status} ${errs}`);
  }
  return json;
}

async function findVersion(versionString) {
  const r = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&filter[versionString]=${versionString}`);
  return r.data[0] || null;
}

async function findBuild(versionString, buildNumber) {
  const r = await api("GET", `/v1/builds?filter[app]=${APP_ID}&filter[version]=${buildNumber}&filter[preReleaseVersion.version]=${versionString}`);
  return r.data[0] || null;
}

async function enUsLocalization(versionId) {
  const r = await api("GET", `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`);
  const loc = r.data.find((l) => l.attributes.locale === "en-US") || r.data[0];
  if (!loc) throw new Error("version has no localization");
  return loc;
}

async function status() {
  const r = await api("GET", `/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=4`);
  for (const v of r.data) console.log(`${v.attributes.versionString}\t${v.attributes.appStoreState}\t${v.attributes.releaseType || ""}`);
}

async function prepare(versionString, buildNumber, notesFile) {
  const build = await findBuild(versionString, buildNumber);
  if (!build) throw new Error(`build ${versionString} (${buildNumber}) not found — still processing? retry in 5 min`);
  if (build.attributes.processingState !== "VALID") throw new Error(`build is ${build.attributes.processingState}, not VALID yet — retry in 5 min`);
  let v = await findVersion(versionString);
  if (!v) {
    v = (await api("POST", "/v1/appStoreVersions", { data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString, releaseType: "AFTER_APPROVAL" },
      relationships: { app: { data: { type: "apps", id: APP_ID } } },
    } })).data;
    console.log(`created version ${versionString}`);
  } else {
    await api("PATCH", `/v1/appStoreVersions/${v.id}`, { data: { type: "appStoreVersions", id: v.id, attributes: { releaseType: "AFTER_APPROVAL" } } });
  }
  await api("PATCH", `/v1/appStoreVersions/${v.id}/relationships/build`, { data: { type: "builds", id: build.id } });
  console.log(`attached build ${buildNumber}`);
  const whatsNew = fs.readFileSync(notesFile, "utf8").trim();
  const loc = await enUsLocalization(v.id);
  await api("PATCH", `/v1/appStoreVersionLocalizations/${loc.id}`, { data: { type: "appStoreVersionLocalizations", id: loc.id, attributes: { whatsNew } } });
  console.log("set What's New; release: automatically after approval");
}

async function screenshots(versionString, files) {
  const v = await findVersion(versionString);
  if (!v) throw new Error(`no version ${versionString}`);
  const loc = await enUsLocalization(v.id);
  const sets = (await api("GET", `/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`)).data;
  // 1290x2796 shots belong in the largest iPhone set; Apple has named it
  // APP_IPHONE_67 and APP_IPHONE_69 over the years — use whichever exists.
  let set = sets.find((s) => s.attributes.screenshotDisplayType === "APP_IPHONE_69")
    || sets.find((s) => s.attributes.screenshotDisplayType === "APP_IPHONE_67");
  if (!set) {
    set = (await api("POST", "/v1/appScreenshotSets", { data: {
      type: "appScreenshotSets", attributes: { screenshotDisplayType: "APP_IPHONE_67" },
      relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } },
    } })).data;
  }
  console.log(`screenshot set ${set.attributes.screenshotDisplayType}`);
  const old = (await api("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
  for (const s of old) await api("DELETE", `/v1/appScreenshots/${s.id}`);
  if (old.length) console.log(`removed ${old.length} old screenshots`);
  const ids = [];
  for (const file of files) {
    const buf = fs.readFileSync(file);
    const shot = (await api("POST", "/v1/appScreenshots", { data: {
      type: "appScreenshots", attributes: { fileName: path.basename(file), fileSize: buf.length },
      relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } },
    } })).data;
    for (const op of shot.attributes.uploadOperations) {
      const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
      const res = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
      if (!res.ok) throw new Error(`upload part of ${file} → ${res.status}`);
    }
    const md5 = crypto.createHash("md5").update(buf).digest("hex");
    await api("PATCH", `/v1/appScreenshots/${shot.id}`, { data: { type: "appScreenshots", id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
    ids.push(shot.id);
    console.log(`uploaded ${path.basename(file)}`);
  }
  await api("PATCH", `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { data: ids.map((id) => ({ type: "appScreenshots", id })) });
  // Apple processes each image; wait until none are still in flight.
  for (let i = 0; i < 30; i++) {
    const cur = (await api("GET", `/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
    const states = cur.map((s) => s.attributes.assetDeliveryState?.state);
    if (states.every((s) => s === "COMPLETE")) { console.log("screenshots processed"); return; }
    if (states.includes("FAILED")) throw new Error(`screenshot processing failed: ${JSON.stringify(cur.map((s) => s.attributes.assetDeliveryState))}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log("screenshots still processing (Apple will finish on its own)");
}

async function submit(versionString) {
  const v = await findVersion(versionString);
  if (!v) throw new Error(`no version ${versionString}`);
  const sub = (await api("POST", "/v1/reviewSubmissions", { data: {
    type: "reviewSubmissions", attributes: { platform: "IOS" },
    relationships: { app: { data: { type: "apps", id: APP_ID } } },
  } })).data;
  await api("POST", "/v1/reviewSubmissionItems", { data: {
    type: "reviewSubmissionItems",
    relationships: {
      reviewSubmission: { data: { type: "reviewSubmissions", id: sub.id } },
      appStoreVersion: { data: { type: "appStoreVersions", id: v.id } },
    },
  } });
  await api("PATCH", `/v1/reviewSubmissions/${sub.id}`, { data: { type: "reviewSubmissions", id: sub.id, attributes: { submitted: true } } });
  console.log(`submitted ${versionString} for review`);
}

const [cmd, ...args] = process.argv.slice(2);
const run = { status, prepare: () => prepare(...args), screenshots: () => screenshots(args[0], args.slice(1)), submit: () => submit(args[0]) }[cmd];
if (!run) { console.error("usage: status | prepare <ver> <build> <notes.txt> | screenshots <ver> <png…> | submit <ver>"); process.exit(1); }
run().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
