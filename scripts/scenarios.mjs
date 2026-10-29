// Example homes the guides quote: drawn in code, covered with the planner's own engine.
//
// Each home is a rectangle of rooms about ROOM meters wide, with brick outer walls, inner walls of the
// given material and a wooden door in the middle of every inner wall. Nodes are placed one at a
// time with suggest(), the same search as the "Suggest a spot" button, on the 5 GHz band, until
// every floor has good signal (GOOD or better) on at least TARGET of its area. The guides print
// the results through {cover.*}, {need.*} and {table.nodes} tokens, so the numbers always match
// the model.

import { BUILTIN_MODELS, nodesAll, stats, suggest } from '../assets/js/engine.js';

export const TARGET = 0.9;
export const ROOM = 4, DOOR = 0.9;
const BAND = '5', MODEL = 'be25', MAX_NODES = 4, MARGIN = 1;
const MODELS = Object.fromEntries(BUILTIN_MODELS.map(m => [m.id, m]));

// id → width × depth in meters, floors, inner wall material. `table` homes form the nodes table.
export const HOMES = {
  h60: { w: 10, h: 6, table: true },
  h90: { w: 10, h: 9, table: true },
  h120: { w: 12, h: 10, table: true },
  h150: { w: 15, h: 10, table: true },
  h200: { w: 20, h: 10, table: true },
  h250: { w: 20, h: 12.5, table: true },
  long: { w: 24, h: 6 },
  twoStory: { w: 10, h: 8, floors: 2 },
  apartment: { w: 10, h: 7, inner: 'concreto' },
};

function walls({ w: W, h: H, inner = 'tijolo' }) {
  const out = [], x0 = MARGIN, y0 = MARGIN;
  const seg = (x1, y1, x2, y2, m) => out.push({ x1, y1, x2, y2, m });
  seg(x0, y0, x0 + W, y0, 'tijolo'); seg(x0 + W, y0, x0 + W, y0 + H, 'tijolo');
  seg(x0 + W, y0 + H, x0, y0 + H, 'tijolo'); seg(x0, y0 + H, x0, y0, 'tijolo');
  const nx = Math.max(1, Math.round(W / ROOM)), ny = Math.max(1, Math.round(H / ROOM));
  const xs = Array.from({ length: nx + 1 }, (_, i) => x0 + i * W / nx);
  const ys = Array.from({ length: ny + 1 }, (_, i) => y0 + i * H / ny);
  const withDoor = (a, b, at, vertical) => {
    const mid = (a + b) / 2, P = (u, v) => (vertical ? [at, u, at, v] : [u, at, v, at]);
    seg(...P(a, mid - DOOR / 2), inner); seg(...P(mid - DOOR / 2, mid + DOOR / 2), 'madeira'); seg(...P(mid + DOOR / 2, b), inner);
  };
  for (const x of xs.slice(1, -1)) for (let j = 0; j < ny; j++) withDoor(ys[j], ys[j + 1], x, true);
  for (const y of ys.slice(1, -1)) for (let i = 0; i < nx; i++) withDoor(xs[i], xs[i + 1], y, false);
  return out;
}

export function homeProject(id) {
  const home = HOMES[id];
  if (!home) throw new Error(`Unknown example home "${id}".`);
  return {
    w: home.w + 2 * MARGIN, h: home.h + 2 * MARGIN, band: BAND,
    floors: Array.from({ length: home.floors || 1 }, () => ({ walls: walls(home), nodes: [], labels: [] })),
  };
}

// steps[n] = share of good signal per floor with n nodes (n = 0..MAX_NODES); need = nodes for TARGET.
// The search stops once the home is fully covered, or has its nodes and the 3 the table shows.
const cache = new Map();
export function coverage(id) {
  if (cache.has(id)) return cache.get(id);
  const p = homeProject(id), home = HOMES[id];
  const cover = () => p.floors.map((_, fi) => stats(p, MODELS, fi, BAND).good);
  const steps = [cover()], placed = [];
  let need = null;
  while (nodesAll(p).length < MAX_NODES) {
    const c = steps.at(-1);
    if (need === null && Math.min(...c) >= TARGET) need = nodesAll(p).length;
    if (Math.min(...c) > 0.995 || (need !== null && nodesAll(p).length >= 3)) break; // nothing left to show
    const fi = c.indexOf(Math.min(...c));
    const s = suggest(p, MODELS, fi, BAND, MODEL);
    if (s.none) break;
    const node = { x: s.x, y: s.y, model: MODEL, main: !nodesAll(p).length, wired: false };
    p.floors[fi].nodes.push(node); placed.push(node);
    steps.push(cover());
  }
  while (steps.length <= MAX_NODES) steps.push(steps.at(-1));
  if (need === null) need = steps.findIndex(c => Math.min(...c) >= TARGET);
  const r = { steps, need: need < 0 ? null : need, area: home.w * home.h * (home.floors || 1), project: p, placed };
  cache.set(id, r);
  return r;
}

// The home with the nodes it needs, in the order they were placed: the project a guide's
// "Open this example in the planner" link opens.
export function exampleHome(id) {
  const c = coverage(id), keep = new Set(c.placed.slice(0, c.need ?? c.placed.length));
  return { ...c.project, floors: c.project.floors.map(f => ({ ...f, nodes: f.nodes.filter(n => keep.has(n)) })) };
}
