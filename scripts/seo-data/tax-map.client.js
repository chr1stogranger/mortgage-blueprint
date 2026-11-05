// Clickable California map for the CA tax hub, served as /seo/tax-map.js (an ES
// module, copied as-is by scripts/seo-data-pages.mjs). tax-calc.client.js loads
// it only when the page has a [data-taxmap] element.
//
// Geometry comes from /seo/ca-tax-map.json (see build-ca-map.mjs), already
// projected to map units, so this file draws SVG and handles the pointer. Rates
// come from the calculator's data, so the map can't disagree with the numbers
// next to it. The city search is the keyboard route to the same selection.

const REGIONS = [
  ["California", null],
  ["Bay Area", ["Alameda", "Contra Costa", "San Mateo", "San Francisco", "Marin", "Santa Clara", "Napa", "Solano", "Sonoma"]],
  ["Sacramento", ["Sacramento", "Yolo", "Placer"]],
  ["Central Valley", ["San Joaquin", "Stanislaus", "Merced", "Madera", "Fresno", "Kings", "Tulare", "Kern"]],
  ["Central Coast", ["Santa Cruz", "Monterey", "San Benito", "San Luis Obispo", "Santa Barbara"]],
  ["Los Angeles + Orange", ["Los Angeles", "Orange"]],
  ["San Diego", ["San Diego"]],
];
const MAX_K = 150;
const DOT_PX = 3.5;
const DOT_PX_SMALL = 2.5; // on a phone-width map, where full-size dots bury the Bay Area
const NEAR_PX = 14; // a pointer this close to a dot counts as on it
const LABEL_MIN_PX = 34; // a shape this wide on screen earns a name
const CITY_FRAME_UNITS = 600; // 60 km across when zooming to a small city
const MAX_LABELS = 40;
const AUTO_FRAME_BELOW = 0.25; // screen px per map unit

/** Quantile cut points, rounded for the legend: rates cluster, so even steps would paint nearly everything one shade. */
export function rateBreaks(pcts, n = 5) {
  const s = [...pcts].sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < n; i++) {
    const b = Math.round(s[Math.floor((i * s.length) / n)] * 100) / 100;
    if (!out.includes(b)) out.push(b);
  }
  return out;
}

export const bucketOf = (pct, breaks) => {
  let i = 0;
  while (i < breaks.length && pct >= breaks[i]) i++;
  return i;
};

const countyLabel = (county) => (county === "San Francisco" ? "San Francisco" : `${county} County`);
const pct4 = (p) => `${p.toFixed(4)}%`;

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};
const link = (href, text) => {
  const a = h("a", null, text);
  a.href = href;
  return a;
};

/**
 * @param {HTMLElement} el  the [data-taxmap] element
 * @param {{ data: { cities: object[], bills: object, countyPaths: object }, onPick: (city: string) => void }} opts
 * @returns {Promise<{ select: (city: string, opts?: { frame?: boolean | "auto" }) => void }>}
 */
