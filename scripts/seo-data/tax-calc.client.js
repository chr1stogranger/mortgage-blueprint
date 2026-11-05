// Property-tax calculator for the static CA tax pages, served as
// /seo/tax-calc.js (an ES module, copied as-is by scripts/seo-data-pages.mjs).
//
// Progressive enhancement: the page's HTML already shows this calculator
// filled in for a default case (render.js computes it with computeTax below),
// so crawlers and no-JS readers get real numbers. In a browser this script
// makes the form live: a search across the sourced cities
// (/seo/ca-tax-rates.json), price, rate, the homeowners' exemption and fixed
// assessments. On the hub it also loads the map (/seo/tax-map.js).
//
// Same math as Blueprint's Tax breakdown (MortgageBlueprint.jsx calc):
// taxable = max(0, price - exemption); base = taxable x rate;
// annual = base + fixed assessments. The generator and the tests import
// computeTax from this file, so the static and live numbers can't disagree.

export const HOMEOWNERS_EXEMPTION = 7000;

/**
 * @param {{ price: number, ratePct: number, primary: boolean, fixed: number }} v
 * @returns {{ exemption: number, taxable: number, base: number, fixed: number, annual: number, monthly: number, effectivePct: number }}
 */
export function computeTax({ price, ratePct, primary, fixed }) {
  const p = Number.isFinite(price) && price > 0 ? price : 0;
  const r = Number.isFinite(ratePct) && ratePct > 0 ? ratePct / 100 : 0;
  const f = Number.isFinite(fixed) && fixed > 0 ? fixed : 0;
  const exemption = primary ? Math.min(HOMEOWNERS_EXEMPTION, p) : 0;
  const taxable = Math.max(0, p - exemption);
  const base = taxable * r;
  const annual = base + f;
  return { exemption, taxable, base, fixed: f, annual, monthly: annual / 12, effectivePct: p > 0 ? (annual / p) * 100 : 0 };
}

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The output cells, keyed by their data-out attribute. */
export function formatTax(t) {
  return {
    exemption: t.exemption ? `-${usd0.format(t.exemption)}` : "$0",
    taxable: usd0.format(t.taxable),
    base: usd2.format(t.base),
    fixed: usd2.format(t.fixed),
    annual: usd2.format(t.annual),
    monthly: usd2.format(t.monthly),
    effective: `${t.effectivePct.toFixed(3)}%`,
  };
}

const fold = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Cities matching a search, best first: the name itself, then the start of a
 * word in it, then anywhere in it, then the county ("marin county" lists Marin).
 * @param {{ city: string, county: string }[]} cities
 */
export function searchCities(cities, query, limit = 100) {
  const q = fold(query).replace(/\bcounty\b/g, "").replace(/\s+/g, " ").trim();
  if (!q) return [];
  const rank = (c) => {
    const name = fold(c.city), county = fold(c.county);
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (` ${name}`.includes(` ${q}`)) return 2;
    if (county === q || county.startsWith(q)) return 3;
    if (name.includes(q)) return 4;
    return ` ${county}`.includes(` ${q}`) ? 5 : -1;
  };
  return cities
    .map((c) => [rank(c), c])
    .filter(([r]) => r >= 0)
    // Among name matches the shorter name is the closer one: "san jo" is San Jose before San Joaquin.
    .sort((a, b) => a[0] - b[0] || (a[0] < 3 ? a[1].city.length - b[1].city.length : 0) || a[1].city.localeCompare(b[1].city))
    .slice(0, limit)
    .map(([, c]) => c);
}

const countyLabel = (county) => (county === "San Francisco" ? "San Francisco" : `${county} County`);

const num = (s) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const commas = (n) => (n ? Math.round(n).toLocaleString("en-US") : "");

