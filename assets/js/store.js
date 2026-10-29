// Projects and custom router models, persisted in localStorage.
// Every read and write is guarded: private windows and full storage must not break the app.

import { BANDS, BAND_KEYS, MATERIALS, BUILTIN_MODELS } from './engine.js';

// Keys keep the original 'planta-wifi' prefix so visitors' saved projects survive the rename.
const KEYS = {
  index: 'planta-wifi:projects',
  project: id => 'planta-wifi:project:' + id,
  models: 'planta-wifi:models',
  current: 'planta-wifi:current',
  legacy: 'planta-wifi-v1',
};
export const FORMAT_VERSION = 2;
const BUILTIN_IDS = new Set(BUILTIN_MODELS.map(m => m.id));

function get(key) {
  try { const t = localStorage.getItem(key); return t ? JSON.parse(t) : null; } catch { return null; }
}
function set(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
function remove(key) {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- router models ---------- */

export function normalizeModel(m) {
  if (!m || !m.id || !m.name) return null;
  const bands = Array.isArray(m.bands) ? m.bands.filter(b => BANDS[b]) : [];
  if (!bands.length) return null;
  const name = String(m.name).trim().slice(0, 60);
  return {
    id: String(m.id).slice(0, 40),
    name,
    short: String(m.short || name).trim().slice(0, 14),
    bands: BAND_KEYS.filter(b => bands.includes(b)),
    adj: clamp(Math.round(+m.adj || 0), -10, 10),
  };
}
export function loadCustomModels() {
  const a = get(KEYS.models);
  return Array.isArray(a) ? a.map(normalizeModel).filter(m => m && !BUILTIN_IDS.has(m.id)) : [];
}
export const saveCustomModels = list => set(KEYS.models, list);

/* ---------- projects ---------- */

export const blankFloor = name => ({ name, walls: [], nodes: [], labels: [], bg: null });
// Default names for new floors; the UI passes translated ones.
export const PT_NAMES = { ground: 'Térreo', nth: n => n + 'º andar' };

export function blankProject(name = 'Minha casa', ground = PT_NAMES.ground) {
  return { id: uid(), name, created: Date.now(), w: 16, h: 12, band: '5', heat: true, alpha: 0.55, floor: 0, floors: [blankFloor(ground)] };
}

const num = (v, d) => (Number.isFinite(+v) ? +v : d);

// Accepts anything that looks like a project (including files from older versions)
// and returns a valid one. Nodes using unknown models fall back to the first built-in.
export function normalizeProject(o, modelIds, names = PT_NAMES) {
  const p = o && typeof o === 'object' ? o : {};
  const out = {
    id: typeof p.id === 'string' && p.id ? p.id.slice(0, 40) : uid(),
    name: String(p.name || 'Minha casa').slice(0, 60),
    created: num(p.created, Date.now()),
    w: clamp(num(p.w, 16), 4, 80),
    h: clamp(num(p.h, 12), 4, 80),
    band: BANDS[p.band] ? p.band : '5',
    heat: p.heat !== false,
    alpha: clamp(num(p.alpha, 0.55), 0.1, 0.9),
    floor: 0,
    floors: [],
  };
  if (p.example) out.example = true;
  if (p.example && p.exampleEdited) out.exampleEdited = true;
  const floors = Array.isArray(p.floors) && p.floors.length ? p.floors : [blankFloor(names.ground)];
  out.floors = floors.slice(0, 8).map((f, i) => ({
    name: String(f?.name || (i ? names.nth(i) : names.ground)).slice(0, 30),
    walls: (f?.walls || []).filter(w => w && MATERIALS[w.m] && [w.x1, w.y1, w.x2, w.y2].every(Number.isFinite))
      .map(w => ({ x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2, m: w.m })),
    nodes: (f?.nodes || []).filter(n => n && Number.isFinite(n.x) && Number.isFinite(n.y))
      .map(n => ({ x: n.x, y: n.y, model: modelIds.has(n.model) ? n.model : BUILTIN_MODELS[0].id, main: !!n.main, wired: !!n.wired })),
    labels: (f?.labels || []).filter(l => l && l.t && Number.isFinite(l.x) && Number.isFinite(l.y))
      .map(l => ({ x: l.x, y: l.y, t: String(l.t).slice(0, 40) })),
    bg: f?.bg && typeof f.bg.src === 'string' && f.bg.src.startsWith('data:image/')
      ? { src: f.bg.src, mpp: num(f.bg.mpp, 0.01), alpha: clamp(num(f.bg.alpha, 0.5), 0.1, 1) } : null,
  }));
  out.floor = clamp(num(p.floor, 0) | 0, 0, out.floors.length - 1);
  const all = out.floors.flatMap(f => f.nodes);
  const first = Math.max(0, all.findIndex(n => n.main));
  all.forEach((n, i) => { n.main = i === first; });
  return out;
}

// Custom models used by the project travel with it, so exports and other browsers still work.
export function withModels(p, models) {
  const used = new Set(p.floors.flatMap(f => f.nodes.map(n => n.model)));
  return { ...p, models: [...used].filter(id => !BUILTIN_IDS.has(id) && models[id]).map(id => normalizeModel(models[id])) };
}

export function listProjects() {
  const a = get(KEYS.index);
  return Array.isArray(a) ? a.filter(x => x && x.id) : [];
}
export const loadProject = id => get(KEYS.project(id));
export const currentId = () => get(KEYS.current);

export function saveProject(p, models) {
  const data = { ...withModels(p, models), updated: Date.now() };
  let ok = set(KEYS.project(p.id), data), lostImage = false;
  if (!ok && data.floors.some(f => f.bg)) {
    ok = set(KEYS.project(p.id), { ...data, floors: data.floors.map(f => ({ ...f, bg: null })) });
    lostImage = ok;
  }
  if (ok) {
    const idx = listProjects(), i = idx.findIndex(x => x.id === p.id);
    const entry = { id: p.id, name: p.name, created: p.created, updated: data.updated };
    if (i >= 0) idx[i] = entry; else idx.push(entry);
    set(KEYS.index, idx);
    set(KEYS.current, p.id);
  }
  return { ok, lostImage };
}

export function deleteProject(id) {
  remove(KEYS.project(id));
  set(KEYS.index, listProjects().filter(x => x.id !== id));
}

// Version 1 kept a single plan under one key. Turn it into the first project.
export function migrateLegacy() {
  const old = get(KEYS.legacy);
  if (!old || listProjects().length) return null;
  const p = { ...old, id: uid(), name: old.example ? 'Casa de exemplo' : 'Minha casa', created: Date.now() };
  if (set(KEYS.project(p.id), p)) {
    set(KEYS.index, [{ id: p.id, name: p.name, created: p.created, updated: Date.now() }]);
    set(KEYS.current, p.id);
    remove(KEYS.legacy);
    return p.id;
  }
  return null;
}

/* ---------- example ---------- */

const PT_EXAMPLE = { name: 'Casa de exemplo', ground: 'Térreo', rooms: ['Cozinha', 'Sala', 'Quarto 1', 'Suíte', 'Quarto 2', 'Banho', 'Quarto 3', 'Área'] };

export function exampleProject(names = PT_EXAMPLE) {
  const R = names.rooms;
  const T = 'tijolo', M = 'madeira', V = 'vidro', X = 'metal';
  const W = (x1, y1, x2, y2, m = T) => ({ x1, y1, x2, y2, m });
  return {
    id: uid(), name: names.name, created: Date.now(), example: true,
    w: 16, h: 12, band: '5', heat: true, alpha: 0.55, floor: 0,
    floors: [{
      name: names.ground, bg: null,
      walls: [
        W(1, 1, 15, 1), W(15, 1, 15, 11), W(15, 11, 7, 11), W(7, 11, 4, 11, V), W(4, 11, 1, 11), W(1, 11, 1, 1),
        W(1, 5, 5, 5), W(1.25, 2, 1.25, 3, X),
        W(8, 1, 8, 5), W(8, 6.5, 8, 11),
        W(8, 5, 9, 5), W(9, 5, 10, 5, M), W(10, 5, 12.75, 5), W(12.75, 5, 13.75, 5, M), W(13.75, 5, 15, 5),
        W(12, 1, 12, 5),
        W(8, 6.5, 8.75, 6.5), W(8.75, 6.5, 9.75, 6.5, M), W(9.75, 6.5, 11, 6.5), W(11, 6.5, 12, 6.5, M),
        W(12, 6.5, 13.25, 6.5), W(13.25, 6.5, 14.25, 6.5, M), W(14.25, 6.5, 15, 6.5),
        W(10.5, 6.5, 10.5, 11), W(12.5, 6.5, 12.5, 11), W(10.5, 9, 12.5, 9), W(12.25, 7, 12.25, 8.5, X),
      ],
      nodes: [
        { x: 3, y: 8, model: 'be25', main: true, wired: false },
        { x: 11.5, y: 5.75, model: 'be25', main: false, wired: false },
      ],
      labels: [
        { x: 3, y: 3, t: R[0] }, { x: 5, y: 9.75, t: R[1] }, { x: 10, y: 3, t: R[2] }, { x: 13.5, y: 3, t: R[3] },
        { x: 9.25, y: 9, t: R[4] }, { x: 11.5, y: 7.75, t: R[5] }, { x: 13.75, y: 9, t: R[6] }, { x: 11.5, y: 10, t: R[7] },
      ],
    }],
  };
}

/* ---------- share links ---------- */

// A shared project travels in the fragment of a link (#p=…), which browsers never send to the
// server: compact JSON, deflate-compressed, in base64url. Floor-plan images stay out.
// Positions are rounded to the centimeter. Decoding returns a plain project for normalizeProject().
export const SHARE_PREFIX = '#p=';
export const SHARE_MAX = 8000; // characters of the encoded project; longer links break in some apps
const SHARE_VERSION = 1, SHARE_MAX_JSON = 1 << 20;
const cm = v => Math.round(v * 100) / 100;

async function pipe(bytes, stream) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader(), parts = [];
  for (let size = 0; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > SHARE_MAX_JSON) { reader.cancel(); throw new Error('share: too large'); }
    parts.push(value);
  }
  return new Uint8Array(await new Blob(parts).arrayBuffer());
}
const toB64url = bytes => btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

