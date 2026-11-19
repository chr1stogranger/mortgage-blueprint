// Loan-limit checker for the static loan-limit pages, served as /seo/ll-calc.js
// (an ES module, copied as-is by scripts/seo-data-pages.mjs).
//
// Progressive enhancement, like tax-calc.client.js: render.js pre-renders the
// panel for a default county with computeLoan below, so crawlers and no-JS
// readers get real numbers. In a browser this makes it live: a county search
// across the licensed states (/seo/loan-limits.json), units, price and down
// payment, and the county map (/seo/ll-map.js).
//
// A loan at or below the county's standard limit (the national baseline, or
// Hawaii's statutory one) is standard conforming; above that up to the county
// limit is high-balance conforming; above the county limit is jumbo.

import { liveCommas } from "./num-input.js";

export const KIND_NAMES = { standard: "Standard conforming", high: "High-balance", jumbo: "Jumbo" };

/**
 * @param {{ price: number, downPct: number, std: number, limit: number }} v
 *   std = the standard conforming limit, limit = the county's limit, both for the chosen unit count
 */
export function computeLoan({ price, downPct, std, limit }) {
  const p = Number.isFinite(price) && price > 0 ? price : 0;
  const d = Number.isFinite(downPct) ? Math.min(100, Math.max(0, downPct)) : 0;
  const loan = Math.round(p * (1 - d / 100));
  const kind = loan <= std ? "standard" : loan <= limit ? "high" : "jumbo";
  const minDown = Math.max(0, p - limit);
  return { price: p, downPct: d, down: p - loan, loan, std, limit, kind, minDown, minDownPct: p > 0 ? (minDown / p) * 100 : 0 };
}

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const money = (n) => usd0.format(n);

/** The output cells, keyed by their data-out attribute. */
export function formatLoan(r) {
  return {
    limit: money(r.limit),
    loan: money(r.loan),
    down: money(r.down),
    kind: KIND_NAMES[r.kind],
    std: `up to ${money(r.std)}`,
    high: r.limit > r.std ? `${money(r.std + 1)} to ${money(r.limit)}` : "none here",
    jumbo: `above ${money(r.limit)}`,
    mindown: r.minDown ? `${money(r.minDown)} (${(Math.ceil(r.minDownPct * 10) / 10).toFixed(1)}%)` : "any amount",
  };
}

export const unitLabel = (u) => (u === 1 ? "1 unit" : `${u} units`);

/**
 * /seo/loan-limits.json is compact (3,235 rows); this turns it back into county
 * objects. A row is [fips, name, st, slug, hasPage, limits or 0 for the state's
 * standard limits]. The app link pre-fills the county only in a licensed state,
 * matching model.js prefillLink().
 */
export function expandLimitData(d) {
  const counties = d.counties.map(([fips, name, st, slug, page, lim]) => {
    const s = d.states[st];
    const q = new URLSearchParams({ st, county: name.replace(/ County$/, ""), src: "seo-ll" });
    return {
      fips, name, st, state: s.name, std: s.std, limits: lim || s.std,
      path: page ? `${s.path}${slug}/` : `${s.path}#${slug}`,
      // The address a pick puts in the bar: the county's own page, or its state's page opened on it.
      share: page ? `${s.path}${slug}/` : `${s.path}?county=${slug}`,
      slug, statePath: s.path,
      app: s.licensed ? `${d.origin}/?${q}` : `${d.origin}/`,
    };
  });
  return { ...d, counties };
}

const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Counties matching a search, best first: the name, the start of a word in it,
 * anywhere in it, then the state ("texas" or "tx" lists Texas counties).
 * "king wa" narrows King County to Washington.
 * @param {{ name: string, state: string, st: string }[]} counties
 */
