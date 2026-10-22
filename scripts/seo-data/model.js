// Page models for the static SEO / AI-search data pages (loan limits for the
// licensed states + sourced California city property-tax rates).
//
// Pure: data in, page objects out. No fs, no HTML (render.js does that), so
// the numbers can be unit-tested. Every figure comes from the shipped data
// modules; nothing is estimated. The rules that keep the page set honest:
//  · CA city pages exist ONLY for CA_CITY_COUNTY (the sourced rate-book
//    entries). The 1.25% default block is placeholder data and never gets a page.
//  · A county gets its own page only when its limit is above the national
//    baseline (high-cost, or Hawaii's HERA baseline) or it's a CA county with
//    sourced city rates. Every other county is a row on its state page, so we
//    never publish hundreds of near-identical "$832,750" pages.
//  · No interest rates and no rate-based payment examples (Reg Z advertising).
// Every year / FY label derives from LIMIT_YEAR and CA_CITY_TAX_FY, so a data
// refresh relabels every page on the next build.

import { LIMIT_YEAR, CONF_BASELINE, CONF_CEILING, getCountyLimits, normalizeCounty } from "../../src/data/loanLimits.js";
import { LICENSED_COUNTIES } from "../../src/data/licensedCounties.js";
import { CA_CITY_COUNTY } from "../../src/data/caCityCounty.js";
import { CA_CITY_TAX_RATES, CA_CITY_TAX_FY } from "../../src/citiesData.js";
import { STATE_PROPERTY_TAX_RATES } from "../../src/data/propertyTax.js";
import { LICENSED_STATES, LICENSED_STATES_TEXT } from "../../src/data/licensing.js";

export const ORIGIN = "https://blueprint.realstack.app";
export const BRAND = "Mortgage Blueprint, powered by RealStack";
const STATE_CODE = { Arizona: "AZ", California: "CA", Colorado: "CO", Hawaii: "HI", Nevada: "NV", Oregon: "OR", Texas: "TX", Washington: "WA" };
const UNITS = [1, 2, 3, 4];
const TAX_PRICES = [500000, 750000, 1000000, 1500000, 2000000];
const PRICE_EXAMPLE = 1000000;

export const FOOTER_TEXT =
  `Chris Granger, NMLS #952015 · Xpert Home Lending, Inc., NMLS #2179191 · Licensed in ${LICENSED_STATES_TEXT} · ` +
  "Equal Housing Opportunity. Information only, not a loan offer. " +
  "Data: FHFA (loan limits), county auditor-controller rate books (CA tax rates).";

// ── formatting ──
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n) => usd0.format(n);
export const money2 = (n) => usd2.format(n);
const cents = (n) => Math.round(n * 100) / 100;
const possessive = (name) => (name.endsWith("s") ? `${name}'` : `${name}'s`);

/** Rate split into the 1% Prop 13 base and the voter-approved remainder, in 1e-6 units so the two parts always add up on screen. */
export function splitRate(rate) {
  if (!(rate >= 0.01)) throw new Error(`seo-data: tax rate ${rate} is below the 1% Prop 13 base`);
  const u = Math.round(rate * 1e6);
  return { total: `${(u / 1e4).toFixed(4)}%`, bonds: `${((u - 10000) / 1e4).toFixed(4)}%` };
}
const pct2 = (r) => `${(r * 100).toFixed(2)}%`;

