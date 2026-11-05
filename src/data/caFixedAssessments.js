// ═══ CALIFORNIA FIXED ASSESSMENTS: STARTING ESTIMATES ═══
// Fixed assessments (Mello-Roos, parcel taxes, special assessments) sit on the
// tax bill on top of the rate, vary by parcel, and have no published city table.
// So unlike caTaxRates.js these are estimates, not sourced figures, and every
// page showing one must say so and point at the actual bill.
//
// The default matches the app's starting value (fixedAssessments in
// MortgageBlueprint.jsx). City ranges are Christo's working experience
// (2026-11-04); `est` is a round number near the middle of the range.

export const CA_FIXED_ASSESSMENT_DEFAULT = 1500;

export const CA_FIXED_ASSESSMENT_CITIES = {
  "Berkeley": { est: 5000, low: 3000, high: 7000 },
  "San Francisco": { est: 1000, low: 750, high: 1200 },
};
