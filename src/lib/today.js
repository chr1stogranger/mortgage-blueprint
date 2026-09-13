// Local calendar date as YYYY-MM-DD. `new Date().toISOString()` is UTC, so
// after 5 PM Pacific (2 PM Hawaii) it already says tomorrow, which stamped
// income end dates, rate "as of" dates and export filenames a day ahead.
export const todayLocal = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