/** "St. Helena" -> "st-helena", "Alameda County" -> "alameda-county". */
export function slugify(s) {
  return String(s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
const shortCounty = (name) => name.replace(/ County$/, "");

/**
 * The one pre-fill link builder (Phase 2's readPlaceParams is its inverse).
 * Only public place names; no personal data.
 */
export function prefillLink({ st, county, city, src }) {
  const q = new URLSearchParams();
  q.set("st", st);
  q.set("county", county);
  if (city) q.set("city", city);
  q.set("src", src);
  return `${ORIGIN}/?${q.toString()}`;
}

// ── data assembly ──

/** FHFA announcement for LIMIT_YEAR, read from loanLimits.js's header so a refresh can't leave a stale date behind. */
export function parseLimitSource(loanLimitsSource) {
  const url = loanLimitsSource.match(/https:\/\/www\.fhfa\.gov\/news\/news-release\/\S+/)?.[0];
  const date = loanLimitsSource.match(/published (\d{4}-\d{2}-\d{2})/)?.[1];
  if (!url || !date) throw new Error("seo-data: FHFA announcement URL/date not found in loanLimits.js header");
  if (!url.includes(String(LIMIT_YEAR))) throw new Error(`seo-data: announcement URL ${url} is not for ${LIMIT_YEAR}`);
  const announced = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  return { url, announced };
}

function countyRecords() {
  const out = {};
  for (const state of LICENSED_STATES) {
    const st = STATE_CODE[state];
    const list = LICENSED_COUNTIES[st];
    if (!list?.length) throw new Error(`seo-data: no counties for ${st}`);
    out[st] = list.map((c) => {
      const lim = UNITS.map((u) => getCountyLimits(st, c.name, u));
      if (lim.some((l) => l.state !== st || !(l.highBalance > 0))) throw new Error(`seo-data: bad limits for ${st} ${c.name}`);
      return {
        st, state, name: c.name, short: shortCounty(c.name), fips: c.fips, slug: slugify(c.name),
        limits: lim.map((l) => l.highBalance),
        standard: lim[0].conforming,
        isHighCost: lim[0].isHighCost,
      };
    });
  }
  return out;
}

function caCities() {
  const caNames = new Set(LICENSED_COUNTIES.CA.map((c) => normalizeCounty(c.name)));
  return Object.entries(CA_CITY_COUNTY).map(([city, county]) => {
    const rate = CA_CITY_TAX_RATES[city];
    if (!(rate > 0) || rate === 0.0125) throw new Error(`seo-data: ${city} has no sourced rate (${rate})`);
    if (!caNames.has(normalizeCounty(county))) throw new Error(`seo-data: ${city}'s county ${county} is not an FHFA CA county`);
    return { city, county, rate, slug: slugify(city) };
  });
}

const sourcedCaCounties = () => new Set(Object.values(CA_CITY_COUNTY).map(normalizeCounty));

/** True when a county gets its own page (see the header comment). */
export function hasCountyPage(c) {
  return c.limits[0] > CONF_BASELINE[1] || (c.st === "CA" && sourcedCaCounties().has(normalizeCounty(c.name)));
}

const statePath = (state) => `/loan-limits/${slugify(state)}/`;
const countyPath = (c) => `${statePath(c.state)}${c.slug}/`;
const cityPath = (x) => `/property-tax/california/${x.slug}/`;
const LL_HUB = "/loan-limits/";
const TAX_HUB = "/property-tax/california/";

// ── content blocks (render.js turns these into HTML) ──
// Inline text is an array of segments: a string or { href, text }.
const p = (...content) => ({ type: "p", content });
const link = (href, text) => ({ href, text });

function unitLabel(u) { return u === 1 ? "1 unit" : `${u} units`; }

function bandsSentence(c) {
  const where = `In ${c.name}`;
  const std = c.standard;
  const top = c.limits[0];
  if (top > std) {
    return `${where}, a one-unit loan up to ${money(std)} is a standard conforming loan, and a loan from ${money(std + 1)} up to ${money(top)} is a high-balance conforming loan, which Fannie Mae and Freddie Mac still buy, though some program rules differ. A loan above ${money(top)} is a jumbo loan.`;
  }
  return `${where}, a one-unit loan up to ${money(std)} is a standard conforming loan, and anything above ${money(std)} is a jumbo loan. There is no high-balance band here.`;
}

const MEANS_INTRO = "A conforming loan is one that meets Fannie Mae and Freddie Mac's size limit and guidelines, so they can buy it from the lender.";
const MEANS_JUMBO = "Jumbo loans follow each lender's own guidelines and usually need a larger down payment, more cash in reserve and stricter qualifying.";

function countyLead(c, year) {
  const base = `The ${year} conforming loan limit for a one-unit home in ${c.name}, ${c.state} is ${money(c.limits[0])}`;
  const tail = "Loans above that amount are jumbo loans.";
  if (c.st === "HI" && c.limits[0] > CONF_CEILING[1]) {
    return `${base}, higher than Hawaii's ${money(c.standard)} statutory baseline. ${tail}`;
  }
  if (c.st === "HI") {
    return `${base}, Hawaii's statutory baseline under the Housing and Economic Recovery Act (HERA), which equals the national high-cost ceiling. ${tail}`;
  }
  if (c.limits[0] === CONF_CEILING[1]) return `${base}, the FHFA high-cost ceiling. ${tail}`;
  if (c.isHighCost) return `${base}, above the ${money(CONF_BASELINE[1])} national baseline because ${c.name} is a high-cost area. ${tail}`;
  return `${base}, the national baseline. ${tail}`;
}

function limitTable(c, year) {
  return {
    type: "table",
    caption: `${year} conforming loan limits, ${c.name}, ${c.state}`,
    head: ["Units", `${c.name} limit`, "National baseline"],
    num: [false, true, true],
    rows: UNITS.map((u, i) => ({
      cells: [
        unitLabel(u),
        c.limits[i] > CONF_BASELINE[u] ? money(c.limits[i]) : `${money(c.limits[i])} (same as the national baseline)`,
        money(CONF_BASELINE[u]),
      ],
    })),
  };
}

function cityRateTable(cities, caption, { exclude } = {}) {
  return {
    type: "table",
    caption,
    head: ["City or community", `Tax rate (FY ${CA_CITY_TAX_FY})`],
    num: [false, true],
    rows: cities
      .filter((x) => x.city !== exclude)
      .sort((a, b) => a.city.localeCompare(b.city))
      .map((x) => ({ cells: [[link(cityPath(x), x.city)], splitRate(x.rate).total] })),
  };
}

function uniqueIds(list) {
  const ids = new Set(list.map((c) => c.slug));
  if (ids.size !== list.length) throw new Error(`seo-data: duplicate county anchor in ${list[0].state}`);
  return list;
}

function crumbs(...items) {
  return [{ name: "Mortgage Blueprint", path: "/" }, ...items];
}

function page({ path, titleCore, description, h1, lead, sections, breadcrumbs, now }) {
  if (titleCore.length > 65) throw new Error(`seo-data: title over 65 chars on ${path}: ${titleCore}`);
  if (description.length > 155) throw new Error(`seo-data: description over 155 chars (${description.length}) on ${path}`);
  const url = ORIGIN + path;
  const links = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") { if (typeof v.href === "string") links.push(v.href); Object.values(v).forEach(walk); }
  };
  walk(sections);
  return {
    path, url,
    title: `${titleCore} — ${BRAND}`,
    description, h1, lead, sections, breadcrumbs,
    links: [...new Set(links)],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, item: ORIGIN + b.path })),
      },
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: h1,
        url,
        description,
        dateModified: now,
        inLanguage: "en-US",
        isPartOf: { "@type": "WebSite", name: "Mortgage Blueprint", url: `${ORIGIN}/` },
      },
    ],
  };
}