export async function encodeShare(p, models = {}) {
  const data = withModels(p, models);
  const compact = {
    v: SHARE_VERSION, n: p.name, w: cm(p.w), h: cm(p.h), b: p.band,
    f: p.floors.map(f => [f.name,
      f.walls.map(w => [cm(w.x1), cm(w.y1), cm(w.x2), cm(w.y2), w.m]),
      f.nodes.map(n => [cm(n.x), cm(n.y), n.model, (n.main ? 1 : 0) | (n.wired ? 2 : 0)]),
      f.labels.map(l => [cm(l.x), cm(l.y), l.t])]),
  };
  if (data.models.length) compact.m = data.models;
  return toB64url(await pipe(new TextEncoder().encode(JSON.stringify(compact)), new CompressionStream('deflate-raw')));
}

// Throws on anything that is not a project link made by encodeShare().
export async function decodeShare(s) {
  const o = JSON.parse(new TextDecoder().decode(await pipe(fromB64url(s), new DecompressionStream('deflate-raw'))));
  if (!o || o.v !== SHARE_VERSION || !Array.isArray(o.f)) throw new Error('share: format');
  const rows = a => (Array.isArray(a) ? a.filter(Array.isArray) : []);
  return {
    name: o.n, w: o.w, h: o.h, band: o.b, models: Array.isArray(o.m) ? o.m : [],
    floors: o.f.filter(Array.isArray).map(([name, walls, nodes, labels]) => ({
      name,
      walls: rows(walls).map(([x1, y1, x2, y2, m]) => ({ x1, y1, x2, y2, m })),
      nodes: rows(nodes).map(([x, y, model, flags]) => ({ x, y, model, main: !!(flags & 1), wired: !!(flags & 2) })),
      labels: rows(labels).map(([x, y, t]) => ({ x, y, t })),
    })),
  };
}