export async function initTaxMap(el, { data, onPick }) {
  const res = await fetch(el.dataset.src);
  if (!res.ok) throw new Error(`tax map: ${res.status}`);
  const geo = await res.json();

  const byName = new Map(data.cities.map((c) => [c.city, c]));
  const breaks = rateBreaks(data.cities.map((c) => c.pct));
  const rows = geo.cities.filter((g) => byName.has(g.city)).map((g) => ({ ...g, ...byName.get(g.city) }));
  const rowOf = new Map(rows.map((r) => [r.city, r]));
  const countyStats = new Map();
  for (const c of data.cities) {
    const s = countyStats.get(c.county) || { n: 0, lo: Infinity, hi: -Infinity };
    s.n++; s.lo = Math.min(s.lo, c.pct); s.hi = Math.max(s.hi, c.pct);
    countyStats.set(c.county, s);
  }

  // ── markup ──
  const chips = h("div", "m-chips");
  const frame = h("div", "m-frame");
  const legend = h("div", "m-legend");
  const strip = h("div", "m-strip");
  el.append(chips, frame, legend, strip);
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Map of California city property tax rates. The city search above reaches the same cities by keyboard.");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    `<g class="m-land">${geo.counties.map((c, i) => `<path data-c="${i}" d="${c.d}"/>`).join("")}</g>` +
    `<g class="m-cities">${rows.map((r, i) => (r.d ? `<path data-i="${i}" class="q${bucketOf(r.pct, breaks)}" d="${r.d}"/>` : "")).join("")}</g>` +
    `<path class="m-lines" d="${geo.counties.map((c) => c.d).join("")}"/>` +
    `<g class="m-dots">${rows.map((r, i) => `<circle data-i="${i}" class="q${bucketOf(r.pct, breaks)}" cx="${r.x}" cy="${r.y}"/>`).join("")}</g>` +
    `<path class="m-county-hover"/><path class="m-hover"/><path class="m-sel"/><circle class="m-sel-dot" hidden/><g class="m-labels"></g>`;
  const [countyHover, hover, sel, selDot, labels] = [".m-county-hover", ".m-hover", ".m-sel", ".m-sel-dot", ".m-labels"].map((s) => svg.querySelector(s));
  const tip = h("div", "m-tip");
  tip.hidden = true;
  const zoomBar = h("div", "m-zoom");
  const zoomBtn = (text, label, f) => {
    const b = h("button", null, text);
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.addEventListener("click", () => { markChip(null); animateTo(view.x, view.y, view.k * f); });
    return b;
  };
  zoomBar.append(zoomBtn("+", "Zoom in", 2), zoomBtn("−", "Zoom out", 0.5));
  frame.append(svg, tip, zoomBar);

  // Legend: a swatch per step, always labeled, so color is never the only cue.
  legend.append(h("span", "m-legend-title", "Tax rate"));
  const steps = [...breaks, null];
  steps.forEach((b, i) => {
    const text = i === 0 ? `under ${b.toFixed(2)}%` : b == null ? `${breaks[i - 1].toFixed(2)}%+` : `${breaks[i - 1].toFixed(2)} to ${b.toFixed(2)}%`;
    const item = h("span", "m-key");
    item.append(h("i", `q${i}`), document.createTextNode(text));
    legend.append(item);
  });

  // ── view ──
  let vpW = 0, vpH = 0, base = 1;
  const view = { x: geo.width / 2, y: geo.height / 2, k: 1 };
  let selected = null;
  let anim = 0;
  const scale = () => base * view.k;
  const dotPx = () => (vpW < 500 ? DOT_PX_SMALL : DOT_PX);

  rows.forEach((r, i) => {
    r.dot = svg.querySelector(`.m-dots [data-i="${i}"]`);
    r.shape = r.d ? svg.querySelector(`.m-cities [data-i="${i}"]`) : null;
    r.dotOn = true;
  });
  // Only readable once the svg is in the document, hence after append.
  const measure = () => {
    for (const r of rows) {
      if (r.side != null || !r.shape) continue;
      const b = r.shape.getBBox();
      r.box = b;
      r.side = Math.max(b.width, b.height);
    }
    for (const r of rows) if (!r.shape) r.side = 0;
  };

  const applyView = () => {
    const s = scale();
    const w = vpW / s, ht = vpH / s;
    view.x = w >= geo.width ? geo.width / 2 : Math.min(geo.width - w / 2, Math.max(w / 2, view.x));
    view.y = ht >= geo.height ? geo.height / 2 : Math.min(geo.height - ht / 2, Math.max(ht / 2, view.y));
    svg.setAttribute("viewBox", `${view.x - w / 2} ${view.y - ht / 2} ${w} ${ht}`);
    const rad = dotPx() / s;
    for (const r of rows) {
      r.dot.setAttribute("r", rad);
      const on = !r.shape || r.side * s < 16;
      if (on !== r.dotOn) {
        r.dotOn = on;
        r.dot.style.display = on ? "" : "none";
      }
    }
    if (selected) {
      selDot.setAttribute("r", (dotPx() + 2) / s);
      selDot.toggleAttribute("hidden", !selected.dotOn);
    }
    // Zoomed out, one finger scrolls the page; zoomed in, it pans the map.
    svg.style.touchAction = view.k > 1.02 ? "none" : "pan-y";
    svg.classList.toggle("can-pan", view.k > 1.02);
  };

  const drawLabels = () => {
    const s = scale();
    const x0 = view.x - vpW / s / 2, y0 = view.y - vpH / s / 2;
    const toPx = (x, y) => [(x - x0) * s, (y - y0) * s];
    const taken = [];
    const fits = (r) => !taken.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]);
    const out = [];
    const wanted = rows
      .filter((r) => r === selected || r.side * s >= LABEL_MIN_PX || s >= 0.6)
      .sort((a, b) => (b === selected) - (a === selected) || b.side - a.side);
    for (const r of wanted) {
      if (out.length >= MAX_LABELS) break;
      const [px, py0] = toPx(r.x, r.y);
      const py = r.dotOn ? py0 + 15 : py0 + 4;
      if (px < 0 || px > vpW || py < 0 || py > vpH) continue;
      const half = r.city.length * 3.4 + 3;
      const box = [px - half, py - 12, px + half, py + 4];
      if (!fits(box)) continue;
      taken.push(box);
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", r.x);
      t.setAttribute("y", y0 + py / s);
      t.setAttribute("font-size", 12 / s);
      t.setAttribute("stroke-width", 3 / s);
      if (r === selected) t.setAttribute("class", "on");
      t.textContent = r.city;
      out.push(t);
    }
    labels.replaceChildren(...out);
  };

  const animateTo = (x, y, k) => {
    cancelAnimationFrame(anim);
    const to = { x, y, k: Math.min(MAX_K, Math.max(1, k)) };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    hideTip();
    if (reduce || document.hidden) {
      Object.assign(view, to);
      applyView();
      drawLabels();
      return;
    }
    labels.replaceChildren();
    const from = { ...view };
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 380);
      const e = 1 - (1 - t) ** 3;
      view.k = from.k * (to.k / from.k) ** e;
      view.x = from.x + (to.x - from.x) * e;
      view.y = from.y + (to.y - from.y) * e;
      applyView();
      if (t < 1) anim = requestAnimationFrame(step);
      else drawLabels();
    };
    anim = requestAnimationFrame(step);
  };

  const fitBox = (x, y, w, ht) => {
    const k = Math.min(vpW / (w * 1.15), vpH / (ht * 1.15)) / base;
    animateTo(x + w / 2, y + ht / 2, k);
  };

  // ── readouts ──
  const hideTip = () => { tip.hidden = true; hover.removeAttribute("d"); countyHover.removeAttribute("d"); };
  const showTip = (e, lines) => {
    tip.replaceChildren(...lines);
    tip.hidden = false;
    const f = frame.getBoundingClientRect();
    const px = e.clientX - f.left, py = e.clientY - f.top;
    const w = tip.offsetWidth, ht = tip.offsetHeight;
    tip.style.left = `${px + 14 + w > f.width ? Math.max(4, px - w - 14) : px + 14}px`;
    tip.style.top = `${py + 14 + ht > f.height ? Math.max(4, py - ht - 14) : py + 14}px`;
  };

  const showPrompt = () => {
    strip.replaceChildren(h("span", "m-hint", "Hover or tap a city for its rate. Click a county to zoom in."));
  };
  const showCityStrip = (c) => {
    const who = h("span", "m-who");
    who.append(h("strong", null, c.city), h("span", null, countyLabel(c.county)));
    const rate = h("span", "m-rate");
    rate.append(h("strong", null, pct4(c.pct)), h("span", null, `FY ${c.fy}`));
    const est = h("span", "m-rate");
    // The calculator keeps every data-out="annual" current; start from its figure.
    const annual = h("strong", null, el.closest("form")?.querySelector('.calc-out [data-out="annual"]')?.textContent || "");
    annual.dataset.out = "annual";
    est.append(annual, h("span", null, "a year at this price"));
    strip.replaceChildren(who, rate, est, link(c.path, `${c.city} rate page`));
  };
  const showCountyStrip = (county) => {
    const stats = countyStats.get(county);
    const who = h("span", "m-who");
    who.append(h("strong", null, countyLabel(county)), h("span", null, stats ? `${stats.n} ${stats.n === 1 ? "city" : "cities"} listed` : "No city rates listed"));
    const parts = [who];
    if (stats) {
      const rate = h("span", "m-rate");
      rate.append(h("strong", null, stats.n === 1 ? pct4(stats.lo) : `${pct4(stats.lo)} to ${pct4(stats.hi)}`));
      parts.push(rate);
    }
    if (data.countyPaths[county]) parts.push(link(data.countyPaths[county], "County rates"));
    if (data.bills[county]) parts.push(link(data.bills[county], "Look up a tax bill"));
    strip.replaceChildren(...parts);
  };

  // ── selection ──
  const select = (name, { frame: doFrame = false } = {}) => {
    const c = byName.get(name);
    if (!c) return;
    selected = rowOf.get(name) || null;
    showCityStrip(c);
    if (!selected) {
      sel.removeAttribute("d");
      selDot.setAttribute("hidden", "");
      drawLabels();
      return;
    }
    sel.setAttribute("d", selected.d || "");
    selDot.setAttribute("cx", selected.x);
    selDot.setAttribute("cy", selected.y);
    selDot.setAttribute("r", (dotPx() + 2) / scale());
    selDot.toggleAttribute("hidden", !selected.dotOn);
    // A click only zooms from far out, where neighbors are too dense to tell apart.
    if (doFrame === "auto" ? scale() < AUTO_FRAME_BELOW : doFrame) {
      markChip(null);
      const side = Math.max(CITY_FRAME_UNITS, (selected.side || 0) * 2.2);
      fitBox(selected.x - side / 2, selected.y - side / 2, side, side);
    } else {
      drawLabels();
    }
  };

  // ── pointer ──
  const toMap = (e) => {
    const f = svg.getBoundingClientRect();
    const s = scale();
    return { x: view.x + (e.clientX - f.left - f.width / 2) / s, y: view.y + (e.clientY - f.top - f.height / 2) / s };
  };
  const cityAt = (e, target) => {
    const i = target?.dataset?.i;
    if (i !== undefined) return rows[+i];
    const p = toMap(e);
    const lim = (NEAR_PX / scale()) ** 2;
    let best = null, bd = lim;
    for (const r of rows) {
      if (!r.dotOn) continue;
      const d = (r.x - p.x) ** 2 + (r.y - p.y) ** 2;
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  };
  const countyAt = (target) => {
    const i = target?.dataset?.c;
    return i !== undefined ? geo.counties[+i] : null;
  };

  const pointers = new Map();
  let dragged = false;
  let wheelTimer = 0;
  let active = false; // plain wheel only zooms once the map has been clicked, so it can't hijack page scroll
  let pinch = null;

  svg.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    dragged = false;
    active = true;
    cancelAnimationFrame(anim);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
    }
  });
  svg.addEventListener("pointermove", (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === "mouse") hoverAt(e);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      view.k = Math.min(MAX_K, Math.max(1, (pinch.k * d) / pinch.d));
      dragged = true;
      markChip(null);
      hideTip();
      labels.replaceChildren();
      applyView();
      return;
    }
    if (!dragged && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 5) {
      dragged = true;
      if (view.k > 1.02) svg.setPointerCapture?.(e.pointerId);
    }
    if (dragged && view.k > 1.02) {
      const s = scale();
      view.x -= dx / s;
      view.y -= dy / s;
      markChip(null);
      hideTip();
      labels.replaceChildren();
      applyView();
    }
  });
  const endPointer = (e) => {
    const had = pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!had) return;
    if (dragged) {
      if (!pointers.size) drawLabels();
      return;
    }
    if (e.type !== "pointerup") return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const row = cityAt(e, target);
    if (row) {
      onPick(row.city);
      return;
    }
    const county = countyAt(target);
    if (county) {
      markChip(null);
      showCountyStrip(county.county);
      fitBox(...county.box);
    }
  };
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);
  svg.addEventListener("pointerleave", () => { active = false; hideTip(); });
  svg.addEventListener("dblclick", (e) => e.preventDefault());

  svg.addEventListener("wheel", (e) => {
    if (!active && !e.ctrlKey) return;
    e.preventDefault();
    const p = toMap(e);
    const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002));
    const k = Math.min(MAX_K, Math.max(1, view.k * f));
    const ratio = view.k / k;
    view.x = p.x - (p.x - view.x) * ratio;
    view.y = p.y - (p.y - view.y) * ratio;
    view.k = k;
    markChip(null);
    applyView();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(drawLabels, 120);
  }, { passive: false });

  function hoverAt(e) {
    const row = cityAt(e, e.target);
    if (row) {
      countyHover.removeAttribute("d");
      if (row.d) hover.setAttribute("d", row.d);
      else hover.removeAttribute("d");
      const a = h("strong", null, row.city);
      const b = h("span", "m-tip-rate", pct4(row.pct));
      const c2 = h("span", null, `${countyLabel(row.county)} · FY ${row.fy}`);
      showTip(e, [a, b, c2]);
      svg.style.cursor = "pointer";
      return;
    }
    hover.removeAttribute("d");
    const county = countyAt(e.target);
    if (!county) {
      hideTip();
      svg.style.cursor = "";
      return;
    }
    countyHover.setAttribute("d", county.d);
    const stats = countyStats.get(county.county);
    showTip(e, [
      h("strong", null, countyLabel(county.county)),
      h("span", null, stats ? (stats.n === 1 ? pct4(stats.lo) : `${pct4(stats.lo)} to ${pct4(stats.hi)}`) : "No city rates listed"),
      h("span", null, "Click to zoom in"),
    ]);
    svg.style.cursor = "pointer";
  }

  // ── region chips ──
  const chipEls = REGIONS.map(([label, list]) => {
    const b = h("button", "m-chip", label);
    b.type = "button";
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      markChip(b);
      if (!list) {
        animateTo(geo.width / 2, geo.height / 2, 1);
        if (selected) select(selected.city);
        else showPrompt();
        return;
      }
      // Frame the cities, not the county lines: LA County's offshore islands would double the view.
      const inRegion = rows.filter((r) => list.includes(r.county));
      const trim = Math.floor(inRegion.length * 0.02);
      const xs = inRegion.map((r) => r.x).sort((a, b) => a - b).slice(trim, inRegion.length - trim);
      const ys = inRegion.map((r) => r.y).sort((a, b) => a - b).slice(trim, inRegion.length - trim);
      const pad = 150;
      fitBox(xs[0] - pad, ys[0] - pad, xs[xs.length - 1] - xs[0] + pad * 2, ys[ys.length - 1] - ys[0] + pad * 2);
    });
    chips.append(b);
    return b;
  });
  function markChip(on) {
    for (const b of chipEls) b.setAttribute("aria-pressed", b === on ? "true" : "false");
  }
  markChip(chipEls[0]);

  // ── size ──
  const resize = () => {
    const f = frame.getBoundingClientRect();
    if (!f.width || !f.height) return;
    const first = !vpW;
    vpW = f.width; vpH = f.height;
    base = Math.min(vpW / geo.width, vpH / geo.height) * 0.97;
    measure();
    applyView();
    drawLabels();
    if (first && selected) select(selected.city);
  };
  new ResizeObserver(resize).observe(frame);
  resize();
  showPrompt();

  return { select };
}
