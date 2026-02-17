export default async function handler(req, res) {
  const apiKey = process.env.VITE_FRED_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FRED API key not configured" });
  }

  const base = "https://api.stlouisfed.org/fred/series/observations";
  const qp = (id) =>
    `${base}?series_id=${id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;

  try {
    const [r30, r15, rArm] = await Promise.all([
      fetch(qp("MORTGAGE30US")).then((r) => r.json()),
      fetch(qp("MORTGAGE15US")).then((r) => r.json()),
      fetch(qp("MORTGAGE5US")).then((r) => r.json()),
    ]);

    const v30 = parseFloat(r30?.observations?.[0]?.value);
    const v15 = parseFloat(r15?.observations?.[0]?.value);
    const vArm = parseFloat(rArm?.observations?.[0]?.value);

    if (!v30 || v30 < 2 || v30 > 15) {
      return res.status(502).json({ error: "Invalid rate data from FRED" });
    }

    const rates = {
      date: r30.observations[0].date,
      "30yr_fixed": v30,
      "15yr_fixed": v15 || +(v30 - 0.6).toFixed(2),
      "30yr_fha": +(v30 - 0.25).toFixed(2),
      "30yr_va": +(v30 - 0.35).toFixed(2),
      "30yr_jumbo": +(v30 + 0.25).toFixed(2),
      "5yr_arm": vArm || +(v30 - 0.3).toFixed(2),
      source: "FRED / Freddie Mac PMMS",
    };

    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json(rates);
  } catch (e) {
    return res.status(502).json({ error: "FRED API request failed: " + e.message });
  }
}
