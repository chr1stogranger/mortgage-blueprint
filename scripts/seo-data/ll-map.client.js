// County map for the loan-limit pages, served as /seo/ll-map.js (an ES module,
// copied as-is by scripts/seo-data-pages.mjs). ll-calc.client.js loads it when
// the page has a [data-llmap] element; data-state opens it framed on one state.
//
// Geometry comes from /seo/ll-map-geo.json (see build-ll-map.mjs), already
// projected, with Hawaii in an inset. Limits come from the calculator's data
// (by FIPS code), so the map can't disagree with the numbers beside it. The
// county search is the keyboard route to the same selection. Pan and zoom work
// like the CA tax map (tax-map.client.js), plus double-click / double-tap zooms
// in 2x on the spot (Shift+double-click zooms out).

const MAX_K = 120; // deep enough for Virginia's small independent cities
const LABEL_MIN_PX = 64; // a county this wide on screen earns its name
const MAX_LABELS = 60;
const OVERLAY_PX = 230;
const MIN_FRAME = 260; // map units (130 km) // width of the floating readout and legend, plus their margin
// Shade by the limit as a multiple of the national baseline, the same steps at
// every unit count: baseline, then up to 1.2x, 1.35x, under the 1.5x ceiling,
// and the ceiling or above (Hawaii's statutory floor is the ceiling).
const STEPS = [1.0001, 1.2, 1.35, 1.4999];

export const bucketOf = (limit, baseline) => {
  const r = limit / baseline;
  let i = 0;
  while (i < STEPS.length && r >= STEPS[i]) i++;
  return i;
};

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const money = (n) => usd0.format(n);
const unitLabel = (u) => (u === 1 ? "1 unit" : `${u} units`);

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
 * @param {HTMLElement} el  the [data-llmap] element
 * @param {{ data: { counties: object[], baseline: number[] }, units: number, onPick: (fips: string) => void }} opts
 * @returns {Promise<{ select: (fips: string, opts?: { frame?: boolean | "auto" }) => void, setUnits: (u: number) => void }>}
 */
