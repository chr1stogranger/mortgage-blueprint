// Property-tax calculator for the static CA tax pages, served as
// /seo/tax-calc.js (an ES module, copied as-is by scripts/seo-data-pages.mjs).
//
// Progressive enhancement: the page's HTML already shows this calculator
// filled in for a default case (render.js computes it with computeTax below),
// so crawlers and no-JS readers get real numbers. In a browser this script
// makes the form live: any of the sourced cities (/seo/ca-tax-rates.json),
// price, rate, the homeowners' exemption and fixed assessments.
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

const num = (s) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const commas = (n) => (n ? Math.round(n).toLocaleString("en-US") : "");

function init(form) {
  const $ = (name) => form.elements.namedItem(name);
  const city = $("city"), price = $("price"), rate = $("rate"), primary = $("primary"), fixed = $("fixed");
  const bill = form.querySelector("[data-bill]");
  const fyOut = form.querySelector("[data-fy]");
  let data = null;

  const render = () => {
    const out = formatTax(computeTax({ price: num(price.value), ratePct: num(rate.value), primary: primary.checked, fixed: num(fixed.value) }));
    for (const [k, v] of Object.entries(out)) {
      const el = form.querySelector(`[data-out="${k}"]`);
      if (el) el.textContent = v;
    }
  };
  const pickCity = () => {
    const x = data?.cities.find((c) => c.city === city.value);
    if (!x) return;
    rate.value = x.pct.toFixed(4);
    if (fyOut) fyOut.textContent = `FY ${x.fy}`;
    const url = data.bills[x.county];
    if (bill) {
      bill.hidden = !url;
      if (url) {
        bill.href = url;
        bill.textContent = `Look up your ${x.county === "San Francisco" ? "San Francisco" : `${x.county} County`} tax bill`;
      }
    }
    render();
  };

  form.addEventListener("submit", (e) => e.preventDefault());
  form.addEventListener("input", (e) => { if (e.target !== city) render(); });
  city.addEventListener("change", pickCity);
  for (const el of [price, fixed]) el.addEventListener("blur", () => { el.value = commas(num(el.value)) || (el === fixed ? "0" : ""); render(); });
  form.classList.add("live");

  fetch(form.dataset.src)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d) => {
      data = d;
      const keep = city.value;
      const groups = new Map();
      for (const c of d.cities) {
        if (!groups.has(c.county)) groups.set(c.county, []);
        groups.get(c.county).push(c);
      }
      city.textContent = "";
      for (const [county, list] of groups) {
        const g = document.createElement("optgroup");
        g.label = county === "San Francisco" ? "San Francisco" : `${county} County`;
        for (const c of list) g.append(new Option(c.city, c.city, false, c.city === keep));
        city.append(g);
      }
    })
    .catch(() => { /* keep the one pre-rendered city; the rest still works */ });
}

if (typeof document !== "undefined") {
  for (const f of document.querySelectorAll("form[data-taxcalc]")) init(f);
}
