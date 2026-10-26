// Propagation model shared by the app and the tests. Pure functions only:
// no DOM, no storage. Coordinates are meters, x to the right, y down.

export const GRID = 0.25;      // drawing snap, meters
export const FLOOR_H = 3;      // floor-to-floor height, meters
export const N_EXP = 2.5;      // log-distance path loss exponent (residential, walls counted separately)
export const GOOD = -67;       // dBm threshold counted as "good coverage"

export const BANDS = {
  '2.4': { i: 0, pl0: 40.2, tx: 20 },
  '5':   { i: 1, pl0: 47.3, tx: 23 },
  '6':   { i: 2, pl0: 48.7, tx: 21 },
};
// '5' and '6' are integer-like keys, so Object.keys(BANDS) would list them before '2.4'.
export const BAND_KEYS = ['2.4', '5', '6'];

// Attenuation in dB per band [2.4, 5, 6]; w is the drawn thickness in meters.
// The build renders the guide table from these values; labels live in i18n/*.json.
export const MATERIALS = {
  tijolo:   { db: [6, 10, 12],  w: 0.16 },
  concreto: { db: [10, 15, 18], w: 0.2 },
  gesso:    { db: [3, 4, 5],    w: 0.08 },
  madeira:  { db: [3, 5, 6],    w: 0.07 },
  vidro:    { db: [2, 4, 5],    w: 0.06 },
  metal:    { db: [15, 20, 22], w: 0.1 },
};
export const SLAB = [13, 18, 21];

// adj = transmit power relative to a typical mesh node, in dB. The ISP router's name is translated by the UI.
export const BUILTIN_MODELS = [
  { id: 'be25',     name: 'TP-Link Deco BE25',     short: 'BE25',      bands: ['2.4', '5'],      adj: 0 },
  { id: 'be65',     name: 'TP-Link Deco BE65',     short: 'BE65',      bands: ['2.4', '5', '6'], adj: 0 },
  { id: 'be85',     name: 'TP-Link Deco BE85',     short: 'BE85',      bands: ['2.4', '5', '6'], adj: 1 },
  { id: 'eero7',    name: 'Amazon eero 7',         short: 'eero 7',    bands: ['2.4', '5'],      adj: 0 },
  { id: 'eeropro7', name: 'Amazon eero Pro 7',     short: 'eero Pro7', bands: ['2.4', '5', '6'], adj: 0 },
  { id: 'orbi370',  name: 'Netgear Orbi 370',      short: 'Orbi 370',  bands: ['2.4', '5'],      adj: 0 },
  { id: 'h47be',    name: 'Mercusys Halo H47BE',   short: 'H47BE',     bands: ['2.4', '5', '6'], adj: 0 },
  { id: 'isp',      name: 'Roteador da operadora', short: 'Operadora', bands: ['2.4', '5'],      adj: -2 },
];

// Signal categories 0..4: excellent, good, fair, weak, unusable (names in i18n ui.cats).
export const catOf = v => (v >= -60 ? 0 : v >= -67 ? 1 : v >= -72 ? 2 : v >= -80 ? 3 : 4);
// Backhaul link quality: 0 great, 2 ok, 4 weak (color index and i18n key). Rounded like the
// label, so a link shown as -70 dBm is never called weak.
export const linkCat = v => { const r = Math.round(v); return r >= -60 ? 0 : r >= -70 ? 2 : 4; };

// Segment AB crosses segment CD. u < 1 avoids counting a shared corner twice.
export function hit(ax, ay, bx, by, cx, cy, dx, dy) {
  const rX = bx - ax, rY = by - ay, sX = dx - cx, sY = dy - cy, den = rX * sY - rY * sX;
  if (den === 0) return false;
  const qx = cx - ax, qy = cy - ay;
  const t = (qx * sY - qy * sX) / den, u = (qx * rY - qy * rX) / den;
  return t > 0 && t < 1 && u >= 0 && u < 1;
}

export function wallLoss(ax, ay, bx, by, walls, bi) {
  let L = 0;
  for (const w of walls) if (hit(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2)) L += MATERIALS[w.m].db[bi];
  return L;
}

export function distSeg(px, py, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1, L = dx * dx + dy * dy;
  let t = L ? ((px - w.x1) * dx + (py - w.y1) * dy) / L : 0;
  t = Math.min(1, Math.max(0, t));
  return Math.hypot(px - (w.x1 + t * dx), py - (w.y1 + t * dy));
}

export function nodesAll(p) {
  const a = [];
  p.floors.forEach((f, fi) => f.nodes.forEach((n, ni) => a.push({ n, fi, ni })));
  return a;
}

const modelOf = (models, id) => models[id] || models.be25;