export function searchCounties(counties, query, limit = 100) {
  let q = fold(query).replace(/\bcounty\b/g, "").replace(/\s+/g, " ").trim();
  if (!q) return [];
  // A trailing state code or name narrows the list: "king wa", "orange ca", "harris texas".
  let only = null;
  for (const c of counties) {
    for (const s of [fold(c.st), fold(c.state)]) {
      if (q.length > s.length + 1 && q.endsWith(` ${s}`)) { only = c.st; q = q.slice(0, -s.length - 1).trim(); break; }
    }
    if (only) break;
  }
  const rank = (c) => {
    const name = fold(c.name).replace(/ county$/, "");
    const st = fold(c.st), state = fold(c.state);
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (` ${name}`.includes(` ${q}`)) return 2;
    if (q === st || state.startsWith(q)) return 3;
    return name.includes(q) ? 4 : -1;
  };
  return counties
    .filter((c) => !only || c.st === only)
    .map((c) => [rank(c), c])
    .filter(([r]) => r >= 0)
    .sort((a, b) => a[0] - b[0] || (a[0] < 3 ? a[1].name.length - b[1].name.length : 0) || a[1].name.localeCompare(b[1].name) || a[1].st.localeCompare(b[1].st))
    .slice(0, limit)
    .map(([, c]) => c);
}

const num = (s) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const commas = (n) => (n ? Math.round(n).toLocaleString("en-US") : "");

