// src/data/transferTax.js
//
// City transfer-tax tiers + lookups, shared by the Costs tab, the Sell tab and
// the Workspace Seller Net pane (moved out of MortgageBlueprint.jsx 2026-09-28).

// City transfer tax rates: $ per $1,000 of sale price, applied to the WHOLE price for the
// matching tier (price <= maxPrice). Entries with `marginal` are taxed on the portion within
// each band instead (Santa Cruz Measure C). Source: Fidelity National Title "California
// Customary Closing Costs and Transfer Tax", revised 7/23/2026. Cities not listed in that guide
// have NO city transfer tax (county $1.10/$1K only) and must not appear here.
export const TRANSFER_TAX_CITIES = [
 { label: "Not listed", city: "Not listed", rate: 0, maxPrice: Infinity, state: "*" },
 // ── California ──
 { label: "Alameda", city: "Alameda", rate: 12, maxPrice: Infinity, state: "California" },
 { label: "Albany", city: "Albany", rate: 15, maxPrice: Infinity, state: "California" },
 { label: "Berkeley", city: "Berkeley", rate: 15, maxPrice: 1700000, state: "California" },
 { label: "Berkeley >$1.7M", city: "Berkeley", rate: 25, maxPrice: Infinity, state: "California" }, // eff. 1/1/2026
 { label: "Emeryville", city: "Emeryville", rate: 12, maxPrice: 1000000, state: "California" },
 { label: "Emeryville $1-2M", city: "Emeryville", rate: 15, maxPrice: 2000000, state: "California" },
 { label: "Emeryville >$2M", city: "Emeryville", rate: 25, maxPrice: Infinity, state: "California" },
 { label: "Hayward", city: "Hayward", rate: 8.5, maxPrice: Infinity, state: "California" },
 { label: "Oakland", city: "Oakland", rate: 10, maxPrice: 300000, state: "California" },
 { label: "Oakland $300K-$2M", city: "Oakland", rate: 15, maxPrice: 2000000, state: "California" },
 { label: "Oakland $2-5M", city: "Oakland", rate: 17.5, maxPrice: 5000000, state: "California" },
 { label: "Oakland >$5M", city: "Oakland", rate: 25, maxPrice: Infinity, state: "California" },
 { label: "Piedmont", city: "Piedmont", rate: 13, maxPrice: Infinity, state: "California" },
 { label: "San Leandro", city: "San Leandro", rate: 11, maxPrice: Infinity, state: "California" },
 { label: "El Cerrito", city: "El Cerrito", rate: 12, maxPrice: Infinity, state: "California" },
 { label: "Richmond", city: "Richmond", rate: 7, maxPrice: 1000000, state: "California" },
 { label: "Richmond $1-3M", city: "Richmond", rate: 12.5, maxPrice: 3000000, state: "California" },
 { label: "Richmond $3-10M", city: "Richmond", rate: 25, maxPrice: 10000000, state: "California" },
 { label: "Richmond >$10M", city: "Richmond", rate: 30, maxPrice: Infinity, state: "California" },
 { label: "Culver City", city: "Culver City", rate: 4.5, maxPrice: 1500000, state: "California" },
 { label: "Culver City $1.5-3M", city: "Culver City", rate: 15, maxPrice: 3000000, state: "California" },
 { label: "Culver City $3-10M", city: "Culver City", rate: 30, maxPrice: 10000000, state: "California" },
 { label: "Culver City >$10M", city: "Culver City", rate: 40, maxPrice: Infinity, state: "California" },
 // Los Angeles: $4.50 base PLUS Measure ULA (thresholds eff. 6/30/2026): +4% above $5.4M, +5.5% at/above $10.9M
 { label: "Los Angeles", city: "Los Angeles", rate: 4.5, maxPrice: 5400000, state: "California" },
 { label: "Los Angeles $5.4-10.9M", city: "Los Angeles", rate: 44.5, maxPrice: 10899999, state: "California" },
 { label: "Los Angeles >$10.9M", city: "Los Angeles", rate: 59.5, maxPrice: Infinity, state: "California" },
 { label: "Pomona", city: "Pomona", rate: 2.2, maxPrice: Infinity, state: "California" },
 { label: "Redondo Beach", city: "Redondo Beach", rate: 2.2, maxPrice: Infinity, state: "California" },
 { label: "Santa Monica", city: "Santa Monica", rate: 3, maxPrice: 5000000, state: "California" },
 { label: "Santa Monica $5-8M", city: "Santa Monica", rate: 6, maxPrice: 8000000, state: "California" },
 { label: "Santa Monica >$8M", city: "Santa Monica", rate: 56, maxPrice: Infinity, state: "California" },
 { label: "San Rafael", city: "San Rafael", rate: 2, maxPrice: Infinity, state: "California" },
 { label: "Riverside City", city: "Riverside City", rate: 1.1, maxPrice: Infinity, state: "California" },
 { label: "Sacramento", city: "Sacramento", rate: 2.75, maxPrice: Infinity, state: "California" },
 { label: "San Francisco", city: "San Francisco", rate: 5, maxPrice: 250000, sfSeller: true, state: "California" },
 { label: "San Francisco $250K-$1M", city: "San Francisco", rate: 6.8, maxPrice: 1000000, sfSeller: true, state: "California" },
 { label: "San Francisco $1-5M", city: "San Francisco", rate: 7.5, maxPrice: 5000000, sfSeller: true, state: "California" },
 { label: "San Francisco $5-10M", city: "San Francisco", rate: 22.5, maxPrice: 10000000, sfSeller: true, state: "California" },
 { label: "San Francisco $10-25M", city: "San Francisco", rate: 55, maxPrice: 25000000, sfSeller: true, state: "California" },
 { label: "San Francisco >$25M", city: "San Francisco", rate: 60, maxPrice: Infinity, sfSeller: true, state: "California" },
 { label: "San Mateo", city: "San Mateo", rate: 5, maxPrice: 10000000, state: "California" },
 { label: "San Mateo >$10M", city: "San Mateo", rate: 15, maxPrice: Infinity, state: "California" },
 { label: "Hillsborough", city: "Hillsborough", rate: 0.3, maxPrice: Infinity, state: "California" },
 { label: "Mountain View", city: "Mountain View", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Palo Alto", city: "Palo Alto", rate: 3.3, maxPrice: Infinity, state: "California" },
 // San Jose: $3.30 base PLUS Measure E (eff. 7/1/2025): +0.75% from $2.3M, +1.0% over $5M, +1.5% over $10M
 { label: "San Jose", city: "San Jose", rate: 3.3, maxPrice: 2299999, state: "California" },
 { label: "San Jose $2.3-5M", city: "San Jose", rate: 10.8, maxPrice: 5000000, state: "California" },
 { label: "San Jose $5-10M", city: "San Jose", rate: 13.3, maxPrice: 10000000, state: "California" },
 { label: "San Jose >$10M", city: "San Jose", rate: 18.3, maxPrice: Infinity, state: "California" },
 { label: "Vallejo", city: "Vallejo", rate: 3.3, maxPrice: Infinity, state: "California" },
 { label: "Petaluma", city: "Petaluma", rate: 2, maxPrice: Infinity, state: "California" },
 { label: "Santa Rosa", city: "Santa Rosa", rate: 2, maxPrice: Infinity, state: "California" },
 // City of Santa Cruz, Measure C (eff. 7/1/2026): no tax under $1.8M, then taxed on the PORTION within each
 // band (0.5% $1.8-2.5M, 1.0% $2.5-3.5M, 1.5% $3.5-4.5M, 2.0% above), capped at $200,000 per transaction.
 { label: "Santa Cruz", city: "Santa Cruz", rate: 0, maxPrice: Infinity, state: "California",
   marginal: [{ upTo: 1800000, pct: 0 }, { upTo: 2500000, pct: 0.005 }, { upTo: 3500000, pct: 0.01 }, { upTo: 4500000, pct: 0.015 }, { upTo: Infinity, pct: 0.02 }], cap: 200000 },
 // Long Beach + Pasadena: not in the Fidelity 7/2026 guide; kept pending confirmation with title.
 { label: "Long Beach", city: "Long Beach", rate: 2.2, maxPrice: Infinity, state: "California" },
 { label: "Pasadena", city: "Pasadena", rate: 2.2, maxPrice: Infinity, state: "California" },
 // ── New York ──
 { label: "NY State (outside NYC)", city: "NY State", rate: 4, maxPrice: Infinity, state: "New York", note: "$2/$500 state" },
 { label: "NYC 1-3 Family <$500K", city: "NYC", rate: 10, maxPrice: 500000, state: "New York", note: "1% state+city" },
 { label: "NYC 1-3 Family $500K+", city: "NYC", rate: 14.25, maxPrice: 3000000, state: "New York", note: "Buyer mansion tax applies >$1M" },
 { label: "NYC 1-3 Family $3M+", city: "NYC", rate: 16.25, maxPrice: Infinity, state: "New York" },
 // ── Washington State (REET) ──
 { label: "WA State <$525K", city: "WA State", rate: 16, maxPrice: 525000, state: "Washington", note: "Real estate excise tax" },
 { label: "WA State $525K-$1.525M", city: "WA State", rate: 17.6, maxPrice: 1525000, state: "Washington" },
 { label: "WA State $1.525-$3.025M", city: "WA State", rate: 28, maxPrice: 3025000, state: "Washington" },
 { label: "WA State >$3.025M", city: "WA State", rate: 30, maxPrice: Infinity, state: "Washington" },
 // ── Washington DC ──
 { label: "DC <$400K", city: "Washington DC", rate: 11, maxPrice: 400000, state: "District of Columbia", note: "Recordation + transfer" },
 { label: "DC $400K+", city: "Washington DC", rate: 14.5, maxPrice: Infinity, state: "District of Columbia" },
 // ── Illinois / Chicago ──
 { label: "Chicago", city: "Chicago", rate: 10.5, maxPrice: 1000000, state: "Illinois", note: "City+county+state" },
 { label: "Chicago $1M+", city: "Chicago", rate: 13.5, maxPrice: Infinity, state: "Illinois" },
 { label: "IL (outside Chicago)", city: "IL State", rate: 3, maxPrice: Infinity, state: "Illinois", note: "State + county" },
 // ── Pennsylvania ──
 { label: "Philadelphia", city: "Philadelphia", rate: 41.28, maxPrice: Infinity, state: "Pennsylvania", note: "4.128% city+state combined" },
 { label: "Pittsburgh", city: "Pittsburgh", rate: 40, maxPrice: Infinity, state: "Pennsylvania", note: "4% combined" },
 { label: "PA (other)", city: "PA State", rate: 20, maxPrice: Infinity, state: "Pennsylvania", note: "2% state split buyer/seller" },
 // ── Florida (documentary stamp) ──
 { label: "FL (except Miami-Dade)", city: "FL State", rate: 7, maxPrice: Infinity, state: "Florida", note: "$0.70/$100 doc stamp" },
 { label: "Miami-Dade", city: "Miami-Dade", rate: 6, maxPrice: Infinity, state: "Florida", note: "$0.60/$100 single-family" },
 // ── Massachusetts ──
 { label: "Massachusetts", city: "MA State", rate: 4.56, maxPrice: Infinity, state: "Massachusetts", note: "$4.56/$1000 excise" },
 { label: "Boston", city: "Boston", rate: 4.56, maxPrice: Infinity, state: "Massachusetts", note: "Same as state rate" },
 // ── Maryland ──
 { label: "Maryland", city: "MD State", rate: 5, maxPrice: Infinity, state: "Maryland", note: "State transfer tax" },
 { label: "MD - Howard Co", city: "Howard County MD", rate: 10, maxPrice: Infinity, state: "Maryland", note: "County + state" },
 { label: "MD - Montgomery Co", city: "Montgomery County MD", rate: 10, maxPrice: Infinity, state: "Maryland" },
 // ── Colorado ──
 { label: "CO (most counties)", city: "CO State", rate: 1, maxPrice: Infinity, state: "Colorado", note: "$0.01/$100 doc fee" },
 // ── Georgia ──
 { label: "Georgia", city: "GA State", rate: 1, maxPrice: Infinity, state: "Georgia", note: "$1/$1000 state transfer" },
 // ── Virginia ──
 { label: "VA State", city: "VA State", rate: 3.5, maxPrice: Infinity, state: "Virginia", note: "Grantee + grantor combined" },
 { label: "VA - NOVA (Fairfax/Arlington)", city: "Northern Virginia", rate: 5.83, maxPrice: Infinity, state: "Virginia", note: "Regional + state" },
 // ── Oregon ──
 { label: "OR <$100K", city: "OR State", rate: 1, maxPrice: 100000, state: "Oregon" },
 { label: "OR $100K+", city: "OR State", rate: 1, maxPrice: Infinity, state: "Oregon", note: "$1/$1000 base" },
 { label: "Portland Metro", city: "Portland", rate: 6, maxPrice: Infinity, state: "Oregon", note: "Metro + state combined" },
 // ── Nevada ──
 { label: "Clark Co (Las Vegas)", city: "Las Vegas", rate: 5.1, maxPrice: Infinity, state: "Nevada", note: "Real property transfer tax" },
 // ── Hawaii ──
 { label: "HI <$600K", city: "HI State", rate: 1, maxPrice: 600000, state: "Hawaii", note: "Conveyance tax" },
 { label: "HI $600K-$1M", city: "HI State", rate: 2, maxPrice: 1000000, state: "Hawaii" },
 { label: "HI $1-2M", city: "HI State", rate: 3, maxPrice: 2000000, state: "Hawaii" },
 { label: "HI $2-4M", city: "HI State", rate: 5, maxPrice: 4000000, state: "Hawaii" },
 { label: "HI $4-6M", city: "HI State", rate: 7.5, maxPrice: 6000000, state: "Hawaii" },
 { label: "HI $6-10M", city: "HI State", rate: 10, maxPrice: 10000000, state: "Hawaii" },
 { label: "HI >$10M", city: "HI State", rate: 10, maxPrice: Infinity, state: "Hawaii" },
 // ── Connecticut ──
 { label: "CT <$800K", city: "CT State", rate: 7.5, maxPrice: 800000, state: "Connecticut", note: "Conveyance tax" },
 { label: "CT $800K-$2.5M", city: "CT State", rate: 12.5, maxPrice: 2500000, state: "Connecticut" },
 { label: "CT >$2.5M", city: "CT State", rate: 22.5, maxPrice: Infinity, state: "Connecticut" },
 // ── New Jersey ──
 { label: "NJ <$150K", city: "NJ State", rate: 2, maxPrice: 150000, state: "New Jersey", note: "Realty transfer fee" },
 { label: "NJ $150K-$200K", city: "NJ State", rate: 3.35, maxPrice: 200000, state: "New Jersey" },
 { label: "NJ $200K-$350K", city: "NJ State", rate: 4.85, maxPrice: 350000, state: "New Jersey" },
 { label: "NJ $350K-$1M", city: "NJ State", rate: 5.8, maxPrice: 1000000, state: "New Jersey" },
 { label: "NJ $1M+", city: "NJ State", rate: 8.97, maxPrice: Infinity, state: "New Jersey", note: "Includes mansion tax" },
 // ── Michigan ──
 { label: "Michigan", city: "MI State", rate: 7.5, maxPrice: Infinity, state: "Michigan", note: "State + county transfer" },
 // ── Minnesota ──
 { label: "Minnesota", city: "MN State", rate: 3.3, maxPrice: Infinity, state: "Minnesota", note: "State deed tax" },
 // ── Tennessee ──
 { label: "Tennessee", city: "TN State", rate: 3.7, maxPrice: Infinity, state: "Tennessee", note: "Transfer tax" },
 // ── Arizona ──
 { label: "Arizona", city: "AZ State", rate: 0, maxPrice: Infinity, state: "Arizona", note: "No transfer tax" },
 // ── Texas ──
 { label: "Texas", city: "TX State", rate: 0, maxPrice: Infinity, state: "Texas", note: "No transfer tax" },
];
export const TT_CITY_NAMES = [...new Set(TRANSFER_TAX_CITIES.map(t => t.city))];
export const getTTCitiesForState = (st) => [...new Set(TRANSFER_TAX_CITIES.filter(t => t.state === "*" || t.state === st).map(t => t.city))];
// Returns the matching tier for a city + price. Always carries `amount` (exact city tax in $) and
// `rate` ($/$1K). For marginal cities `rate` is the effective rate at this price, rounded for display.
export const getTTForCity = (cityName, price) => {
 const tiers = TRANSFER_TAX_CITIES.filter(t => t.city === cityName).sort((a, b) => a.maxPrice - b.maxPrice);
 if (tiers.length === 0) return { ...TRANSFER_TAX_CITIES[0], amount: 0 };
 const p = Number(price) || 0;
 const entry = tiers.find(t => p <= t.maxPrice) || tiers[tiers.length - 1];
 if (entry.marginal) {
  let tax = 0, lower = 0;
  for (const band of entry.marginal) {
   if (p <= lower) break;
   tax += (Math.min(p, band.upTo) - lower) * band.pct;
   lower = band.upTo;
  }
  if (entry.cap != null) tax = Math.min(tax, entry.cap);
  const eff = p > 0 ? tax / (p / 1000) : 0;
  return { ...entry, amount: tax, rate: Math.round(eff * 100) / 100 };
 }
 return { ...entry, amount: p / 1000 * entry.rate };
};

// CA Documentary Transfer Tax (county), $ per $1,000. San Francisco is a
// consolidated city-county: its tiers above ARE the whole documentary transfer
// tax, so no separate county $1.10 stacks on top.
export const countyTTRateFor = (state, cityName) =>
 state === "California" && cityName !== "San Francisco" ? 1.10 : 0;