export function sig(p, models, an, x, y, fi, bk) {
  const m = modelOf(models, an.n.model);
  if (!m.bands.includes(bk)) return -Infinity;
  const b = BANDS[bk], df = Math.abs(an.fi - fi);
  const d = Math.max(0.5, Math.hypot(x - an.n.x, y - an.n.y, df * FLOOR_H));
  const L = b.pl0 + 10 * N_EXP * Math.log10(d) + df * SLAB[b.i]
    + wallLoss(an.n.x, an.n.y, x, y, p.floors[fi].walls, b.i);
  return b.tx + m.adj - L;
}

export function bestAt(p, models, x, y, fi, bk, nodes = nodesAll(p)) {
  let v = -Infinity, who = -1;
  for (let i = 0; i < nodes.length; i++) {
    const s = sig(p, models, nodes[i], x, y, fi, bk);
    if (s > v) { v = s; who = i; }
  }
  return { v, who };
}

export function linkSig(p, models, a, b, bk) {
  const B = BANDS[bk], df = Math.abs(a.fi - b.fi);
  const d = Math.max(0.5, Math.hypot(a.n.x - b.n.x, a.n.y - b.n.y, df * FLOOR_H));
  let L = B.pl0 + 10 * N_EXP * Math.log10(d) + df * SLAB[B.i]
    + wallLoss(a.n.x, a.n.y, b.n.x, b.n.y, p.floors[a.fi].walls, B.i);
  if (df) L += wallLoss(a.n.x, a.n.y, b.n.x, b.n.y, p.floors[b.fi].walls, B.i);
  return B.tx + Math.min(modelOf(models, a.n.model).adj, modelOf(models, b.n.model).adj) - L;
}

// Backhaul uses 6 GHz when both ends have it, otherwise 5 GHz.
export function link(p, models, a, b) {
  const six = modelOf(models, a.n.model).bands.includes('6') && modelOf(models, b.n.model).bands.includes('6');
  const v5 = linkSig(p, models, a, b, '5');
  const v6 = six ? linkSig(p, models, a, b, '6') : -Infinity;
  return v6 > v5 ? { v: v6, band: '6' } : { v: v5, band: '5' };
}

// Builds a tree rooted at the main node, so every satellite reaches it. Wired nodes hang
// from the main node; the others join one at a time through the strongest link to a node
// already in the tree (widest path), which never forms a cycle. Sorted by child index.
export function topology(p, models) {
  const all = nodesAll(p);
  if (all.length < 2) return [];
  const mainI = Math.max(0, all.findIndex(a => a.n.main));
  const out = [], inTree = new Set([mainI]);
  all.forEach((a, i) => {
    if (i !== mainI && a.n.wired) { out.push({ child: i, parent: mainI, wired: true }); inTree.add(i); }
  });
  while (inTree.size < all.length) {
    let best = null;
    all.forEach((a, i) => {
      if (inTree.has(i)) return;
      inTree.forEach(j => {
        const l = link(p, models, a, all[j]);
        if (!best || l.v > best.v) best = { child: i, parent: j, v: l.v, band: l.band, wired: false };
      });
    });
    out.push(best);
    inTree.add(best.child);
  }
  return out.sort((a, b) => a.child - b.child);
}

// Wireless links too weak to carry the mesh (the ones the panel says need a cable).
export const weakLinks = (p, models) => topology(p, models).filter(l => !l.wired && linkCat(l.v) === 4);

export function computeGrid(p, models, fi, bk, cs) {
  const cols = Math.ceil(p.w / cs), rows = Math.ceil(p.h / cs), v = new Float32Array(cols * rows);
  const nodes = nodesAll(p);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    v[r * cols + c] = nodes.length ? bestAt(p, models, (c + 0.5) * cs, (r + 0.5) * cs, fi, bk, nodes).v : -Infinity;
  }
  return { cols, rows, cs, v };
}

// Area counted in the statistics: rectangle around the floor's walls.
export function bbox(p, fi) {
  const ws = p.floors[fi].walls;
  const full = { x0: 0, y0: 0, x1: p.w, y1: p.h };
  if (!ws.length) return full;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const w of ws) {
    x0 = Math.min(x0, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2);
    x1 = Math.max(x1, w.x1, w.x2); y1 = Math.max(y1, w.y1, w.y2);
  }
  return x1 - x0 < 0.5 || y1 - y0 < 0.5 ? full : { x0, y0, x1, y1 };
}