function init(form) {
  const $ = (name) => form.elements.namedItem(name);
  const county = $("county"), price = $("price"), down = $("down");
  const list = form.querySelector("[data-countylist]");
  const hint = form.querySelector("[data-countyhint]");
  const cta = form.querySelector("[data-cta]");
  const where = form.querySelectorAll("[data-where]");
  let data = null;
  let map = null;
  let cur = null; // the selected county record
  let results = [];
  let active = -1;
  const units = () => +($("units").value || 1);
  const label = (c) => `${c.name}, ${c.st}`;

  const render = () => {
    if (!cur) return;
    const u = units();
    const r = computeLoan({ price: num(price.value), downPct: num(down.value), std: cur.std[u - 1], limit: cur.limits[u - 1] });
    for (const [k, v] of Object.entries(formatLoan(r))) {
      for (const el of form.querySelectorAll(`[data-out="${k}"]`)) el.textContent = v;
    }
    for (const el of where) el.textContent = `${unitLabel(u)}, ${label(cur)}`;
    for (const row of form.querySelectorAll("[data-band]")) row.classList.toggle("on", row.dataset.band === r.kind);
    form.querySelector("[data-band='high']")?.classList.toggle("off", !(cur.limits[u - 1] > cur.std[u - 1]));
    form.dataset.kind = r.kind;
    map?.setUnits(u);
  };
  // A county someone picks becomes the page's address, so the link they copy or
  // share opens on it (and carries its own preview card where it has a page).
  const follow = (c) => {
    window.va?.("event", { name: "Loan limit county picked", data: { county: `${c.name}, ${c.st}` } });
    const here = location.pathname + location.search;
    if (!c.share || c.share === here) return;
    try { history.replaceState(history.state, "", c.share); } catch { /* sandboxed frames can refuse */ }
  };
  const pick = (fips, mapOpts, { user = true } = {}) => {
    const c = data?.counties.find((x) => x.fips === fips);
    if (!c) return;
    if (user) follow(c);
    cur = c;
    county.value = label(c);
    if (cta) {
      cta.href = c.app;
      cta.textContent = c.app.includes("?") ? `Run your numbers for ${c.name} in Mortgage Blueprint` : "Run your numbers in Mortgage Blueprint";
    }
    map?.select(c.fips, mapOpts);
    render();
  };

  // ── county search (ARIA combobox) ──
  const closeList = () => {
    list.hidden = true;
    results = [];
    active = -1;
    county.setAttribute("aria-expanded", "false");
    county.removeAttribute("aria-activedescendant");
  };
  const setActive = (i) => {
    active = i;
    [...list.children].forEach((li, n) => {
      const on = n === i;
      li.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        county.setAttribute("aria-activedescendant", li.id);
        li.scrollIntoView({ block: "nearest" });
      }
    });
  };
  const openList = () => {
    if (!data) return;
    results = searchCounties(data.counties, county.value);
    list.textContent = "";
    if (!results.length) {
      const li = document.createElement("li");
      li.className = "none";
      li.textContent = `No match. Try a county name, or a state like "TX".`;
      list.append(li);
    }
    const u = units();
    results.forEach((c, i) => {
      const li = document.createElement("li");
      li.id = `ll-county-opt-${i}`;
      li.setAttribute("role", "option");
      li.dataset.i = i;
      const name = document.createElement("span");
      name.textContent = c.name;
      const state = document.createElement("span");
      state.className = "sub";
      state.textContent = c.state;
      const lim = document.createElement("span");
      lim.className = "pct";
      lim.textContent = money(c.limits[u - 1]);
      li.append(name, state, lim);
      list.append(li);
    });
    list.hidden = false;
    list.scrollTop = 0;
    county.setAttribute("aria-expanded", "true");
    if (results.length) setActive(0);
    else county.removeAttribute("aria-activedescendant");
  };
  const choose = (c) => {
    closeList();
    pick(c.fips, { frame: true });
  };

  county.addEventListener("focus", () => county.select());
  county.addEventListener("input", openList);
  county.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (cur) county.value = label(cur);
      closeList();
      county.select();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (list.hidden) openList();
      else if (results.length) setActive((active + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    }
  });
  county.addEventListener("blur", () => {
    if (cur) county.value = label(cur);
    closeList();
  });
  list.addEventListener("mousedown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => {
    const c = results[e.target.closest("li")?.dataset.i];
    if (c) choose(c);
  });

  form.addEventListener("submit", (e) => e.preventDefault());
  // Counted in Vercel Web Analytics (public/va.js): who goes on to open Blueprint.
  cta?.addEventListener("click", () => window.va?.("event", { name: "Open app from loan limits", data: { county: cur ? `${cur.name}, ${cur.st}` : "" } }));
  form.addEventListener("input", (e) => { if (e.target !== county) render(); });
  form.addEventListener("change", (e) => { if (e.target.name === "units") render(); });
  liveCommas(price);
  price.addEventListener("blur", () => { price.value = commas(num(price.value)); render(); });
  down.addEventListener("blur", () => { down.value = String(Math.min(100, Math.max(0, Math.round(num(down.value) * 10) / 10))); render(); });
  form.classList.add("live");
  // Until the data loads, the pre-rendered county still answers price and unit changes.
  cur = { fips: form.dataset.fips, name: form.dataset.name, st: form.dataset.st, std: JSON.parse(form.dataset.std), limits: JSON.parse(form.dataset.limits) };

  fetch(form.dataset.src)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((raw) => {
      const d = expandLimitData(raw);
      data = d;
      if (hint) hint.textContent = `Search ${d.counties.length.toLocaleString("en-US")} counties by name or state`;
      // ?county=<slug> on a state page opens the checker on that county (the address a pick leaves behind).
      const want = new URLSearchParams(location.search).get("county");
      const asked = want && d.counties.find((x) => x.slug === want && x.statePath === location.pathname);
      cur = asked || d.counties.find((x) => x.fips === cur.fips) || cur;
      if (asked) pick(asked.fips, undefined, { user: false });
      render();
      const mapEl = form.querySelector("[data-llmap]");
      if (!mapEl) return;
      mapEl.hidden = false; // holds its space while the geometry loads, so the page doesn't jump
      return import(mapEl.dataset.js)
        .then((m) => m.initLimitMap(mapEl, { data: d, units: units(), onPick: (fips) => pick(fips, { frame: "auto" }) }))
        .then((m) => {
          map = m;
          if (cur) pick(cur.fips, asked ? { frame: true } : undefined, { user: false });
        })
        .catch(() => { mapEl.hidden = true; form.classList.add("no-map"); });
    })
    .catch(() => { form.classList.add("no-map"); /* keep the one pre-rendered county; units, price and down still work */ });
}

if (typeof document !== "undefined") {
  for (const f of document.querySelectorAll("form[data-llcalc]")) init(f);
}