/**
 * @param {{ now: string, limitSource: { url: string, announced: string } }} opts
 *   now = build date (YYYY-MM-DD); limitSource from parseLimitSource().
 */
export function buildSite({ now, limitSource }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(now || "")) throw new Error("seo-data: buildSite needs now as YYYY-MM-DD");
  if (!limitSource?.url) throw new Error("seo-data: buildSite needs limitSource");
  const year = LIMIT_YEAR;
  const FY = CA_CITY_TAX_FY;
  const counties = countyRecords();
  const cities = caCities();
  const pages = [];
  const sourceP = p(
    "Source: ",
    link(limitSource.url, `FHFA conforming loan limit values for calendar year ${year}`),
    `, announced ${limitSource.announced}.`,
  );
  const citiesIn = (short) => cities.filter((x) => normalizeCounty(x.county) === normalizeCounty(short));

  // ── loan-limit hub ──
  const stateRows = LICENSED_STATES.map((state) => {
    const list = counties[STATE_CODE[state]];
    const ones = list.map((c) => c.limits[0]);
    const above = list.filter((c) => c.limits[0] > CONF_BASELINE[1]).length;
    return { state, list, min: Math.min(...ones), max: Math.max(...ones), above };
  });
  pages.push(page({
    now,
    path: LL_HUB,
    titleCore: `${year} Conforming Loan Limits: ${Object.values(STATE_CODE).join(", ")}`,
    description: `${year} conforming loan limits: ${money(CONF_BASELINE[1])} national baseline, ${money(CONF_CEILING[1])} high-cost ceiling. County tables for ${Object.values(STATE_CODE).join(", ")}.`,
    h1: `${year} Conforming Loan Limits by State and County`,
    lead: `The ${year} national baseline conforming loan limit for a one-unit home is ${money(CONF_BASELINE[1])}, and the high-cost ceiling is ${money(CONF_CEILING[1])}, according to the FHFA. Each county's limit falls somewhere from the baseline to the ceiling; Hawaii and a few others have special rules.`,
    breadcrumbs: crumbs({ name: "Loan limits", path: LL_HUB }),
    sections: [
      {
        heading: "Limits by state",
        blocks: [{
          type: "table",
          caption: `${year} one-unit conforming loan limits by state`,
          head: ["State", "Counties", "Above baseline", "One-unit limit range"],
          num: [false, true, true, true],
          rows: stateRows.map((r) => ({
            cells: [[link(statePath(r.state), r.state)], String(r.list.length), String(r.above),
              r.min === r.max ? money(r.min) : `${money(r.min)} to ${money(r.max)}`],
          })),
        }],
      },
      {
        heading: "National baseline and ceiling",
        blocks: [{
          type: "table",
          caption: `${year} national conforming loan limits by number of units`,
          head: ["Units", "Baseline", "High-cost ceiling"],
          num: [false, true, true],
          rows: UNITS.map((u) => ({ cells: [unitLabel(u), money(CONF_BASELINE[u]), money(CONF_CEILING[u])] })),
        }],
      },
      {
        heading: "Conforming, high-balance and jumbo",
        blocks: [
          p(MEANS_INTRO),
          p(`A standard conforming loan is at or below the baseline (${money(CONF_BASELINE[1])} for one unit in most of the country). In a high-cost county, a loan above the baseline but at or below that county's limit is a high-balance conforming loan. Anything above the county limit is a jumbo loan.`),
          p(MEANS_JUMBO),
        ],
      },
      { heading: "Source", blocks: [sourceP] },
    ],
  }));

  // ── state pages ──
  for (const r of stateRows) {
    const { state, list } = r;
    const st = STATE_CODE[state];
    let lead;
    if (st === "HI") {
      const hiStd = list[0].standard;
      const higher = list.filter((c) => c.limits[0] > hiStd);
      const atBase = list.filter((c) => c.limits[0] === hiStd).map((c) => c.short);
      const atBaseText = atBase.length > 1 ? `${atBase.slice(0, -1).join(", ")} and ${atBase[atBase.length - 1]} counties are` : `${atBase[0]} County is`;
      lead = `Every Hawaii county has a ${year} one-unit conforming loan limit of at least ${money(hiStd)}. That's Hawaii's statutory baseline under the Housing and Economic Recovery Act (HERA), equal to the national high-cost ceiling, so ${atBaseText} at ${money(hiStd)} without being high-cost areas. ` +
        `${higher.map((c) => c.short).join(" and ")} ${higher.length === 1 ? "County is" : "counties are"} higher, at ${money(Math.max(...higher.map((c) => c.limits[0])))}.`;
    } else if (r.above === 0) {
      lead = `All ${list.length} ${state} counties use the national baseline of ${money(CONF_BASELINE[1])} for a one-unit home in ${year}. Loans above that amount are jumbo loans.`;
    } else {
      const top = r.max === CONF_CEILING[1] ? `the high-cost ceiling of ${money(r.max)}` : money(r.max);
      lead = `In ${year}, ${r.above} of ${possessive(state)} ${list.length} counties have conforming loan limits above the national baseline of ${money(CONF_BASELINE[1])} for a one-unit home, up to ${top}. The other ${list.length - r.above} use the baseline.`;
    }
    const withPages = list.filter(hasCountyPage);
    const sections = [
      {
        heading: `${state} county limits`,
        blocks: [{
          type: "table",
          caption: `${year} conforming loan limits by county, ${state}`,
          head: ["County", "1 unit", "2 units", "3 units", "4 units"],
          num: [false, true, true, true, true],
          rows: uniqueIds(list).map((c) => ({
            id: c.slug,
            mark: c.isHighCost ? "High-cost" : null,
            cells: [hasCountyPage(c) ? [link(countyPath(c), c.name)] : c.name, ...c.limits.map(money)],
          })),
        }],
      },
      {
        heading: "What these limits mean",
        blocks: [
          p(MEANS_INTRO),
          p(st === "HI"
            ? `In Hawaii, a loan up to ${money(list[0].standard)} for one unit is a standard conforming loan. In a county with a higher limit, the amount above that up to the county limit is high-balance conforming. Above the county limit, it's a jumbo loan.`
            : `A loan at or below ${money(CONF_BASELINE[1])} for one unit is a standard conforming loan. In a high-cost county, a loan above that up to the county limit is a high-balance conforming loan. Above the county limit, it's a jumbo loan.`),
          p(MEANS_JUMBO),
        ],
      },
    ];
    if (withPages.length) {
      sections.push({ heading: `${state} counties with their own page`, blocks: [{ type: "list", items: withPages.map((c) => [link(countyPath(c), `${c.name}: ${money(c.limits[0])}`)]) }] });
    }
    if (st === "CA") sections.push({ heading: "Property tax", blocks: [p(link(TAX_HUB, `California property tax rates by city (FY ${FY})`), ", for the Bay Area cities with published county rate-book data.")] });
    sections.push(
      { heading: "Other states", blocks: [{ type: "list", items: LICENSED_STATES.filter((s) => s !== state).map((s) => [link(statePath(s), `${s} loan limits`)]) }] },
      { heading: "Source", blocks: [sourceP] },
      { blocks: [{ type: "cta", href: `${ORIGIN}/`, text: "Run your numbers in Mortgage Blueprint" }] },
    );
    const minMax = r.min === r.max ? money(r.min) : `${money(r.min)} to ${money(r.max)}`;
    pages.push(page({
      now,
      path: statePath(state),
      titleCore: `${state} ${year} Conforming Loan Limits by County`,
      description: `${year} conforming loan limits for all ${list.length} ${state} counties: ${minMax} for one unit, 1 to 4 unit limits from FHFA.`,
      h1: `${year} Conforming Loan Limits by County in ${state}`,
      lead,
      breadcrumbs: crumbs({ name: "Loan limits", path: LL_HUB }, { name: state, path: statePath(state) }),
      sections,
    }));
  }

  // ── county pages ──
  for (const state of LICENSED_STATES) {
    const st = STATE_CODE[state];
    const list = counties[st].filter(hasCountyPage);
    for (const [i, c] of list.entries()) {
      const others = list.filter((o) => o !== c);
      // The 6 closest by alphabetical position (wrapping): deterministic, no adjacency data needed.
      const related = others
        .map((o) => ({ o, d: Math.min(Math.abs(list.indexOf(o) - i), list.length - Math.abs(list.indexOf(o) - i)) }))
        .sort((a, b) => a.d - b.d || a.o.name.localeCompare(b.o.name))
        .slice(0, 6).map((x) => x.o)
        .sort((a, b) => a.name.localeCompare(b.name));
      const sections = [
        { heading: `${c.name} limits by number of units`, blocks: [limitTable(c, year)] },
        { heading: "What this means", blocks: [p(MEANS_INTRO), p(bandsSentence(c)), p(MEANS_JUMBO)] },
      ];
      if (st === "CA") {
        const cs = citiesIn(c.short);
        if (cs.length) {
          sections.push({
            heading: `Property tax rates in ${c.name}`,
            blocks: [
              p(`Fiscal year ${FY} rates from the county's tax rate book, for each city's primary tax rate area. Each rate is the 1% Proposition 13 base plus voter-approved bonds.`),
              cityRateTable(cs, `Property tax rates, ${c.name} (FY ${FY})`),
            ],
          });
        }
      } else {
        const avg = STATE_PROPERTY_TAX_RATES[state];
        if (avg) sections.push({ heading: "Property tax", blocks: [p(`${possessive(state)} average effective property tax rate is ${pct2(avg)} of home value (statewide average; your county and city will differ).`)] });
      }
      sections.push(
        { heading: "Source", blocks: [sourceP] },
        { blocks: [{ type: "cta", href: prefillLink({ st, county: c.short, src: "seo-ll" }), text: `Run your numbers for ${c.name} in Mortgage Blueprint` }] },
        {
          heading: "Related",
          blocks: [{ type: "list", items: [[link(statePath(state), `All ${state} county loan limits`)], ...related.map((o) => [link(countyPath(o), `${o.name}: ${money(o.limits[0])}`)])] }],
        },
      );
      const abbrName = `${c.name}, ${st}`;
      pages.push(page({
        now,
        path: countyPath(c),
        titleCore: `${abbrName} ${year} Loan Limits`,
        description: `${year} FHFA conforming loan limit in ${abbrName}: ${money(c.limits[0])} for one unit, ${money(c.limits[3])} for four units, and what it means for jumbo loans.`,
        h1: `${year} Conforming Loan Limits in ${c.name}, ${state}`,
        lead: countyLead(c, year),
        breadcrumbs: crumbs({ name: "Loan limits", path: LL_HUB }, { name: state, path: statePath(state) }, { name: c.name, path: countyPath(c) }),
        sections,
      }));
    }
  }

  // ── CA property-tax hub ──
  const caByCounty = new Map();
  for (const x of cities) {
    if (!caByCounty.has(x.county)) caByCounty.set(x.county, []);
    caByCounty.get(x.county).push(x);
  }
  const sortedRates = [...cities].sort((a, b) => a.rate - b.rate);
  const lo = sortedRates[0];
  const hi = sortedRates[sortedRates.length - 1];
  const caCounty = (short) => counties.CA.find((c) => normalizeCounty(c.name) === normalizeCounty(short));
  pages.push(page({
    now,
    path: TAX_HUB,
    titleCore: `California Property Tax Rates by City (FY ${FY})`,
    description: `FY ${FY} property tax rates for ${cities.length} Bay Area cities, from ${splitRate(lo.rate).total} to ${splitRate(hi.rate).total}: the 1% Prop 13 base plus voter-approved bonds.`,
    h1: `California Property Tax Rates by City (FY ${FY})`,
    lead: `California property tax is 1% of assessed value under Proposition 13, plus voter-approved bonds. In the ${cities.length} Bay Area cities and communities listed here, the fiscal year ${FY} rate runs from ${splitRate(lo.rate).total} (${lo.city}) to ${splitRate(hi.rate).total} (${hi.city}).`,
    breadcrumbs: crumbs({ name: "California property tax", path: TAX_HUB }),
    sections: [
      {
        heading: "How California property tax works",
        blocks: [
          p("When you buy a home in California, the purchase price becomes its assessed value. The tax is that value times the rate for the home's tax rate area: the 1% Proposition 13 base plus any voter-approved bonds."),
          p("After the purchase, the assessed value can rise by at most 2% a year until the home sells again, even if market values climb faster."),
          p("Buyers also get a supplemental tax bill after closing, covering the difference between the old owner's assessed value and the new one for the rest of the fiscal year."),
          p("The rates here do not include Mello-Roos (Community Facilities District) taxes, flat parcel taxes or fixed special assessments, which can add a noticeable amount on some homes."),
        ],
      },
      ...[...caByCounty.entries()].map(([county, cs]) => {
        const cc = caCounty(county);
        const label = county === "San Francisco" ? "San Francisco" : `${county} County`;
        return {
          heading: label,
          blocks: [
            cityRateTable(cs, `Property tax rates, ${label} (FY ${FY})`),
            p(link(countyPath(cc), `${cc.name} conforming loan limit: ${money(cc.limits[0])}`)),
          ],
        };
      }),
      {
        heading: "Source",
        blocks: [p(`Each county's published tax rate book (San Francisco: the Treasurer's secured rate) for fiscal year ${FY}. Each rate is the total ad valorem rate for the city's primary or most common tax rate area; other areas in the same city can differ.`)],
      },
    ],
  }));

  // ── CA city pages ──
  for (const x of cities) {
    const cc = caCounty(x.county);
    const { total, bonds } = splitRate(x.rate);
    const rows = TAX_PRICES.map((price) => {
      const annual = cents(price * x.rate);
      return { price, annual, monthly: cents(annual / 12) };
    });
    const ex = rows.find((r) => r.price === PRICE_EXAMPLE);
    const neighbors = citiesIn(x.county).filter((o) => o.city !== x.city);
    const sections = [
      {
        heading: "First-year property tax by purchase price",
        blocks: [
          p(`Under Proposition 13 the purchase price becomes the assessed value, so the first-year tax is the price times ${total}.`),
          {
            type: "table",
            caption: `Estimated first-year property tax in ${x.city}, CA at ${total} (FY ${FY})`,
            head: ["Purchase price", "Annual tax", "Monthly"],
            num: [true, true, true],
            rows: rows.map((r) => ({ cells: [money(r.price), money2(r.annual), money2(r.monthly)] })),
          },
        ],
      },
      {
        heading: "What this rate leaves out",
        blocks: [{
          type: "list",
          items: [
            [`This is the rate for ${possessive(x.city)} primary tax rate area. Other tax rate areas in the same city can have a different rate.`],
            ["Mello-Roos (Community Facilities District) taxes, flat parcel taxes and fixed special assessments are not included. Check the property's tax bill."],
            ["Buyers get a supplemental tax bill after purchase for the change in assessed value."],
            ["Under Proposition 13, the assessed value can rise by at most 2% a year while you own the home."],
          ],
        }],
      },
      {
        heading: "Loan limits",
        blocks: [p(`${x.city} is in ${cc.name}, where the ${year} conforming loan limit for a one-unit home is ${money(cc.limits[0])}. `, link(countyPath(cc), `${cc.name} loan limits`), ".")],
      },
    ];
    if (neighbors.length) sections.push({ heading: `Other cities in ${cc.name}`, blocks: [cityRateTable(neighbors, `Property tax rates, ${cc.name} (FY ${FY})`)] });
    sections.push(
      { heading: "Source", blocks: [p(`${possessive(cc.name)} published tax rates for fiscal year ${FY}. `, link(TAX_HUB, "All sourced California city rates"), ".")] },
      { blocks: [{ type: "cta", href: prefillLink({ st: "CA", county: x.county, city: x.city, src: "seo-ptax" }), text: `See ${possessive(x.city)} taxes in your payment in Mortgage Blueprint` }] },
    );
    pages.push(page({
      now,
      path: cityPath(x),
      titleCore: `${x.city}, CA Property Tax Rate (FY ${FY})`,
      description: `${x.city}, CA property tax rate: ${total} for FY ${FY}. On a ${money(PRICE_EXAMPLE)} purchase that's about ${money(Math.round(ex.annual))} a year. Prop 13 basics and caveats.`,
      h1: `${x.city}, CA Property Tax Rate (FY ${FY})`,
      lead: `${possessive(x.city)} property tax rate is ${total} for fiscal year ${FY} in its primary tax rate area: the 1% Proposition 13 base plus ${bonds} in voter-approved bonds.`,
      breadcrumbs: crumbs({ name: "California property tax", path: TAX_HUB }, { name: x.city, path: cityPath(x) }),
      sections,
    }));
    pages[pages.length - 1].taxRows = rows;
  }

  // ── integrity ──
  const seen = new Set();
  for (const pg of pages) {
    if (seen.has(pg.path)) throw new Error(`seo-data: slug collision at ${pg.path}`);
    seen.add(pg.path);
  }
  for (const pg of pages) {
    for (const href of pg.links) {
      if (href.startsWith("/") && href !== "/" && !seen.has(href)) throw new Error(`seo-data: ${pg.path} links to missing page ${href}`);
    }
  }
  return { pages, sitemap: pages.map((pg) => ({ loc: pg.url, lastmod: now })) };
}