// Whether the walls of a floor outline the house: the rectangle around them is at least 2 m on each
// side and walls run along at least half of its perimeter (walls whose ends both touch the
// rectangle's edges count, so cut corners and angled facades still close it).
export function outlineClosed(p, fi) {
  const ws = p.floors[fi].walls;
  if (ws.length < 3) return false;
  const b = bbox(p, fi), w = b.x1 - b.x0, h = b.y1 - b.y0;
  if (w < 2 || h < 2 || (b.x0 === 0 && b.y0 === 0 && b.x1 === p.w && b.y1 === p.h && ws.length < 4)) return false;
  const onEdge = (x, y) => Math.min(Math.abs(x - b.x0), Math.abs(x - b.x1), Math.abs(y - b.y0), Math.abs(y - b.y1)) < 0.3;
  const sameEdge = wl => (Math.abs(wl.x1 - wl.x2) < 0.01 && (Math.abs(wl.x1 - b.x0) < 0.3 || Math.abs(wl.x1 - b.x1) < 0.3))
    || (Math.abs(wl.y1 - wl.y2) < 0.01 && (Math.abs(wl.y1 - b.y0) < 0.3 || Math.abs(wl.y1 - b.y1) < 0.3));
  let along = 0;
  for (const wl of ws) {
    const len = Math.hypot(wl.x2 - wl.x1, wl.y2 - wl.y1);
    if (sameEdge(wl) || (onEdge(wl.x1, wl.y1) && onEdge(wl.x2, wl.y2) && !(Math.abs(wl.x1 - wl.x2) < 0.01 || Math.abs(wl.y1 - wl.y2) < 0.01))) along += len;
  }
  return along >= 0.5 * 2 * (w + h);
}

export function stats(p, models, fi, bk, g = computeGrid(p, models, fi, bk, 0.25)) {
  const bb = bbox(p, fi), counts = [0, 0, 0, 0, 0];
  let n = 0;
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const x = (c + 0.5) * g.cs, y = (r + 0.5) * g.cs;
    if (x < bb.x0 || x > bb.x1 || y < bb.y0 || y > bb.y1) continue;
    counts[catOf(g.v[r * g.cols + c])]++;
    n++;
  }
  const hasBand = nodesAll(p).some(a => modelOf(models, a.n.model).bands.includes(bk));
  return { counts, n, good: n ? (counts[0] + counts[1]) / n : 0, hasBand, area: (bb.x1 - bb.x0) * (bb.y1 - bb.y0) };
}

// Tries every free point of the floor (0.5 m grid) and keeps the one that adds the most
// area at or above GOOD, requiring a wireless link of at least -70 dBm when possible.
// Failures return { none: code } with code noWalls | noSpot | alreadyGood | noGain, or
// { none: 'weakLink', child, parent } when no spot helps but a backhaul link is too weak.
// Same search as suggest(), as a generator: it yields the share of work done (0 to 1) after each
// candidate spot, so a caller can run it in slices, show progress and stop early. The return value
// is the same result object suggest() returns.
export function* suggestSteps(p, models, fi, bk, modelId) {
  const nodes = nodesAll(p), bb = bbox(p, fi), cs = 0.5;
  let mk = modelId;
  if (!modelOf(models, mk).bands.includes(bk)) mk = Object.keys(models).find(id => models[id].bands.includes(bk)) || mk;
  const cells = [];
  for (let y = bb.y0 + cs / 2; y < bb.y1; y += cs) for (let x = bb.x0 + cs / 2; x < bb.x1; x += cs) {
    cells.push({ x, y, v: nodes.length ? bestAt(p, models, x, y, fi, bk, nodes).v : -Infinity });
  }
  if (!cells.length) return { none: 'noWalls' };
  const base = cells.filter(c => c.v >= GOOD).length / cells.length;
  const walls = p.floors[fi].walls;
  const search = function* (requireLink, from, span) {
    let best = null;
    for (let ci = 0; ci < cells.length; ci++) {
      const c = cells[ci];
      yield from + span * ci / cells.length;
      if (walls.some(w => distSeg(c.x, c.y, w) < 0.3)) continue;
      const cand = { n: { x: c.x, y: c.y, model: mk }, fi };
      let lv = null;
      if (nodes.length) {
        lv = Math.max(...nodes.map(o => link(p, models, cand, o).v));
        if (requireLink && lv < -70) continue;
      }
      let cov = 0, sum = 0;
      for (const q of cells) {
        const v = Math.max(q.v, sig(p, models, cand, q.x, q.y, fi, bk));
        if (v >= GOOD) cov++;
        sum += Math.max(v, -90);
      }
      const score = cov * 1000 + sum;
      if (!best || score > best.score) best = { score, x: c.x, y: c.y, cov, lv };
    }
    return best;
  };
  // The relaxed second pass (no link requirement) is rare, so the first pass takes most of the bar.
  const first = nodes.length ? 0.85 : 1;
  let best = yield* search(true, 0, first), relaxed = false;
  if (!best && nodes.length) { best = yield* search(false, first, 1 - first); relaxed = true; }
  if (!best) return { none: 'noSpot' };
  const to = best.cov / cells.length;
  if (to - base < 0.01) {
    // Good-looking coverage still fails if a node cannot reach the mesh: say that first.
    const weak = weakLinks(p, models)[0];
    if (weak) return { none: 'weakLink', child: weak.child, parent: weak.parent };
    return { none: base >= 0.98 ? 'alreadyGood' : 'noGain' };
  }
  return {
    x: Math.round(best.x / GRID) * GRID, y: Math.round(best.y / GRID) * GRID,
    model: mk, fi, from: base, to, link: best.lv, relaxed,
  };
}

export function suggest(p, models, fi, bk, modelId) {
  const it = suggestSteps(p, models, fi, bk, modelId);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