function init(form) {
  const $ = (name) => form.elements.namedItem(name);
  const city = $("city"), price = $("price"), rate = $("rate"), primary = $("primary"), fixed = $("fixed");
  const list = form.querySelector("[data-citylist]");
  const hint = form.querySelector("[data-cityhint]");
  const bill = form.querySelector("[data-bill]");
  const fyOut = form.querySelector("[data-fy]");
  let data = null;
  let map = null;
  let current = city.value; // the last real city, restored when a search is abandoned
  let results = [];
  let active = -1;

  const render = () => {
    const out = formatTax(computeTax({ price: num(price.value), ratePct: num(rate.value), primary: primary.checked, fixed: num(fixed.value) }));
    for (const [k, v] of Object.entries(out)) {
      for (const el of form.querySelectorAll(`[data-out="${k}"]`)) el.textContent = v;
    }
  };
  const setBill = (county) => {
    const url = data?.bills[county];
    if (!bill) return;
    bill.hidden = !url;
    if (url) {
      bill.href = url;
      bill.textContent = `Look up your ${countyLabel(county)} tax bill`;
    }
  };
  const pickCity = (name, mapOpts) => {
    const x = data?.cities.find((c) => c.city === name);
    if (!x) return;
    current = x.city;
    city.value = x.city;
    rate.value = x.pct.toFixed(4);
    if (fyOut) fyOut.textContent = `FY ${x.fy}`;
    setBill(x.county);
    map?.select(x.city, mapOpts);
    render();
  };

  // ── city search (ARIA combobox) ──
  const closeList = () => {
    list.hidden = true;
    results = [];
    active = -1;
    city.setAttribute("aria-expanded", "false");
    city.removeAttribute("aria-activedescendant");
  };
  const setActive = (i) => {
    active = i;
    [...list.children].forEach((li, n) => {
      const on = n === i;
      li.setAttribute("aria-selected", on ? "true" : "false");
      if (on) {
        city.setAttribute("aria-activedescendant", li.id);
        li.scrollIntoView({ block: "nearest" });
      }
    });
  };
  const openList = () => {
    if (!data) return;
    results = searchCities(data.cities, city.value);
    list.textContent = "";
    if (!results.length) {
      const li = document.createElement("li");
      li.className = "none";
      li.textContent = `No match. Rates cover ${data.cities.length} California cities and communities.`;
      list.append(li);
    }
    results.forEach((c, i) => {
      const li = document.createElement("li");
      li.id = `tax-city-opt-${i}`;
      li.setAttribute("role", "option");
      li.dataset.i = i;
      const name = document.createElement("span");
      name.textContent = c.city;
      const county = document.createElement("span");
      county.className = "sub";
      county.textContent = countyLabel(c.county);
      const pct = document.createElement("span");
      pct.className = "pct";
      pct.textContent = `${c.pct.toFixed(4)}%`;
      li.append(name, county, pct);
      list.append(li);
    });
    list.hidden = false;
    list.scrollTop = 0;
    city.setAttribute("aria-expanded", "true");
    if (results.length) setActive(0);
    else city.removeAttribute("aria-activedescendant");
  };
  const choose = (c) => {
    closeList();
    pickCity(c.city, { frame: true });
  };

  city.addEventListener("focus", () => city.select());
  city.addEventListener("input", openList);
  city.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      city.value = current;
      closeList();
      city.select();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active]);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (list.hidden) openList();
      else if (results.length) setActive((active + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
    }
  });
  city.addEventListener("blur", () => {
    city.value = current;
    closeList();
  });
  // mousedown keeps focus in the input, so blur doesn't close the list under the click.
  list.addEventListener("mousedown", (e) => e.preventDefault());
  list.addEventListener("click", (e) => {
    const c = results[e.target.closest("li")?.dataset.i];
    if (c) choose(c);
  });

  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (e) => { if (e.target !== city) render(); });
  for (const el of [price, fixed]) el.addEventListener("blur", () => { el.value = commas(num(el.value)) || (el === fixed ? "0" : ""); render(); });
  form.classList.add("live");

  fetch(form.dataset.src)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d) => {
      data = d;
      if (hint) hint.textContent = `Search ${d.cities.length} cities by name or county`;
      const mapEl = form.querySelector("[data-taxmap]");
      if (!mapEl) return;
      mapEl.hidden = false; // holds its space while the geometry loads, so the page doesn't jump
      return import(mapEl.dataset.js)
        .then((m) => m.initTaxMap(mapEl, { data: d, onPick: (name) => pickCity(name, { frame: "auto" }), onCounty: setBill }))
        .then((m) => {
          map = m;
          pickCity(current);
        })
        .catch(() => { mapEl.hidden = true; });
    })
    .catch(() => { /* keep the one pre-rendered city; the rest still works */ });
}

if (typeof document !== "undefined") {
  for (const f of document.querySelectorAll("form[data-taxcalc]")) init(f);
}