export async function initLimitMap(el, { data, units: startUnits, onPick }) {
  const res = await fetch(el.dataset.src);
  if (!res.ok) throw new Error(`loan-limit map: ${res.status}`);
  const geo = await res.json();

  const byFips = new Map(data.counties.map((c) => [c.fips, c]));
  const rows = geo.counties.filter((g) => byFips.has(g.fips)).map((g) => ({ ...g, ...byFips.get(g.fips) }));
  const rowOf = new Map(rows.map((r) => [r.fips, r]));
  const stateName = new Map(data.counties.map((c) => [c.st, c.state]));
  const stateBox = new Map(geo.states.map((s) => [s.st, s.box]));
  const startState = stateBox.has(el.dataset.state) ? el.dataset.state : null;
  let units = startUnits || 1;

  // ── markup ──
  const chips = h("div", "m-chips");
  const frame = h("div", "m-frame");
  const legend = h("div", "m-legend");
  const strip = h("div", "m-strip");
  el.append(chips, frame, legend, strip);
  el.setAttribute("role", "group");
  el.setAttribute("aria-label", "Map of conforming loan limits by county. The county search reaches the same counties by keyboard.");

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    geo.insets.map(({ box: [x, y, w, ht] }) => `<rect class="m-inset" x="${x}" y="${y}" width="${w}" height="${ht}" rx="12"/>`).join("") +
    `<g class="m-counties">${rows.map((r, i) => `<path data-i="${i}" d="${r.d}"/>`).join("")}</g>` +
    `<path class="m-states" d="${geo.states.map((s) => s.d).join("")}"/>` +
    `<path class="m-hover"/><path class="m-sel"/><g class="m-labels"></g>`;
  const [hover, sel, labels] = [".m-hover", ".m-sel", ".m-labels"].map((s) => svg.querySelector(s));
  rows.forEach((r, i) => {
    r.el = svg.querySelector(`.m-counties [data-i="${i}"]`);
    r.side = Math.max(r.box[2], r.box[3]);
  });
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

  // Fill and legend follow the unit count; the legend names each step's real range, so color is never the only cue.
  const paint = () => {
    const base = data.baseline[units - 1];
    const seen = new Map();
    for (const r of rows) {
      const lim = r.limits[units - 1];
      const b = bucketOf(lim, base);
      r.el.setAttribute("class", `q${b}`);
      const s = seen.get(b) || { lo: Infinity, hi: -Infinity };
      s.lo = Math.min(s.lo, lim); s.hi = Math.max(s.hi, lim);
      seen.set(b, s);
    }
    legend.replaceChildren(h("span", "m-legend-title", `Loan limit, ${unitLabel(units)}`));
    for (const [b, s] of [...seen].sort((a, z) => a[0] - z[0])) {
      const text = b === 0 ? `${money(s.lo)} baseline` : b === 4 ? `${money(s.lo)} and up` : s.lo === s.hi ? money(s.lo) : `${money(s.lo)} to ${money(s.hi)}`;
      const item = h("span", "m-key");
      item.append(h("i", `q${b}`), document.createTextNode(text));
      legend.append(item);
    }
  };

  // ── view ──
  let vpW = 0, vpH = 0, base = 1;
  const view = { x: geo.width / 2, y: geo.height / 2, k: 1 };
  let selected = null;
  let anim = 0;
  const scale = () => base * view.k;
  // The readout and legend float over the map's left edge (on a phone they sit below it).
  const overlayPx = () => (vpW > 540 ? OVERLAY_PX : 0);

  // The overlay's strip counts as extra world on the left, so the whole map (and the Hawaii inset) clears it.
  const applyView = () => {
    const s = scale();
    const w = vpW / s, ht = vpH / s;
    const padL = overlayPx() / s;
    view.x = w >= geo.width + padL ? (geo.width - padL) / 2 : Math.min(geo.width - w / 2, Math.max(w / 2 - padL, view.x));
    view.y = ht >= geo.height ? geo.height / 2 : Math.min(geo.height - ht / 2, Math.max(ht / 2, view.y));
    svg.setAttribute("viewBox", `${view.x - w / 2} ${view.y - ht / 2} ${w} ${ht}`);
    // Zoomed out, one finger scrolls the page; zoomed in, it pans the map.
    svg.style.touchAction = view.k > 1.02 ? "none" : "pan-y";
    svg.classList.toggle("can-pan", view.k > 1.02);
  };

  const drawLabels = () => {
    const s = scale();
    const x0 = view.x - vpW / s / 2, y0 = view.y - vpH / s / 2;
    const taken = [];
    const fits = (r) => !taken.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]);
    const out = [];
    const wanted = rows
      .filter((r) => r === selected || r.side * s >= LABEL_MIN_PX)
      .sort((a, b) => (b === selected) - (a === selected) || b.side - a.side);
    for (const r of wanted) {
      if (out.length >= MAX_LABELS) break;
      const cx = r.box[0] + r.box[2] / 2, cy = r.box[1] + r.box[3] / 2;
      const px = (cx - x0) * s, py = (cy - y0) * s + 4;
      if (px < 0 || px > vpW || py < 0 || py > vpH) continue;
      const name = r.name.replace(/ (County|Parish)$/, "");
      const half = name.length * 3.4 + 3;
      const box = [px - half, py - 12, px + half, py + 4];
      if (!fits(box)) continue;
      taken.push(box);
      const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t.setAttribute("x", cx);
      t.setAttribute("y", y0 + py / s);
      t.setAttribute("font-size", 12 / s);
      t.setAttribute("stroke-width", 3 / s);
      if (r === selected) t.setAttribute("class", "on");
      t.textContent = name;
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

  // Frame what's asked for in the space the overlay leaves.
  const boxView = ([x0, y0, w0, h0]) => {
    // Never frame tighter than MIN_FRAME units, so DC opens with its neighbors around it.
    const w = Math.max(w0, MIN_FRAME), ht = Math.max(h0, MIN_FRAME);
    const x = x0 + w0 / 2 - w / 2, y = y0 + h0 / 2 - ht / 2;
    const inset = overlayPx();
    const k = Math.max(1, Math.min((vpW - inset) / (w * 1.12), vpH / (ht * 1.12)) / base);
    return { x: x + w / 2 - inset / 2 / (base * k), y: y + ht / 2, k };
  };
  const fitBox = (box) => {
    const v = boxView(box);
    animateTo(v.x, v.y, v.k);
  };

  // ── readouts ──
  const hideTip = () => { tip.hidden = true; hover.removeAttribute("d"); };
  const showTip = (e, lines) => {
    tip.replaceChildren(...lines);
    tip.hidden = false;
    const f = frame.getBoundingClientRect();
    const px = e.clientX - f.left, py = e.clientY - f.top;
    const w = tip.offsetWidth, ht = tip.offsetHeight;
    tip.style.left = `${px + 14 + w > f.width ? Math.max(4, px - w - 14) : px + 14}px`;
    tip.style.top = `${py + 14 + ht > f.height ? Math.max(4, py - ht - 14) : py + 14}px`;
  };
  const bandOf = (r) => {
    const lim = r.limits[units - 1], std = r.std[units - 1];
    if (lim > std) return "High-cost area";
    return std > data.baseline[units - 1] ? "Statutory baseline (HERA)" : "National baseline";
  };
  const showStrip = () => {
    if (!selected) {
      strip.replaceChildren(h("span", "m-hint", "Hover or tap a county for its limit."));
      return;
    }
    const r = selected;
    const who = h("span", "m-who");
    who.append(h("strong", null, r.name), h("span", null, r.state));
    const lim = h("span", "m-rate");
    lim.append(h("strong", null, money(r.limits[units - 1])), h("span", null, `${unitLabel(units)} · ${bandOf(r)}`));
    const here = r.path.split("#")[0] === location.pathname && !r.path.includes("#");
    strip.replaceChildren(who, lim, ...(here ? [] : [link(r.path, r.path.includes("#") ? `${r.state} table` : "County page")]));
  };

  // ── selection ──
  const select = (fips, { frame: doFrame = false } = {}) => {
    selected = rowOf.get(fips) || null;
    showStrip();
    if (!selected) {
      sel.removeAttribute("d");
      drawLabels();
      return;
    }
    sel.setAttribute("d", selected.d);
    const s = scale();
    const onScreen = selected.side * s;
    const [bx, by, bw, bh] = selected.box;
    const w = vpW / s, ht = vpH / s, padL = overlayPx() / s;
    const inView = bx >= view.x - w / 2 + padL && bx + bw <= view.x + w / 2 && by >= view.y - ht / 2 && by + bh <= view.y + ht / 2;
    if (doFrame === "auto" ? onScreen < 12 : doFrame && (onScreen < 40 || !inView)) {
      markChip(null);
      const side = Math.max(400, selected.side * 4);
      const [x, y, w, ht] = selected.box;
      fitBox([x + w / 2 - side / 2, y + ht / 2 - side / 2, side, side]);
    } else {
      drawLabels();
    }
  };
  const setUnits = (u) => {
    if (u === units) return;
    units = u;
    paint();
    showStrip();
  };

  // ── pointer ──
  const toMap = (e) => {
    const f = svg.getBoundingClientRect();
    const s = scale();
    return { x: view.x + (e.clientX - f.left - f.width / 2) / s, y: view.y + (e.clientY - f.top - f.height / 2) / s };
  };
  const rowAt = (target) => {
    const i = target?.dataset?.i;
    return i !== undefined ? rows[+i] : null;
  };

  const pointers = new Map();
  let lastTap = null; // { t, x, y } of the previous tap, to spot a double tap
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
      view.k = Math.min(MAX_K, Math.max(1, (pinch.k * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.d));
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
    // Our own double-tap check rather than dblclick, so a finger zooms the same way a mouse does.
    if (lastTap && e.timeStamp - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap = null;
      zoomAt(e, e.shiftKey ? 0.5 : 2);
      return;
    }
    lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    const row = rowAt(document.elementFromPoint(e.clientX, e.clientY));
    if (row) onPick(row.fips);
  };
  // Zoom by f, keeping the map point under the pointer where it is.
  const zoomAt = (e, f) => {
    const p = toMap(e);
    const k = Math.min(MAX_K, Math.max(1, view.k * f));
    const ratio = view.k / k;
    markChip(null);
    animateTo(p.x - (p.x - view.x) * ratio, p.y - (p.y - view.y) * ratio, k);
  };
  svg.addEventListener("pointerup", endPointer);
  svg.addEventListener("pointercancel", endPointer);
  svg.addEventListener("pointerleave", () => { active = false; hideTip(); });
  svg.addEventListener("dblclick", (e) => e.preventDefault());

  svg.addEventListener("wheel", (e) => {
    if (!active && !e.ctrlKey) return;
    e.preventDefault();
    const p = toMap(e);
    const k = Math.min(MAX_K, Math.max(1, view.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002))));
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
    const row = rowAt(e.target);
    if (!row) {
      hideTip();
      svg.style.cursor = "";
      return;
    }
    hover.setAttribute("d", row.d);
    showTip(e, [
      h("strong", null, `${row.name}, ${row.st}`),
      h("span", "m-tip-rate", money(row.limits[units - 1])),
      h("span", null, `${unitLabel(units)} · ${bandOf(row)}`),
    ]);
    svg.style.cursor = "pointer";
  }

  // ── state controls: the whole country, or zoom to one state ──
  const all = h("button", "m-chip", "All states");
  all.type = "button";
  all.addEventListener("click", () => { markChip("all"); animateTo(geo.width / 2, geo.height / 2, 1); });
  const pickState = h("select", "m-chip m-state");
  pickState.setAttribute("aria-label", "Zoom the map to a state");
  pickState.append(new Option("Zoom to a state", ""));
  for (const st of [...stateBox.keys()].sort((a, b) => stateName.get(a).localeCompare(stateName.get(b)))) pickState.append(new Option(stateName.get(st), st));
  pickState.addEventListener("change", () => {
    const st = pickState.value;
    if (!st) return;
    markChip(st);
    fitBox(stateBox.get(st));
  });
  chips.append(all, pickState);
  // "all", a state code, or null once the view is panned or zoomed by hand.
  function markChip(on) {
    all.setAttribute("aria-pressed", on === "all" ? "true" : "false");
    pickState.value = on && on !== "all" ? on : "";
    pickState.classList.toggle("on", !!on && on !== "all");
  }
  markChip(startState || "all");

  // ── size ──
  const resize = () => {
    const f = frame.getBoundingClientRect();
    if (!f.width || !f.height) return;
    const first = !vpW;
    vpW = f.width; vpH = f.height;
    base = Math.min((vpW - overlayPx()) / geo.width, vpH / geo.height) * 0.97;
    if (first && startState) Object.assign(view, boxView(stateBox.get(startState)));
    applyView();
    drawLabels();
  };
  paint();
  new ResizeObserver(resize).observe(frame);
  resize();
  showStrip();

  return { select, setUnits };
}
