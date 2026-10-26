import * as E from './engine.js';
import * as St from './store.js';
import { t, raw, locale, defaults } from './i18n.js';
import { startTour, tourSeen } from './tour.js';

const { BANDS, MATERIALS, GRID } = E;
const $ = s => document.querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d'), wrap = $('#wrap');
const fmt = (v, d = 1) => Number(v).toLocaleString(locale, { minimumFractionDigits: d, maximumFractionDigits: d });
const bandLabel = bk => raw('bands')?.[bk] || bk; // '2.4' has a dot, so no dotted-key lookup
const matLabel = m => t('materials.' + m);
const cat = i => raw('cats')?.[i] || { name: '', range: '', use: '' };
// Names the storage layer uses for new floors and projects, in the page language.
const NAMES = { ground: t('floors.ground'), nth: n => t('floors.nth', { n }) };
const dbm = v => (v === -Infinity ? '—' : '−' + Math.round(-v));
const pct = v => Math.round(v * 100) + '%';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Reads a number typed in the page's format ("2,5" or "2.5").
const parseNum = s => Number(String(s).trim().replace(/\s/g, '').replace(',', '.'));
const icon = id => `<svg class="ic" aria-hidden="true"><use href="#i-${id}"/></svg>`;
// Usage events (project_create, suggest_node...). Nothing listens in the public build; a build
// extension may forward them to its own statistics tool.
const track = (name, params = {}) => window.dispatchEvent(new CustomEvent('planejador:track', { detail: { name, params } }));

// Layout modes: the results drawer turns into a bottom sheet below 1100 px, and the tool rail
// moves to the bottom edge on phones. Touch screens get "tap" wording instead of "click".
const sheetMode = matchMedia('(max-width: 1099px)');
const compact = matchMedia('(max-width: 719px)');
const touchUI = matchMedia('(hover: none)');

/* ---------- state ---------- */
let custom = St.loadCustomModels();
let MODELS = {};
function rebuildModels() {
  MODELS = {};
  E.BUILTIN_MODELS.forEach(m => { MODELS[m.id] = m.id === 'isp' ? { ...m, name: t('models.isp'), short: t('models.ispShort') } : m; });
  custom.forEach(m => { MODELS[m.id] = { ...m, custom: true }; });
}
rebuildModels();

let P = null;
let tool = 'wall', mat = 'tijolo', model = 'be25', ortho = true;
let sel = null, drag = null, measure = null, suggestion = null;
// View: k pixels per meter, (ox, oy) the plan's top-left corner inside the map, k0 the fitted scale.
let k = 40, k0 = 40, ox = 0, oy = 0, fitted = true, dpr = 1, ver = 0;
let hist = [], fut = [];
const cur = () => P.floors[P.floor];
const nodesAll = () => E.nodesAll(P);
const nodeName = gi => { const a = nodesAll()[gi]; return a && a.n.main ? t('node.main') : t('node.n', { n: gi + 1 }); };
const restore = json => St.normalizeProject(JSON.parse(json), new Set(Object.keys(MODELS)), NAMES);

function pushHist() { hist.push(JSON.stringify(P)); if (hist.length > 80) hist.shift(); fut = []; }
function undo() {
  if (!hist.length) return;
  fut.push(JSON.stringify(P)); P = restore(hist.pop());
  sel = null; ver++; persist(); renderAll();
}
function redo() {
  if (!fut.length) return;
  hist.push(JSON.stringify(P)); P = restore(fut.pop());
  sel = null; ver++; persist(); renderAll();
}
function dirty() {
  ver++; suggestion = null;
  if (sel && sel.type === 'sug') sel = null;
  if (P.example) P.exampleEdited = true;
  persist(); schedule(); renderPanel();
}
const live = msg => { const el = $('#live'); el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 30); };

/* ---------- persistence ---------- */
let saveTimer = 0, warnedImage = false, warnedStorage = false;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(persistNow, 250); }
function persistNow() {
  clearTimeout(saveTimer);
  const r = St.saveProject(P, MODELS);
  if (!r.ok && !warnedStorage) { warnedStorage = true; toast(t('toast.storage')); }
  else if (r.lostImage && !warnedImage) { warnedImage = true; toast(t('toast.image')); }
  renderProjects();
}
window.addEventListener('pagehide', () => { if (P) persistNow(); });

function absorbModels(raw) {
  let changed = false;
  (raw.models || []).forEach(m => {
    const n = St.normalizeModel(m);
    if (n && !MODELS[n.id]) { custom.push(n); changed = true; }
  });
  if (changed) { St.saveCustomModels(custom); rebuildModels(); }
}
// Names the app generated (floor names, the example house) follow the page language, even when
// the project was created in another one. Names people typed are left alone.
function localizeDefaults(p) {
  if (!defaults.ground) return;
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nth = (defaults.nth || []).map(s => new RegExp('^' + escRe(s).replace('\\{n\\}', '(\\d+)') + '$'));
  p.floors.forEach(f => {
    if (defaults.ground.includes(f.name)) { f.name = NAMES.ground; return; }
    for (const re of nth) { const m = f.name.match(re); if (m) { f.name = NAMES.nth(+m[1]); return; } }
  });
  if (!p.example) return;
  if ((defaults.exampleName || []).includes(p.name)) p.name = t('project.exampleName');
  const rooms = raw('project.exampleRooms') || [];
  for (const list of defaults.exampleRooms || []) {
    p.floors.forEach(f => f.labels.forEach(l => { const i = list.indexOf(l.t); if (i >= 0 && rooms[i]) l.t = rooms[i]; }));
  }
}

function openProject(raw) {
  absorbModels(raw || {});
  P = St.normalizeProject(raw, new Set(Object.keys(MODELS)), NAMES);
  localizeDefaults(P);
  hist = []; fut = []; sel = null; measure = null; suggestion = null; ver++; fitted = true; inviteOff = false;
  persistNow(); renderAll();
}

/* ---------- drawing ---------- */
let C = {};
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  ['bg', 'sheet', 'ink', 'muted', 'line', 'grid', 'grid-strong', 'accent', 'on-accent', 'q0', 'q1', 'q2', 'q3', 'q4', ...Object.keys(MATERIALS).map(m => 'm-' + m)]
    .forEach(t => { C[t] = cs.getPropertyValue('--' + t).trim(); });
}
const rgb = h => { h = (h || '#888888').replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const imgCache = new Map();
function imgFor(src) {
  if (!imgCache.has(src)) { const im = new Image(); im.onload = schedule; im.src = src; imgCache.set(src, im); }
  return imgCache.get(src);
}

const cache = new Map(); let cacheVer = -1;
function grid(fi, bk, cs) {
  if (cacheVer !== ver) { cache.clear(); cacheVer = ver; }
  const key = fi + '|' + bk + '|' + cs.toFixed(4);
  if (!cache.has(key)) cache.set(key, E.computeGrid(P, MODELS, fi, bk, cs));
  return cache.get(key);
}
const stats = (fi, bk) => E.stats(P, MODELS, fi, bk, grid(fi, bk, 0.25));
// Coverage of the whole house on one band: every floor, weighted by its area.
function houseStats(bk) {
  let good = 0, n = 0, hasBand = false;
  P.floors.forEach((f, fi) => { const s = stats(fi, bk); good += s.good * s.n; n += s.n; hasBand = hasBand || s.hasBand; });
  return { good: n ? good / n : 0, hasBand };
}

/* ---------- view: fit, zoom and pan ---------- */
const area = $('#canvasArea'), ws = $('#simulator');
const el = id => document.getElementById(id);
// Space the floating layers take inside the map, so "fit" frames the plan between them.
function viewPad() {
  const m = area.getBoundingClientRect(), r = id => el(id).getBoundingClientRect();
  const fv = area.querySelector('.fl-view').getBoundingClientRect();
  const top = r('stageBar').bottom - m.top + 10;
  let bottom = Math.min(m.bottom, sheetMode.matches ? r('drawer').top : m.bottom);
  if (compact.matches) {
    bottom = Math.min(bottom, r('toolset').top, fv.top, el('toolOpts').hidden ? m.bottom : r('toolOpts').top);
    return { l: 8, t: top + area.querySelector('.fl-read').offsetHeight + 6, r: 8, b: m.bottom - bottom + 8 };
  }
  bottom = Math.min(bottom, fv.top, area.querySelector('.fl-read').getBoundingClientRect().top);
  return { l: r('toolset').right - m.left + 12, t: top, r: 14, b: m.bottom - bottom + 10 };
}
function fitView() {
  const W = area.clientWidth, H = area.clientHeight; if (!W || !H || !P) return;
  const pad = viewPad();
  const aw = Math.max(80, W - pad.l - pad.r), ah = Math.max(80, H - pad.t - pad.b);
  k0 = k = Math.max(4, Math.min(aw / P.w, ah / P.h));
  ox = pad.l + (aw - P.w * k) / 2; oy = pad.t + (ah - P.h * k) / 2;
  fitted = true;
}
function clampView() {
  const W = area.clientWidth, H = area.clientHeight, keep = 60;
  ox = clamp(ox, keep - P.w * k, W - keep); oy = clamp(oy, keep - P.h * k, H - keep);
}
function zoomAt(f, cx, cy) {
  const nk = clamp(k * f, k0 * 0.5, k0 * 8);
  const wx = (cx - ox) / k, wy = (cy - oy) / k;
  k = nk; ox = cx - wx * k; oy = cy - wy * k; fitted = false;
  clampView(); schedule();
}
const zoomCenter = f => zoomAt(f, area.clientWidth / 2, area.clientHeight / 2);

let lastSize = '';
function resize() {
  const W = area.clientWidth, H = area.clientHeight; if (!W || !H || !P) return;
  layoutVars();
  dpr = window.devicePixelRatio || 1;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const size = W + 'x' + H + ':' + P.w + 'x' + P.h;
  if (fitted || size.split(':')[1] !== lastSize.split(':')[1]) fitView(); else clampView();
  lastSize = size;
  draw();
}
let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }

// Heights the CSS needs to stack the phone layers: rail, drawer head and top bar.
function layoutVars() {
  const s = ws.style;
  const hdr = document.querySelector('.site');
  s.setProperty('--hdr', (hdr ? hdr.getBoundingClientRect().height : 60) + 'px');
  s.setProperty('--tb-h', el('toolset').offsetHeight + 'px');
  s.setProperty('--dh-h', el('drawerHead').offsetHeight + 'px');
  s.setProperty('--flt-h', el('stageBar').offsetHeight + 'px');
  // Tool options sit on the top bar's row, right after its last control.
  const bar = el('stageBar'), last = bar.lastElementChild;
  s.setProperty('--opt-left', (last.getBoundingClientRect().right - bar.getBoundingClientRect().left + 16) + 'px');
}

function line(w) { ctx.beginPath(); ctx.moveTo(w.x1 * k, w.y1 * k); ctx.lineTo(w.x2 * k, w.y2 * k); ctx.stroke(); }
function halo(t, x, y, color) {
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = C.sheet; ctx.lineJoin = 'round';
  ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y); ctx.restore();
}
const nodeR = () => Math.max(9, 0.28 * k);

function draw() {
  if (!P) return;
  readTokens();
  const W = cv.width / dpr, H = cv.height / dpr, f = cur(), all = nodesAll();
  const PW = P.w * k, PH = P.h * k;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
  ctx.fillStyle = C.sheet; ctx.fillRect(0, 0, PW, PH);

  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, PW, PH); ctx.clip();
  if (f.bg) {
    const im = imgFor(f.bg.src);
    if (im.complete && im.naturalWidth) {
      ctx.globalAlpha = f.bg.alpha; ctx.drawImage(im, 0, 0, im.naturalWidth * f.bg.mpp * k, im.naturalHeight * f.bg.mpp * k); ctx.globalAlpha = 1;
    }
  }
  if (P.heat && all.length) {
    const cols = Math.min(180, Math.ceil(P.w / 0.1)), cs = P.w / cols, g = grid(P.floor, P.band, cs);
    const off = document.createElement('canvas'); off.width = g.cols; off.height = g.rows;
    const oc = off.getContext('2d'), id = oc.createImageData(g.cols, g.rows);
    const pal = [0, 1, 2, 3, 4].map(i => rgb(C['q' + i])), a = Math.round(P.alpha * 255);
    for (let i = 0; i < g.v.length; i++) {
      const p = pal[E.catOf(g.v[i])];
      id.data[i * 4] = p[0]; id.data[i * 4 + 1] = p[1]; id.data[i * 4 + 2] = p[2]; id.data[i * 4 + 3] = g.v[i] === -Infinity ? 0 : a;
    }
    oc.putImageData(id, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, g.cols * cs * k, g.rows * cs * k);
  }

  ctx.lineWidth = 1;
  for (let x = 0; x <= P.w; x++) { ctx.strokeStyle = x % 5 === 0 ? C['grid-strong'] : C.grid; ctx.beginPath(); ctx.moveTo(Math.round(x * k) + 0.5, 0); ctx.lineTo(Math.round(x * k) + 0.5, PH); ctx.stroke(); }
  for (let y = 0; y <= P.h; y++) { ctx.strokeStyle = y % 5 === 0 ? C['grid-strong'] : C.grid; ctx.beginPath(); ctx.moveTo(0, Math.round(y * k) + 0.5); ctx.lineTo(PW, Math.round(y * k) + 0.5); ctx.stroke(); }
  ctx.fillStyle = C.muted; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'start';
  const step = k < 18 ? 4 : 2;
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = C.sheet; ctx.lineJoin = 'round';
  for (let x = step; x < P.w; x += step) { ctx.strokeText(x + ' m', x * k + 3, 3); ctx.fillText(x + ' m', x * k + 3, 3); }
  for (let y = step; y < P.h; y += step) { ctx.strokeText(y + ' m', 3, y * k + 3); ctx.fillText(y + ' m', 3, y * k + 3); }
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(-0.5, -0.5, PW + 1, PH + 1);

  P.floors.forEach((of, fi) => {
    if (fi === P.floor) return;
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5;
    of.walls.forEach(line); ctx.restore();
  });

  ctx.lineCap = 'round';
  f.walls.forEach((w, i) => {
    if (sel && sel.type === 'wall' && sel.i === i) {
      ctx.strokeStyle = C.accent; ctx.lineWidth = Math.max(8, MATERIALS[w.m].w * k + 6); ctx.globalAlpha = 0.35; line(w); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = C['m-' + w.m];
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(w.m === 'tijolo' || w.m === 'concreto' ? 4 : 2.5, MATERIALS[w.m].w * k);
    if (w.m === 'vidro') { ctx.setLineDash([6, 3]); line(w); ctx.setLineDash([]); } else line(w);
  });
  if (sel && sel.type === 'wall' && f.walls[sel.i] && tool === 'select') {
    const w = f.walls[sel.i];
    [[w.x1, w.y1], [w.x2, w.y2]].forEach(([x, y]) => {
      ctx.fillStyle = C.sheet; ctx.strokeStyle = C.accent; ctx.lineWidth = 2;
      ctx.fillRect(x * k - 5, y * k - 5, 10, 10); ctx.strokeRect(x * k - 5, y * k - 5, 10, 10);
    });
  }

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 13px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
  // Room names step above a node that sits on them, so both stay readable.
  f.labels.forEach((l, i) => {
    const near = f.nodes.some(n => Math.abs(n.x - l.x) * k < 46 && Math.abs(n.y - l.y) * k < 22);
    halo(l.t, l.x * k, l.y * k - (near ? nodeR() + 16 : 0), sel && sel.type === 'label' && sel.i === i ? C.accent : C.ink);
  });

  E.topology(P, MODELS).forEach(l => {
    const a = all[l.child], b = all[l.parent];
    if (a.fi !== P.floor || b.fi !== P.floor) return;
    const picked = sel && sel.type === 'link' && sel.child === l.child;
    ctx.save(); ctx.lineWidth = picked ? 3.5 : 2;
    if (l.wired) { ctx.strokeStyle = C.ink; ctx.setLineDash([2, 4]); } else { ctx.strokeStyle = C[linkColor(l.v)]; ctx.setLineDash([8, 5]); }
    ctx.beginPath(); ctx.moveTo(a.n.x * k, a.n.y * k); ctx.lineTo(b.n.x * k, b.n.y * k); ctx.stroke(); ctx.restore();
    // The label is a target: a small tag that opens the link popover.
    const mx = (a.n.x + b.n.x) / 2 * k, my = (a.n.y + b.n.y) / 2 * k;
    const text = l.wired ? t('node.cable') : dbm(l.v) + ' dBm';
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    const tw = ctx.measureText(text).width + 12;
    ctx.save();
    ctx.fillStyle = C.sheet; ctx.strokeStyle = picked ? C.accent : (l.wired ? C.line : C[linkColor(l.v)]); ctx.lineWidth = picked ? 2 : 1.25;
    roundRect(mx - tw / 2, my - 9, tw, 18, 9); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.fillStyle = C.ink; ctx.fillText(text, mx, my + 0.5);
  });

  const r = nodeR();
  all.forEach((a, gi) => {
    const x = a.n.x * k, y = a.n.y * k, m = MODELS[a.n.model];
    if (a.fi !== P.floor) {
      ctx.save(); ctx.setLineDash([3, 3]); ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.font = '500 11px "IBM Plex Mono", monospace';
      halo(nodeName(gi) + ' · ' + P.floors[a.fi].name, x, y + r + 9, C.muted);
      return;
    }
    const active = m.bands.includes(P.band);
    if (sel && sel.type === 'node' && sel.i === a.ni) {
      ctx.fillStyle = C.accent; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (active) { ctx.fillStyle = a.n.main ? C.accent : C.ink; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.sheet; ctx.stroke(); }
    else { ctx.fillStyle = C.sheet; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.muted; ctx.stroke(); }
    ctx.fillStyle = active ? (a.n.main ? C['on-accent'] : C.sheet) : C.muted;
    ctx.font = '600 ' + Math.round(r * 0.9) + 'px "Barlow Semi Condensed", sans-serif';
    ctx.fillText(a.n.main ? t('node.mainShort') : String(gi + 1), x, y + 1);
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    halo(m.short + (a.n.wired ? ' · ' + t('node.cable') : '') + (active ? '' : ' · ' + t('node.without', { band: bandLabel(P.band) })), x, y + r + 9, C.ink);
  });

  if (suggestion && suggestion.fi === P.floor && !suggestion.none) {
    const x = suggestion.x * k, y = suggestion.y * k;
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, r + 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.font = '600 12px "Barlow Semi Condensed", sans-serif'; halo(t('node.suggestion'), x, y - r - 12, C.accent);
  }

  const isWall = drag && drag.kind === 'wall';
  const seg = drag && (drag.kind === 'wall' || drag.kind === 'measure') ? drag : (measure && measure.fi === P.floor ? measure : null);
  if (seg) {
    ctx.save(); ctx.strokeStyle = isWall ? C['m-' + mat] : C.accent; ctx.lineWidth = isWall ? Math.max(3, MATERIALS[mat].w * k) : 2;
    if (!isWall) ctx.setLineDash([6, 4]);
    line(seg); ctx.restore();
    ctx.font = '500 12px "IBM Plex Mono", monospace';
    halo(fmt(Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1), 2) + ' m', (seg.x1 + seg.x2) / 2 * k, (seg.y1 + seg.y2) / 2 * k - 12, C.ink);
  }
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  placePop();
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* ---------- canvas interaction ---------- */
function pos(e) {
  const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  return { x: (px - ox) / k, y: (py - oy) / k, px, py };
}
function snapPt(x, y) {
  let best = null, bd = 0.3;
  cur().walls.forEach(w => [[w.x1, w.y1], [w.x2, w.y2]].forEach(([px, py]) => {
    const d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = { x: px, y: py }; }
  }));
  return best || { x: clamp(Math.round(x / GRID) * GRID, 0, P.w), y: clamp(Math.round(y / GRID) * GRID, 0, P.h) };
}
function wallEnd(x1, y1, p) {
  const s = snapPt(p.x, p.y);
  if (!ortho) return s;

  return Math.abs(s.x - x1) >= Math.abs(s.y - y1) ? { x: s.x, y: y1 } : { x: x1, y: s.y };
}
function linkAt(p) {
  const all = nodesAll();
  for (const l of E.topology(P, MODELS)) {
    const a = all[l.child], b = all[l.parent];
    if (a.fi !== P.floor || b.fi !== P.floor) continue;
    const mx = (a.n.x + b.n.x) / 2, my = (a.n.y + b.n.y) / 2;
    if (Math.abs(mx - p.x) * k < 32 && Math.abs(my - p.y) * k < 12) return { type: 'link', child: l.child };
  }
  return null;
}
// Ends of the selected wall are handles that resize it.
function wallHandleAt(p) {
  if (!sel || sel.type !== 'wall') return 0;
  const w = cur().walls[sel.i]; if (!w) return 0;
  const near = (x, y) => Math.hypot(x - p.x, y - p.y) * k < 12;
  return near(w.x1, w.y1) ? 1 : near(w.x2, w.y2) ? 2 : 0;
}
function hitTest(p, links = false) {
  const f = cur(), tol = Math.max(0.25, 9 / k);
  for (let i = f.nodes.length - 1; i >= 0; i--) if (Math.hypot(f.nodes[i].x - p.x, f.nodes[i].y - p.y) < Math.max(0.45, 14 / k)) return { type: 'node', i };
  if (links) { const l = linkAt(p); if (l) return l; }
  for (let i = f.labels.length - 1; i >= 0; i--) {
    const l = f.labels[i];
    if (Math.abs(l.x - p.x) < Math.max(0.6, (l.t.length * 3.5) / k) && Math.abs(l.y - p.y) < Math.max(0.3, 9 / k)) return { type: 'label', i };
  }
  let bi = -1, bd = tol;
  f.walls.forEach((w, i) => { const d = E.distSeg(p.x, p.y, w); if (d < bd) { bd = d; bi = i; } });
  return bi >= 0 ? { type: 'wall', i: bi } : null;
}
function removeHit(h) {
  const f = cur(), arr = h.type === 'wall' ? f.walls : h.type === 'node' ? f.nodes : f.labels;
  const removed = arr.splice(h.i, 1)[0];
  if (h.type === 'node' && removed && removed.main) { const first = nodesAll()[0]; if (first) first.n.main = true; }
}

// Pointers: one finger or the mouse draws and edits; two fingers pan and zoom. Taps (no
// movement) place nodes, erase and name rooms, so a pinch never leaves a stray node behind.
const ptrs = new Map();
let tap = null, pan = null, pinch = null, spaceDown = false, overMap = false;
const TAP = 6;

function startPan(e) { pan = { x: e.clientX, y: e.clientY, ox, oy }; cv.style.cursor = 'grabbing'; }
function cancelDrag() {
  if (!drag) return;
  if ((drag.kind === 'node' || drag.kind === 'label' || drag.kind === 'wallEnd') && hist.length) {
    if (drag.moved) { P = restore(hist.pop()); ver++; } else hist.pop();
    fut = drag.fut || fut;
  }
  drag = null; schedule();
}
cv.addEventListener('pointerdown', e => {
  if (!$('#invite').hidden) { inviteOff = true; $('#invite').hidden = true; }
  try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  touched = true;
  if (ptrs.size === 2) {
    cancelDrag(); tap = null; pan = null;
    const [a, b] = [...ptrs.values()], r = cv.getBoundingClientRect();
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top, ox, oy };
    return;
  }
  if (ptrs.size > 2) return;
  if (e.button === 1 || (e.button === 0 && spaceDown)) { e.preventDefault(); startPan(e); return; }
  if (e.button > 0) return;
  const p = pos(e);
  hideLabelInput(true);
  tap = { x: e.clientX, y: e.clientY, p, moved: false };
  if (tool === 'wall' || tool === 'measure') {
    const s = snapPt(p.x, p.y);
    drag = { kind: tool, x1: s.x, y1: s.y, x2: s.x, y2: s.y };
    if (tool === 'measure') { measure = null; if (sel && sel.type === 'measure') sel = null; }
  } else if (tool === 'select') {
    const end = wallHandleAt(p);
    if (end) {
      const w = cur().walls[sel.i], x = w['x' + end], y = w['y' + end], f0 = fut;
      pushHist();
      const joined = [];
      cur().walls.forEach((v, j) => [1, 2].forEach(n => { if (j !== sel.i && Math.hypot(v['x' + n] - x, v['y' + n] - y) < 0.01) joined.push([j, n]); }));
      drag = { kind: 'wallEnd', i: sel.i, end, x, y, joined: [[sel.i, end], ...joined], moved: false, fut: f0 };
      return;
    }
    const h = hitTest(p, true);
    sel = h;
    if (h && (h.type === 'node' || h.type === 'label')) {
      // The popover opens on a plain click, not after dragging the object somewhere else.
      const f0 = fut; pushHist(); drag = { kind: h.type, i: h.i, moved: false, fut: f0 };
      $('#pop').classList.add('away');
    } else if (!h) startPan(e);
    renderPop(); schedule(); readout(p);
  }
});
cv.addEventListener('pointermove', e => {
  if (!drag && !pan && tool === 'select' && e.pointerType === 'mouse') cv.style.cursor = wallHandleAt(pos(e)) ? 'move' : 'default';
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()], r = cv.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
    const nk = clamp(pinch.k * d / Math.max(1, pinch.d), k0 * 0.5, k0 * 8);
    const wx = (pinch.cx - pinch.ox) / pinch.k, wy = (pinch.cy - pinch.oy) / pinch.k;
    k = nk; ox = cx - wx * k; oy = cy - wy * k; fitted = false; clampView(); schedule();
    return;
  }
  if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP) tap.moved = true;
  if (pan) {
    if (tap && !tap.moved) return;
    ox = pan.ox + e.clientX - pan.x; oy = pan.oy + e.clientY - pan.y; fitted = false; clampView(); schedule();
    return;
  }
  const p = pos(e);
  if (drag) {
    if (drag.kind === 'wall') { const s = wallEnd(drag.x1, drag.y1, p); drag.x2 = s.x; drag.y2 = s.y; }
    else if (drag.kind === 'wallEnd') {
      // Ends move freely (snapping to the grid and other walls), so an existing wall can be tilted.
      const s = snapPt(p.x, p.y);
      if (s.x !== drag.x || s.y !== drag.y) {
        // Corners follow: other wall ends that met this one move with it.
        drag.joined.forEach(([j, end]) => { const v = cur().walls[j]; v['x' + end] = s.x; v['y' + end] = s.y; });
        drag.x = s.x; drag.y = s.y; drag.moved = true; ver++; suggestion = null; $('#pop').classList.add('away');
      }
    }
    else if (drag.kind === 'measure') { const s = snapPt(p.x, p.y); drag.x2 = s.x; drag.y2 = s.y; }
    else if (tap && tap.moved) {
      const o = drag.kind === 'node' ? cur().nodes[drag.i] : cur().labels[drag.i];
      const s = drag.kind === 'node' ? snapPt(p.x, p.y) : { x: clamp(p.x, 0, P.w), y: clamp(p.y, 0, P.h) };
      if (o && (o.x !== s.x || o.y !== s.y)) {
        o.x = s.x; o.y = s.y; drag.moved = true; $('#pop').classList.add('away');
        if (drag.kind === 'node') { ver++; suggestion = null; }
      }
    }
    schedule();
  }
  if (e.pointerType === 'mouse' || drag) readout(p);
});
function endPointer(e) {
  ptrs.delete(e.pointerId);
  if (pinch) { if (!ptrs.size) pinch = null; tap = null; return; }
  if (pan) {
    const wasTap = tap && !tap.moved; pan = null; setCursor();
    if (wasTap && tool === 'select') { sel = null; renderPop(); schedule(); }
    tap = null; return;
  }
  const p = tap && tap.p, wasTap = tap && !tap.moved; tap = null;
  $('#pop').classList.remove('away');
  if (drag) { endDrag(); return; }
  if (!wasTap || e.type === 'pointercancel') return;
  if (tool === 'node') {
    pushHist();
    const s = snapPt(p.x, p.y);
    cur().nodes.push({ x: s.x, y: s.y, model, main: !nodesAll().length, wired: false });
    sel = { type: 'node', i: cur().nodes.length - 1 };
    dirty(); live(t('live.node', { node: nodeName(nodesAll().length - 1) }));
  } else if (tool === 'erase') {
    const h = hitTest(p);
    if (h) { pushHist(); removeHit(h); sel = null; dirty(); live(t('live.deleted')); }
  } else if (tool === 'label') {
    openLabelInput(p);
  }
}
function endDrag() {
  const d = drag; drag = null;
  if (d.kind === 'wall') {
    const len = Math.hypot(d.x2 - d.x1, d.y2 - d.y1);
    if (len >= 0.2) { pushHist(); cur().walls.push({ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, m: mat }); dirty(); live(t('live.wall', { len: fmt(len, 2) })); }
    else schedule();
  } else if (d.kind === 'measure') {
    measure = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= 0.1 ? { ...d, fi: P.floor } : null;
    sel = measure ? { type: 'measure' } : null;
    renderPop(); schedule();
  } else if (!d.moved) { hist.pop(); fut = d.fut || fut; renderPop(); }
  else {
    if (d.kind === 'node' || d.kind === 'label') sel = null;
    dirty();
  }
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('pointerleave', e => { overMap = false; if (e.pointerType === 'mouse' && !drag && !pan) readout(null); });
cv.addEventListener('pointerenter', () => { overMap = true; });
cv.addEventListener('wheel', e => {
  if (!(e.ctrlKey || e.metaKey)) return; // plain wheel scrolls the page; Ctrl/pinch zooms the plan
  e.preventDefault();
  const r = cv.getBoundingClientRect();
  zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });

let touched = false; // phones show the tool hint until the first touch on the plan
function readout(p) {
  const box = $('#readout');
  const hint = t((touchUI.matches ? 'hintsTouch.' : 'hints.') + tool);
  $('#toolHint').textContent = hint;
  $('#toolHint').hidden = compact.matches;
  box.classList.toggle('is-hint', !p && compact.matches && !touched);
  if (!p) { box.textContent = compact.matches && !touched ? hint : t(touchUI.matches ? 'readout.idleTouch' : 'readout.idle'); return; }
  const nodes = nodesAll();
  const where = `<span class="mono">x ${fmt(p.x, 1)} · y ${fmt(p.y, 1)} m</span>`;
  if (!nodes.length) { box.innerHTML = `${where} · <b>${esc(t('readout.noNodes'))}</b>`; return; }
  const b = E.bestAt(P, MODELS, p.x, p.y, P.floor, P.band, nodes);
  const others = `<span class="mono">${E.BAND_KEYS.filter(bk => bk !== P.band)
    .map(bk => `${bandLabel(bk)} ${dbm(E.bestAt(P, MODELS, p.x, p.y, P.floor, bk, nodes).v)}`).join(' · ')}</span>`;
  box.innerHTML = b.v === -Infinity
    ? `${where} · <b>${esc(t('readout.noBand', { band: bandLabel(P.band) }))}</b> · ${others}`
    : `${where} · <b><span class="mono">${dbm(b.v)} dBm</span>, ${esc(cat(E.catOf(b.v)).name.toLowerCase())}</b> ${esc(t('readout.via'))} ${esc(nodeName(b.who))} · ${others}`;
}

const li = $('#labelInput'); let liPos = null;
function openLabelInput(p) {
  const at = { x: p.x, y: p.y };
  li.style.left = clamp(p.px - 75, 4, wrap.clientWidth - 154) + 'px';
  li.style.top = clamp(p.py - 14, 4, wrap.clientHeight - 32) + 'px';
  setTimeout(() => { liPos = at; li.value = ''; li.hidden = false; li.focus(); }, 30);
}
function hideLabelInput(commit) {
  if (li.hidden) return;
  const t = li.value.trim(); li.hidden = true;
  if (commit && t && liPos) { pushHist(); cur().labels.push({ x: liPos.x, y: liPos.y, t: t.slice(0, 40) }); dirty(); }
  liPos = null;
}
li.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); hideLabelInput(true); }
  else if (e.key === 'Escape') hideLabelInput(false);
  e.stopPropagation();
});
li.addEventListener('blur', () => hideLabelInput(true));

function nudge(dx, dy) {
  if (!sel || (sel.type !== 'node' && sel.type !== 'label')) return false;
  const o = (sel.type === 'node' ? cur().nodes : cur().labels)[sel.i]; if (!o) return false;
  pushHist(); o.x = clamp(o.x + dx, 0, P.w); o.y = clamp(o.y + dy, 0, P.h); dirty();
  return true;
}
// Keyboard selection on the focused plan: [ and ] step through walls, nodes and names.
function itemsOnFloor() {
  const f = cur();
  return [...f.nodes.map((_, i) => ({ type: 'node', i })), ...f.labels.map((_, i) => ({ type: 'label', i })), ...f.walls.map((_, i) => ({ type: 'wall', i }))];
}
function itemName(h) {
  const f = cur();
  if (h.type === 'node') return nodeName(nodesAll().findIndex(a => a.n === f.nodes[h.i]));
  if (h.type === 'label') return f.labels[h.i].t;
  const w = f.walls[h.i];
  return `${t('sel.wall')}, ${matLabel(w.m)}, ${fmt(Math.hypot(w.x2 - w.x1, w.y2 - w.y1), 2)} m`;
}
function stepSelection(dir) {
  const list = itemsOnFloor(); if (!list.length) return;
  const at = sel ? list.findIndex(h => h.type === sel.type && h.i === sel.i) : -1;
  sel = list[(at + dir + list.length) % list.length];
  renderPop(); schedule(); live(t('live.selected', { item: itemName(sel) }));
}
// Single-key shortcuts only act while the planner is in use: focus on the page itself or inside it,
// and the workspace on screen. Reading the guide with the keyboard never changes the plan.
function plannerActive(target) {
  if (target !== document.body && !ws.contains(target)) return false;
  const r = ws.getBoundingClientRect();
  return r.bottom > 80 && r.top < window.innerHeight - 80;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const menu = $('#projMenu');
    if (menu.open) { menu.open = false; menu.querySelector('summary').focus(); return; }
  }
  if (e.target.closest('input,textarea,select,dialog')) return;
  if (!plannerActive(e.target)) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (mod || e.altKey) return;
  if (e.key === ' ') {
    if (overMap && !e.target.closest('button,summary,a')) { e.preventDefault(); spaceDown = true; cv.style.cursor = 'grab'; }
    return;
  }
  if (e.target === cv && (e.key === '[' || e.key === ']')) { e.preventDefault(); stepSelection(e.key === ']' ? 1 : -1); return; }
  const map = { v: 'select', w: 'wall', n: 'node', t: 'label', m: 'measure', e: 'erase' };
  const tl = map[e.key.toLowerCase()];
  if (tl) { setTool(tl); return; }
  const bands = { 1: '2.4', 2: '5', 3: '6' };
  if (bands[e.key]) { setBand(bands[e.key]); return; }
  if (e.key === '+' || e.key === '=') { zoomCenter(1.25); return; }
  if (e.key === '-' || e.key === '_') { zoomCenter(0.8); return; }
  if (e.key === '0') { fitView(); schedule(); return; }
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[e.key]) { const s = e.shiftKey ? 1 : GRID; if (nudge(arrows[e.key][0] * s, arrows[e.key][1] * s)) e.preventDefault(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel && ['wall', 'node', 'label'].includes(sel.type)) {
    e.preventDefault(); pushHist(); removeHit(sel); sel = null; dirty(); live(t('live.deleted')); return;
  }
  if (e.key === 'Escape') { drag = null; sel = null; measure = null; renderPop(); schedule(); }
});
document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; setCursor(); } });

/* ---------- tool rail and options ---------- */
function setCursor() { cv.style.cursor = tool === 'select' ? 'default' : tool === 'erase' ? 'not-allowed' : 'crosshair'; }
function setTool(name) {
  tool = name; touched = false;
  document.querySelectorAll('#toolset [data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === name)));
  $('#matGroup').hidden = name !== 'wall';
  $('#modelGroup').hidden = name !== 'node';
  $('#toolOpts').hidden = name !== 'wall' && name !== 'node';
  if (sel && sel.type === 'measure' && name !== 'measure') { sel = null; measure = null; renderPop(); }
  setCursor(); readout(null);
  if (fitted && P) fitView(); // the phone's tool options take room above the rail
  schedule();
}
document.querySelectorAll('#toolset [data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

const matText = (key, db) => t('sel.matLoss', { mat: matLabel(key), db, band: bandLabel(P.band) });
function fillMatSel() {
  const bi = BANDS[P.band].i;
  $('#matSel').innerHTML = Object.entries(MATERIALS)
    .map(([key, m]) => `<option value="${key}"${key === mat ? ' selected' : ''}>${esc(matText(key, m.db[bi]))}</option>`).join('');
}
function modelOptions(selected) {
  const opt = m => `<option value="${esc(m.id)}"${m.id === selected ? ' selected' : ''}>${esc(m.name)}</option>`;
  return `<optgroup label="${esc(t('models.ready'))}">${E.BUILTIN_MODELS.map(m => opt(MODELS[m.id])).join('')}</optgroup>`
    + (custom.length ? `<optgroup label="${esc(t('models.mine'))}">${custom.map(opt).join('')}</optgroup>` : '');
}
function fillModelSel() {
  if (!MODELS[model]) model = 'be25';
  $('#modelSel').innerHTML = modelOptions(model);
}
$('#matSel').addEventListener('change', e => { mat = e.target.value; });
$('#modelSel').addEventListener('change', e => { model = e.target.value; });
$('#ortho').addEventListener('change', e => { ortho = e.target.checked; });
$('#heatOn').addEventListener('change', e => { P.heat = e.target.checked; persist(); schedule(); });
$('#alpha').addEventListener('input', e => { P.alpha = e.target.value / 100; persist(); schedule(); });
$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);
$('#zoomIn').addEventListener('click', () => zoomCenter(1.25));
$('#zoomOut').addEventListener('click', () => zoomCenter(0.8));
$('#zoomFit').addEventListener('click', () => { fitView(); schedule(); });
$('#manageModels').addEventListener('click', openModels);

const hasBandDevice = bk => nodesAll().some(a => MODELS[a.n.model].bands.includes(bk));
// Devices that transmit on a band, when only some of them do (null when all or none do).
function bandShare(bk) {
  const all = nodesAll(), on = all.map((a, gi) => ({ a, gi })).filter(o => MODELS[o.a.n.model].bands.includes(bk));
  if (!on.length || on.length === all.length) return null;
  return { n: on.length, total: all.length, names: on.map(o => nodeName(o.gi)).join(', ') };
}
const partialText = bk => { const p = bandShare(bk); return p ? t('panel.bandPartial', { ...p, band: bandLabel(bk) }) : ''; };
let bandsSig = '';
function renderBands() {
  const sig = P.band + E.BAND_KEYS.map(bk => +hasBandDevice(bk)).join('') + nodesAll().length;
  if (sig === bandsSig) return;
  bandsSig = sig;
  $('#bands').innerHTML = E.BAND_KEYS.map(bk => {
    const none = nodesAll().length && !hasBandDevice(bk), label = t('bandNoDevice', { band: bandLabel(bk) });
    return `<button type="button" aria-pressed="${bk === P.band}" data-band="${bk}"${none ? ` class="nodev" title="${esc(label)}" aria-label="${esc(label)}"` : ''}>${bandLabel(bk)}</button>`;
  }).join('');
}
function setBand(bk) {
  if (!BANDS[bk] || bk === P.band) return;
  P.band = bk; suggestion = null; if (sel && sel.type === 'sug') sel = null;
  persist(); fillMatSel(); renderPanel(); schedule(); live(t('live.band', { band: bandLabel(bk) }));
}
$('#bands').addEventListener('click', e => { const b = e.target.closest('[data-band]'); if (b) setBand(b.dataset.band); });

function renderFloors() {
  $('#floors').innerHTML = P.floors.map((f, i) => `<button type="button" aria-pressed="${i === P.floor}" data-floor="${i}">${esc(f.name)}</button>`).join('')
    + `<button type="button" class="ghost" data-floor="add">${esc(t('floors.add'))}</button>`;
}
$('#floors').addEventListener('click', e => {
  const b = e.target.closest('[data-floor]'); if (!b) return;
  if (b.dataset.floor === 'add') {
    pushHist(); P.floors.push(St.blankFloor(NAMES.nth(P.floors.length))); P.floor = P.floors.length - 1;
  } else P.floor = +b.dataset.floor;
  sel = null; measure = null; dirty(); afterFloor();
});

function renderLegend() {
  $('#legend').innerHTML = [0, 1, 2, 3, 4].map(i => `<span><i class="sw" style="background:var(--q${i})"></i>${esc(cat(i).name)} <span class="muted">${esc(cat(i).range)}</span></span>`).join('')
    + `<span><i class="sw" style="background:var(--accent)"></i>${esc(t('legendMain'))}</span>`;
}

/* ---------- results drawer ---------- */
let drawerOpen = true;
const DRAWER_KEY = 'planejador:drawer';
function drawerPref() { try { return localStorage.getItem(DRAWER_KEY) !== 'closed'; } catch { return true; } }
function setDrawer(open, remember = false) {
  drawerOpen = open;
  ws.classList.toggle('drawer-closed', !open);
  $('#drawerToggle').setAttribute('aria-expanded', String(open));
  $('#drawerToggle').title = open ? t('hud.close') : t('hud.open');
  $('#hud').hidden = open || sheetMode.matches;
  $('#hud').setAttribute('aria-expanded', String(open));
  if (remember && !sheetMode.matches) { try { localStorage.setItem(DRAWER_KEY, open ? 'open' : 'closed'); } catch { /* ignore */ } }
  requestAnimationFrame(() => { layoutVars(); placePop(); });
}
$('#drawerToggle').addEventListener('click', () => setDrawer(!drawerOpen, true));
$('#hud').addEventListener('click', () => setDrawer(true, true));
sheetMode.addEventListener('change', () => setDrawer(sheetMode.matches ? false : drawerPref()));

// The verdict: what to buy, whether a cable is needed and how each band covers the house.
function mainBand() { return hasBandDevice('5') || !hasBandDevice('2.4') ? '5' : '2.4'; }
function verdict() {
  const all = nodesAll();
  if (!all.length) return null;
  const mb = mainBand(), house = Object.fromEntries(E.BAND_KEYS.map(bk => [bk, houseStats(bk)]));
  const weak = E.weakLinks(P, MODELS);
  const short = house[mb].good < 0.9;
  return { mb, house, weak, status: short ? 'short' : weak.length ? 'okCable' : 'ok' };
}
// Status icon: check when the plan covers the house, alert otherwise (red when signal is missing).
const linkColor = v => ['q0', 'q0', 'q1', 'q1', 'q4'][E.linkCat(v)];
const statusIcon = s => `<svg class="ic st-ic st-${s === 'ok' ? 'ok' : s === 'okCable' ? 'warn' : 'bad'}" aria-hidden="true"><use href="#i-${s === 'ok' ? 'check' : 'alert'}"/></svg>`;
function summaryChip(v) {
  if (!v) return `<span class="dot" style="background:var(--muted)"></span>${esc(t('hud.noNodes'))}`;
  const weak = v.weak.length ? ' · ' + esc(v.weak.length === 1 ? t('hud.weak1') : t('hud.weakN', { n: v.weak.length })) : '';
  return `${statusIcon(v.status)}${esc(t('hud.mainBand', { band: bandLabel(v.mb) }))} · <b>${pct(v.house[v.mb].good)}</b>${weak}`;
}
function renderVerdict(v) {
  let h = `<h2>${esc(t('verdict.title'))}</h2>`;
  if (!v) {
    h += `<p class="small muted">${esc(t('verdict.empty'))}</p><div class="btnrow"><button type="button" class="primary" data-pick="node">${esc(t('verdict.placeNode'))}</button></div>`;
    $('#pVerdict').innerHTML = h; return;
  }
  const kit = {};
  nodesAll().forEach(a => { kit[a.n.model] = (kit[a.n.model] || 0) + 1; });
  const kitText = Object.entries(kit).map(([id, n]) => `${n} × ${MODELS[id].name}`).join(' + ');
  h += `<p class="v-status">${statusIcon(v.status)}${esc(t('verdict.' + v.status))}</p>`;
  h += `<dl class="v-dl"><dt>${esc(t('verdict.devices'))}</dt><dd>${esc(kitText)}</dd></dl>`;
  const line = v.status === 'short' ? 'verdict.shortLine' : 'verdict.okLine';
  h += `<p class="small">${esc(t(line, { band: bandLabel(v.mb), pct: pct(v.house[v.mb].good) }))}</p>`;
  if (v.status === 'short' && partialText(v.mb)) h += `<p class="small">${esc(partialText(v.mb))}</p>`;
  if (v.weak.length) {
    const w = v.weak[0];
    h += `<p class="small">${esc(t('verdict.cableLine', { node: nodeName(w.child) }))}</p><div class="btnrow">${wireBtn(w.child, 'primary')}</div>`;
  }
  if (v.status === 'short' && !suggestion) h += `<div class="btnrow"><button type="button" data-sug="run"${v.weak.length ? '' : ' class="primary"'}>${esc(t('panel.suggestRun'))}</button></div>`;
  const six = v.house['6'];
  const sixShare = bandShare('6');
  h += `<p class="small muted">${esc(!six.hasBand ? t('verdict.sixNone') : six.good >= 0.9 ? t('verdict.sixGood')
    : sixShare ? t('verdict.sixPartial', { pct: pct(six.good), n: sixShare.n, total: sixShare.total }) : t('verdict.sixNear', { pct: pct(six.good) }))}</p>`;
  h += `<div class="v-bands"><span class="small muted">${esc(t('verdict.byBand'))}</span><div class="bands3">${E.BAND_KEYS.map(bk => {
    const s = v.house[bk];
    return `<button type="button" data-band="${bk}" aria-pressed="${bk === P.band}" aria-label="${esc(t('verdict.showBand', { band: bandLabel(bk) }))}: ${s.hasBand ? pct(s.good) : '—'}"><span class="v">${s.hasBand ? pct(s.good) : '—'}</span><span class="l">${bandLabel(bk)}</span></button>`;
  }).join('')}</div></div>`;
  h += `<p class="hint">${esc(t('verdict.note'))}</p>`;
  $('#pVerdict').innerHTML = h;
}
$('#invite').addEventListener('click', e => {
  const act = e.target.closest('[data-invite]')?.dataset.invite;
  if (act === 'draw') { inviteOff = true; $('#invite').hidden = true; setTool('wall'); cv.focus({ preventScroll: true }); }
  else if (act === 'photo') $('#bgFile').click();
});
$('#pCoverage').addEventListener('click', e => { const b = e.target.closest('[data-band]'); if (b) setBand(b.dataset.band); });
$('#pVerdict').addEventListener('click', e => {
  const b = e.target.closest('[data-band]'); if (b) { setBand(b.dataset.band); return; }
  if (e.target.closest('[data-pick=node]')) { setTool('node'); if (sheetMode.matches) setDrawer(false); }
});

const wireBtn = (gi, cls) => `<button type="button" class="${cls}" data-wire="${gi}">${esc(t('panel.wireIt', { node: nodeName(gi) }))}</button>`;
let lastStatus = '', inviteOff = false;
function renderPanel() {
  const st = stats(P.floor, P.band), bl = bandLabel(P.band), f = cur(), all = nodesAll();
  const v = verdict();
  renderVerdict(v);
  const status = v ? v.status : 'empty';
  if (lastStatus && status !== lastStatus && v) live(t('verdict.' + v.status));
  lastStatus = status;
  $('#drawerSum').innerHTML = summaryChip(v);
  $('#hud').innerHTML = `<span class="hud-sum">${summaryChip(v)}</span>${icon('chev')}<span class="sr">${esc(t('hud.open'))}</span>`;

  let h = `<h2>${esc(t('panel.coverage', { band: bl }))}${P.floors.length > 1 ? ' · ' + esc(f.name) : ''}</h2>`;
  if (!all.length) h += `<p class="small muted">${t('panel.needNode')}</p>`;
  else if (!st.hasBand) {
    // A band no device has: say how to get it, and offer the map on a band the devices do have.
    const alt = ['5', '2.4', '6'].find(bk => bk !== P.band && hasBandDevice(bk));
    h += `<p class="small muted">${esc(t('panel.noBand', { band: bl }))}</p>`
      + (alt ? `<div class="btnrow"><button type="button" data-band="${alt}">${esc(t('verdict.showBand', { band: bandLabel(alt) }))}</button></div>` : '');
  }
  else {
    h += `<div><div class="big">${pct(st.good)}<small>${esc(t('panel.goodShare'))}</small></div><p class="small muted">${esc(t('panel.area', { area: fmt(st.area, 0) }))}</p></div>`;
    if (partialText(P.band)) h += `<p class="small">${esc(partialText(P.band))}</p>`;
    h += `<div class="bar" aria-hidden="true">${st.counts.map((c, i) => (c ? `<span style="width:${c / st.n * 100}%;background:var(--q${i})"></span>` : '')).join('')}</div>`;
    h += `<div class="rows">${[0, 1, 2, 3, 4].map(i => `<div class="r"><i class="sw" style="background:var(--q${i})"></i><span>${esc(cat(i).name)} <em>${esc(cat(i).use)}</em></span><span class="n">${pct(st.n ? st.counts[i] / st.n : 0)}</span></div>`).join('')}</div>`;
  }
  $('#pCoverage').innerHTML = h;

  const topo = E.topology(P, MODELS);
  let lh = `<h2>${esc(t('panel.linksTitle'))}</h2>`;
  if (all.length < 2) lh += `<p class="small muted">${esc(t('panel.linksEmpty'))}</p>`;
  else {
    lh += topo.map(l => `<div class="link"><span>${esc(nodeName(l.child))} → ${esc(nodeName(l.parent))}${all[l.child].fi !== all[l.parent].fi ? ` <span class="muted">${esc(t('panel.otherFloor'))}</span>` : ''}</span>`
      + linkPill(l)
      + (l.wired ? '' : `<span class="small muted full">${esc(t('panel.linkQuality', { q: t('panel.linkWords.' + E.linkCat(l.v)) }))}</span>`)
      + (!l.wired && E.linkCat(l.v) === 4 ? wireBtn(l.child, 'full') : '') + '</div>').join('');
    lh += `<p class="small muted">${esc(t('panel.linksHint'))}</p>`;
  }
  $('#pLinks').innerHTML = lh;

  let sh = `<h2>${esc(t('panel.suggestTitle'))}</h2>`;
  if (suggestion && suggestion.none) sh += `<p class="small">${esc(noneText(suggestion))}</p>${suggestion.none === 'weakLink' ? `<div class="btnrow">${wireBtn(suggestion.child, 'primary')}<button type="button" data-sug="clear" class="ghost">${esc(t('panel.ok'))}</button></div>` : `<button type="button" data-sug="clear" class="ghost">${esc(t('panel.ok'))}</button>`}`;
  else if (suggestion) sh += `<p class="small">${sugText()}</p>` + sugButtons();
  else sh += `<p class="small muted">${esc(t('panel.suggestIntro', { band: bl }))}</p><button type="button" data-sug="run">${esc(t('panel.suggestRun'))}</button>`;
  $('#pSuggest').innerHTML = sh;

  renderBands();
  renderPop();
  $('#undoBtn').disabled = !hist.length; $('#redoBtn').disabled = !fut.length;
  $('#exampleBar').hidden = !P.example || !!P.exampleEdited;
  $('#invite').hidden = inviteOff || f.walls.length > 0 || f.labels.length > 0 || f.nodes.length > 0 || !!f.bg;
  $('#areaW').value = P.w; $('#areaH').value = P.h;
  $('#heatOn').checked = P.heat; $('#alpha').value = Math.round(P.alpha * 100);
  $('#bgCtl').hidden = !f.bg;
  if (f.bg) $('#bgAlpha').value = Math.round(f.bg.alpha * 100);
  $('#delFloor').hidden = P.floors.length < 2;
  $('#delFloor').textContent = t('floors.remove', { name: f.name });
}
const linkPill = l => (l.wired ? `<span class="pill pill-wire">${esc(t('panel.cable'))}</span>`
  : `<span class="pill"><i class="dot" style="background:var(--${linkColor(l.v)})"></i>${dbm(l.v)} dBm · ${bandLabel(l.band)}</span>`);
const noneText = s => t('panel.none.' + s.none, s.child != null ? { child: nodeName(s.child), parent: nodeName(s.parent) } : undefined);
function sugText() {
  const s = suggestion;
  let extra = s.relaxed ? esc(t('panel.suggestRelaxed')) : s.link != null ? esc(t('panel.suggestLink', { v: dbm(s.link) })) : '';
  // The search swaps in another model when the chosen one lacks the band; say so.
  if (s.model !== model && MODELS[model]) extra += esc(t('panel.suggestOtherModel', { chosen: MODELS[model].name, band: bandLabel(P.band), model: MODELS[s.model].name }));
  return t('panel.suggestResult', { model: esc(MODELS[s.model].name), x: fmt(s.x, 1), y: fmt(s.y, 1), band: bandLabel(P.band), from: pct(s.from), to: pct(s.to) }) + extra;
}
const sugButtons = () => `<div class="btnrow"><button type="button" data-sug="add" class="primary">${esc(t('panel.addHere'))}</button><button type="button" data-sug="clear" class="ghost">${esc(t('panel.discard'))}</button></div>`;

function setWired(gi, on) {
  const a = nodesAll()[gi]; if (!a || a.n.main) return;
  pushHist(); a.n.wired = on;
  if (on) track('wire_node');
  dirty(); live(t(on ? 'live.wired' : 'live.unwired', { node: nodeName(gi) }));
}
function runSuggest(btn) {
  if (btn) { btn.textContent = t('panel.computing'); btn.disabled = true; }
  setTimeout(() => {
    suggestion = nodesAll().length ? E.suggest(P, MODELS, P.floor, P.band, model) : { none: 'noRouter' };
    if (!suggestion.none) { sel = { type: 'sug' }; if (sheetMode.matches) setDrawer(false); }
    renderPanel(); schedule();
  }, 20);
  track('suggest_node', { band: P.band });
}
// Actions shared by the drawer cards and the popover on the plan.
ws.addEventListener('click', e => {
  const wire = e.target.closest('[data-wire]'), unwire = e.target.closest('[data-unwire]'), sug = e.target.closest('[data-sug]');
  if (wire) { setWired(+wire.dataset.wire, true); return; }
  if (unwire) { setWired(+unwire.dataset.unwire, false); return; }
  if (!sug) return;
  const act = sug.dataset.sug;
  if (act === 'run') runSuggest(sug);
  else if (act === 'add' && suggestion) {
    pushHist();
    const fl = P.floors[suggestion.fi] || cur();
    fl.nodes.push({ x: suggestion.x, y: suggestion.y, model: suggestion.model, main: !nodesAll().length, wired: !!suggestion.relaxed });
    sel = { type: 'node', i: fl.nodes.length - 1 };
    dirty(); live(t('live.node', { node: nodeName(nodesAll().length - 1) }));
  } else if (act === 'clear') { suggestion = null; if (sel && sel.type === 'sug') sel = null; renderPanel(); schedule(); }
});

/* ---------- popover next to the selected object ---------- */
const pop = $('#pop');
function popHead(title) {
  return `<div class="pop-head"><h2 id="popTitle">${esc(title)}</h2><button type="button" class="pop-x" data-selact="close" aria-label="${esc(t('sel.close'))}">${icon('x')}</button></div>`;
}
function renderPop() {
  const f = cur(), focused = document.activeElement && pop.contains(document.activeElement) ? document.activeElement.id : null;
  let h = '';
  if (sel && (sel.type === 'wall' || sel.type === 'node' || sel.type === 'label')) {
    const item = (sel.type === 'wall' ? f.walls : sel.type === 'node' ? f.nodes : f.labels)[sel.i];
    if (!item) sel = null;
    else if (sel.type === 'wall') {
      h = popHead(t('sel.wall'))
        + `<label class="field-label" for="selLen">${esc(t('sel.length'))}</label>
        <input type="text" inputmode="decimal" id="selLen" value="${fmt(Math.hypot(item.x2 - item.x1, item.y2 - item.y1), 2)}">
        <p class="hint">${esc(t('sel.lengthHint'))}</p>
        <label class="field-label" for="selMat">${esc(t('sel.material'))}</label>
        <select id="selMat">${Object.entries(MATERIALS).map(([key, m]) => `<option value="${key}"${key === item.m ? ' selected' : ''}>${esc(matText(key, m.db[BANDS[P.band].i]))}</option>`).join('')}</select>
        <div class="btnrow"><button type="button" class="ghost danger" data-selact="del">${esc(t('sel.delWall'))}</button></div>`;
    } else if (sel.type === 'node') {
      const gi = nodesAll().findIndex(a => a.n === item);
      h = popHead(nodeName(gi))
        + `<label class="field-label" for="selModel">${esc(t('sel.model'))}</label><select id="selModel">${modelOptions(item.model)}</select>
        ${item.main ? `<p class="small muted">${esc(t('sel.mainNote'))}</p>` : `<label class="check"><input type="checkbox" id="selWired"${item.wired ? ' checked' : ''}> ${esc(t('sel.wired'))}</label>`}
        <div class="btnrow">${item.main ? '' : `<button type="button" data-selact="main">${esc(t('sel.makeMain'))}</button>`}<button type="button" class="ghost danger" data-selact="del">${esc(t('sel.delNode'))}</button></div>`;
    } else {
      h = popHead(t('sel.room'))
        + `<label class="sr" for="selText">${esc(t('sel.text'))}</label><input type="text" id="selText" value="${esc(item.t)}" maxlength="40">
        <div class="btnrow"><button type="button" class="ghost danger" data-selact="del">${esc(t('sel.delRoom'))}</button></div>`;
    }
  } else if (sel && sel.type === 'link') {
    const l = E.topology(P, MODELS).find(x => x.child === sel.child);
    if (!l) sel = null;
    else {
      h = popHead(nodeName(l.child) + ' → ' + nodeName(l.parent))
        + `<p class="pop-row">${linkPill(l)}</p>`
        + (l.wired ? `<div class="btnrow"><button type="button" data-unwire="${l.child}">${esc(t('sel.unwire'))}</button></div>`
          : `<p class="small muted">${esc(t('panel.linkQuality', { q: t('panel.linkWords.' + E.linkCat(l.v)) }))} ${esc(t('panel.linksHint'))}</p><div class="btnrow">${wireBtn(l.child, E.linkCat(l.v) === 4 ? 'primary' : '')}</div>`);
    }
  } else if (sel && sel.type === 'measure' && measure) {
    h = popHead(t('sel.measureTitle'))
      + `<p class="pop-row"><b class="mono">${esc(t('sel.measured', { len: fmt(Math.hypot(measure.x2 - measure.x1, measure.y2 - measure.y1), 2) }))}</b></p>`
      + (f.bg ? `<label class="field-label" for="calLen">${esc(t('sel.realLength'))}</label><div class="btnrow"><input type="number" id="calLen" min="0.1" step="0.05"><button type="button" id="calApply" class="primary">${esc(t('sel.apply'))}</button></div>`
        : `<p class="small muted">${esc(t('sel.measureNoImage'))}</p>`);
  } else if (sel && sel.type === 'sug' && suggestion && !suggestion.none) {
    h = popHead(t('panel.suggestTitle')) + `<p class="small">${sugText()}</p>` + sugButtons();
  } else if (sel && sel.type !== 'wall' && sel.type !== 'node' && sel.type !== 'label') sel = null;
  pop.hidden = !h;
  if (h) {
    pop.innerHTML = h;
    if (focused) document.getElementById(focused)?.focus();
  }
  placePop();
}
// Screen rectangle of the selected object (the whole segment for walls, links and measurements),
// which the popover must not cover.
function popAnchor() {
  if (!sel) return null;
  const f = cur(), all = nodesAll(), sx = x => ox + x * k, sy = y => oy + y * k;
  const point = (x, y, r) => ({ x0: sx(x) - r, y0: sy(y) - r, x1: sx(x) + r, y1: sy(y) + r });
  const seg = (ax, ay, bx, by, pad) => ({ x0: Math.min(sx(ax), sx(bx)) - pad, y0: Math.min(sy(ay), sy(by)) - pad, x1: Math.max(sx(ax), sx(bx)) + pad, y1: Math.max(sy(ay), sy(by)) + pad });
  if (sel.type === 'node' && f.nodes[sel.i]) return point(f.nodes[sel.i].x, f.nodes[sel.i].y, nodeR() + 4);
  if (sel.type === 'label' && f.labels[sel.i]) return point(f.labels[sel.i].x, f.labels[sel.i].y, 24);
  if (sel.type === 'wall' && f.walls[sel.i]) { const w = f.walls[sel.i]; return seg(w.x1, w.y1, w.x2, w.y2, 10); }
  if (sel.type === 'link') {
    const l = E.topology(P, MODELS).find(x => x.child === sel.child); if (!l) return null;
    const a = all[l.child].n, b = all[l.parent].n; return seg(a.x, a.y, b.x, b.y, 14);
  }
  if (sel.type === 'measure' && measure) return seg(measure.x1, measure.y1, measure.x2, measure.y2, 14);
  if (sel.type === 'sug' && suggestion) return point(suggestion.x, suggestion.y, nodeR() + 8);
  return null;
}
function placePop() {
  if (pop.hidden) return;
  if (compact.matches) {
    pop.style.left = pop.style.top = '';
    // The popover docks above the rail; scroll the plan so the object stays visible above it.
    const a = popAnchor(), m = area.getBoundingClientRect(), limit = pop.getBoundingClientRect().top - m.top - 12;
    if (a && a.y1 > limit) { oy -= a.y1 - limit; fitted = false; clampView(); schedule(); }
    return;
  }
  const a = popAnchor(); if (!a) return;
  const mw = area.clientWidth, mh = area.clientHeight, pw = pop.offsetWidth, ph = pop.offsetHeight, g = 12, m = 10;
  const top = Math.min(el('stageBar').getBoundingClientRect().bottom - area.getBoundingClientRect().top + 8, mh - ph - m); // below the top strip
  const cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2;
  const sides = {
    right: [a.x1 + g, cy - ph / 2], left: [a.x0 - g - pw, cy - ph / 2],
    above: [cx - pw / 2, a.y0 - g - ph], below: [cx - pw / 2, a.y1 + g],
  };
  // Lines prefer above/below, points prefer beside; the first side that fits without covering the
  // object wins, otherwise the one that covers the least of it.
  const order = ['wall', 'link', 'measure'].includes(sel.type) ? ['above', 'below', 'right', 'left'] : ['right', 'left', 'above', 'below'];
  let best = null;
  for (const side of order) {
    const [x0, y0] = sides[side];
    const x = clamp(x0, m, mw - pw - m), y = clamp(y0, top, mh - ph - m);
    const overlap = Math.max(0, Math.min(x + pw, a.x1) - Math.max(x, a.x0)) * Math.max(0, Math.min(y + ph, a.y1) - Math.max(y, a.y0));
    if (!best || overlap < best.overlap) best = { x, y, overlap };
    if (!overlap) break;
  }
  pop.style.left = best.x + 'px';
  pop.style.top = best.y + 'px';
}
pop.addEventListener('change', e => {
  const f = cur(), id = e.target.id;
  if (!sel || id === 'calLen') return;
  pushHist();
  if (id === 'selMat') f.walls[sel.i].m = e.target.value;
  else if (id === 'selLen') {
    // Keeps the first end and the direction; the far end moves, clamped to the plan.
    const w = f.walls[sel.i], len = clamp(parseNum(e.target.value) || 0, 0.2, 113), L = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
    w.x2 = clamp(w.x1 + (w.x2 - w.x1) / L * len, 0, P.w); w.y2 = clamp(w.y1 + (w.y2 - w.y1) / L * len, 0, P.h);
  }
  else if (id === 'selModel') f.nodes[sel.i].model = e.target.value;
  else if (id === 'selWired') { const gi = nodesAll().findIndex(a => a.n === f.nodes[sel.i]); hist.pop(); setWired(gi, e.target.checked); return; }
  else if (id === 'selText') { const text = e.target.value.trim(); if (!text) { hist.pop(); return; } f.labels[sel.i].t = text; }
  dirty();
});
pop.addEventListener('click', e => {
  if (e.target.closest('#calApply')) { applyCalibration(); return; }
  const act = e.target.closest('[data-selact]')?.dataset.selact;
  if (!act || !sel) return;
  if (act === 'close') { if (sel.type === 'measure') measure = null; sel = null; renderPop(); schedule(); cv.focus({ preventScroll: true }); return; }
  pushHist();
  if (act === 'del') { removeHit(sel); sel = null; live(t('live.deleted')); }
  else if (act === 'main') { nodesAll().forEach(a => { a.n.main = false; }); const n = cur().nodes[sel.i]; n.main = true; n.wired = false; }
  dirty();
});
pop.addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.stopPropagation(); if (sel && sel.type === 'measure') measure = null; sel = null; renderPop(); schedule(); cv.focus({ preventScroll: true }); }
  if (e.key === 'Enter' && e.target.id === 'calLen') { e.preventDefault(); applyCalibration(); }
});

/* ---------- plan, area and background image ---------- */
$('#areaW').addEventListener('change', e => { pushHist(); P.w = clamp(+e.target.value || 16, 4, 80); fitted = true; dirty(); resize(); });
$('#areaH').addEventListener('change', e => { pushHist(); P.h = clamp(+e.target.value || 12, 4, 80); fitted = true; dirty(); resize(); });
function loadBackground(file) {
  if (!file || !/^image\//.test(file.type)) { if (file) toast(t('toast.imageError')); return; }
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'), sc = Math.min(1, 1400 / Math.max(im.width, im.height));
      c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      pushHist();
      cur().bg = { src: c.toDataURL('image/jpeg', 0.78), mpp: P.w / c.width, alpha: 0.5 };
      P.h = Math.max(P.h, Math.ceil(c.height * P.w / c.width));
      fitted = true; dirty(); resize();
      toast(t('toast.imageLoaded'));
    };
    im.onerror = () => toast(t('toast.imageError'));
    im.src = rd.result;
  };
  rd.readAsDataURL(file);
}
$('#bgFile').addEventListener('change', e => { loadBackground(e.target.files[0]); e.target.value = ''; });
// A floor-plan image dropped on the map becomes the background of the floor on screen.
area.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); area.classList.add('dropping'); } });
area.addEventListener('dragleave', e => { if (!area.contains(e.relatedTarget)) area.classList.remove('dropping'); });
area.addEventListener('drop', e => { e.preventDefault(); area.classList.remove('dropping'); loadBackground(e.dataTransfer.files[0]); });
$('#bgAlpha').addEventListener('input', e => { if (cur().bg) { cur().bg.alpha = e.target.value / 100; persist(); schedule(); } });
$('#bgRemove').addEventListener('click', () => { pushHist(); cur().bg = null; dirty(); });
function applyCalibration() {
  const real = +($('#calLen')?.value), f = cur();
  if (!measure || !f.bg || !(real > 0)) return;
  const L = Math.hypot(measure.x2 - measure.x1, measure.y2 - measure.y1); if (L < 0.05) return;
  pushHist(); f.bg.mpp *= real / L; measure = null; sel = null;
  const im = imgFor(f.bg.src);
  if (im.naturalWidth) { P.w = clamp(Math.max(P.w, Math.ceil(im.naturalWidth * f.bg.mpp)), 4, 80); P.h = clamp(Math.max(P.h, Math.ceil(im.naturalHeight * f.bg.mpp)), 4, 80); }
  fitted = true; dirty(); resize();
}
$('#delFloor').addEventListener('click', async () => {
  const f = cur();
  if (!await ask({ title: t('floors.removeTitle', { name: f.name }), message: t('floors.removeMsg'), ok: t('floors.removeOk'), danger: true })) return;
  pushHist(); P.floors.splice(P.floor, 1); P.floor = Math.max(0, P.floor - 1);
  if (!nodesAll().some(a => a.n.main) && nodesAll()[0]) nodesAll()[0].n.main = true;
  sel = null; dirty(); afterFloor();
});

/* ---------- projects ---------- */
function renderProjects() {
  const list = St.listProjects();
  if (!list.some(x => x.id === P.id)) list.unshift({ id: P.id, name: P.name });
  $('#projectSel').innerHTML = list.map(x => `<option value="${esc(x.id)}"${x.id === P.id ? ' selected' : ''}>${esc(x.id === P.id ? P.name : x.name)}</option>`).join('');
}
$('#projectSel').addEventListener('change', e => {
  const data = St.loadProject(e.target.value);
  if (!data) { toast(t('toast.notFound')); renderProjects(); return; }
  persistNow(); openProject(data);
});
$('#newProject').addEventListener('click', async () => {
  const name = await ask({ title: t('project.newTitle'), input: { label: t('project.nameLabel'), value: t('project.defaultName') }, ok: t('project.create') });
  if (!name) return;
  persistNow(); openProject(St.blankProject(name, NAMES.ground)); setTool('wall');
  track('project_create');
});
$('#projMenu').addEventListener('click', async e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) return;
  $('#projMenu').open = false;
  if (act === 'new') $('#newProject').click();
  else if (act === 'plan') $('#planDlg').showModal();
  else if (act === 'example') openExample();
  else if (act === 'rename') {
    const name = await ask({ title: t('project.renameTitle'), input: { label: t('project.nameLabel'), value: P.name }, ok: t('project.save') });
    if (name) { P.name = name; persistNow(); }
  } else if (act === 'duplicate') {
    const copy = JSON.parse(JSON.stringify(P));
    copy.id = St.uid(); copy.name = (P.name + ' ' + t('project.copySuffix')).slice(0, 60); copy.created = Date.now(); delete copy.example;
    persistNow(); openProject(copy); toast(t('toast.duplicated'));
  } else if (act === 'export') {
    exportFile();
  } else if (act === 'import') {
    $('#importFile').click();
  } else if (act === 'delete') {
    if (!await ask({ title: t('project.deleteTitle', { name: P.name }), message: t('project.deleteMsg'), ok: t('project.deleteOk'), danger: true })) return;
    St.deleteProject(P.id);
    const rest = St.listProjects();
    openProject(rest.length ? St.loadProject(rest[0].id) : St.blankProject(t('project.defaultName'), NAMES.ground));
    toast(t('toast.deleted'));
  }
});
document.addEventListener('click', e => {
  const m = $('#projMenu'); if (m.open && !m.contains(e.target)) m.open = false;
});

// Reopens an untouched example house if there is one; otherwise adds a fresh copy with a free name.
function openExample() {
  persistNow();
  const list = St.listProjects();
  const kept = list.map(x => St.loadProject(x.id)).find(p => p && p.example && !p.exampleEdited);
  if (kept) { openProject(kept); setTool('select'); return; }
  const base = t('project.exampleName'), names = new Set(list.map(x => x.name));
  let name = base;
  for (let n = 2; names.has(name); n++) name = `${base} (${n})`;
  openProject(St.exampleProject({ name, ground: NAMES.ground, rooms: raw('project.exampleRooms') }));
  setTool('select');
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || t('project.fileSlug');
}
function exportFile() {
  const data = { app: 'planejador-wifi', version: St.FORMAT_VERSION, exported: new Date().toISOString(), project: St.withModels(P, MODELS) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = `planejador-wifi-${slug(P.name)}.json`;
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  track('project_export');
}
$('#importFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
  e.target.value = '';
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const obj = JSON.parse(rd.result);
      const data = obj && obj.project ? obj.project : obj;
      if (!data || !Array.isArray(data.floors)) throw new Error('format');
      data.id = St.uid();
      delete data.example;
      data.name = data.name || file.name.replace(/\.json$/i, '');
      if (St.listProjects().some(x => x.name === data.name)) data.name = (data.name + ' ' + t('project.importedSuffix')).slice(0, 60);
      persistNow(); openProject(data); toast(t('toast.imported', { name: P.name }));
      track('project_import');
    } catch {
      toast(t('toast.importError'));
    }
  };
  rd.readAsText(file);
});

$('#startBlank').addEventListener('click', () => { persistNow(); openProject(St.blankProject(t('project.defaultName'), NAMES.ground)); setTool('wall'); });

/* ---------- router models dialog ---------- */
let editingId = null;
const bandNames = m => m.bands.map(bandLabel).join(' + ');
function renderModelList() {
  const row = m => `<li><span class="ml-name"><b>${esc(m.name)}</b><span class="muted small">${bandNames(m)}${m.adj ? ` · ${m.adj > 0 ? '+' : '−'}${Math.abs(m.adj)} dB` : ''}</span></span>`
    + (m.custom ? `<span class="btnrow"><button type="button" data-medit="${esc(m.id)}">${esc(t('models.edit'))}</button><button type="button" data-mdel="${esc(m.id)}">${esc(t('models.del'))}</button></span>` : `<span class="tag">${esc(t('models.tagReady'))}</span>`) + '</li>';
  $('#modelList').innerHTML = [...custom.map(m => ({ ...m, custom: true })), ...E.BUILTIN_MODELS.map(m => MODELS[m.id])].map(row).join('');
}
function resetModelForm() {
  editingId = null;
  $('#mName').value = ''; $('#mAdj').value = 0; $('#mErr').textContent = '';
  document.querySelectorAll('#mBands input').forEach(c => { c.checked = c.value !== '6'; });
  $('#mFormTitle').textContent = t('models.newTitle'); $('#mSave').textContent = t('models.add'); $('#mCancel').hidden = true;
}
function openModels() { renderModelList(); resetModelForm(); $('#modelsDlg').showModal(); }
function saveModel() {
  const name = $('#mName').value.trim();
  const bands = [...document.querySelectorAll('#mBands input:checked')].map(c => c.value);
  if (!name) { $('#mErr').textContent = t('models.errName'); $('#mName').focus(); return; }
  if (!bands.length) { $('#mErr').textContent = t('models.errBands'); return; }
  const m = St.normalizeModel({ id: editingId || 'c_' + St.uid(), name, bands, adj: $('#mAdj').value });
  if (editingId) custom = custom.map(x => (x.id === editingId ? m : x)); else custom.push(m);
  St.saveCustomModels(custom); rebuildModels(); fillModelSel();
  toast(editingId ? t('models.updated') : t('models.added', { name: m.name }));
  if (!editingId) { model = m.id; track('model_create', { bands: m.bands.join('+') }); }
  fillModelSel(); renderModelList(); resetModelForm(); dirty();
}
$('#mSave').addEventListener('click', saveModel);
$('#mCancel').addEventListener('click', resetModelForm);
$('#mName').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveModel(); } });
$('#modelList').addEventListener('click', e => {
  const ed = e.target.closest('[data-medit]')?.dataset.medit, del = e.target.closest('[data-mdel]')?.dataset.mdel;
  if (ed) {
    const m = custom.find(x => x.id === ed); if (!m) return;
    editingId = ed; $('#mName').value = m.name; $('#mAdj').value = m.adj; $('#mErr').textContent = '';
    document.querySelectorAll('#mBands input').forEach(c => { c.checked = m.bands.includes(c.value); });
    $('#mFormTitle').textContent = t('models.editTitle'); $('#mSave').textContent = t('models.save'); $('#mCancel').hidden = false;
    $('#mName').focus();
  } else if (del) {
    if (nodesAll().some(a => a.n.model === del)) { $('#mErr').textContent = t('models.errInUse'); return; }
    custom = custom.filter(x => x.id !== del);
    St.saveCustomModels(custom); rebuildModels(); fillModelSel(); renderModelList();
    if (editingId === del) resetModelForm();
  }
});

/* ---------- text summary ---------- */
function summary() {
  const L = [], all = nodesAll(), S = k => t('summary.' + k);
  L.push(`Planejador WiFi: ${P.name}`);
  L.push(t('summary.area', { w: fmt(P.w, 1), h: fmt(P.h, 1), floors: P.floors.length }));
  P.floors.forEach((f, fi) => {
    L.push(`\n[${f.name}]`);
    const per = {};
    f.walls.forEach(w => { per[w.m] = (per[w.m] || 0) + Math.hypot(w.x2 - w.x1, w.y2 - w.y1); });
    L.push(S('walls') + ': ' + (Object.keys(per).length ? Object.entries(per).map(([m, v]) => `${matLabel(m)} ${fmt(v, 1)} m`).join('; ') : S('none')));
    if (f.labels.length) L.push(S('rooms') + ': ' + f.labels.map(l => `${l.t} (${fmt(l.x, 1)}; ${fmt(l.y, 1)})`).join(', '));
    const ns = all.map((a, gi) => ({ a, gi })).filter(o => o.a.fi === fi);
    L.push(S('devices') + ': ' + (ns.length ? ns.map(({ a, gi }) => `${nodeName(gi)} = ${MODELS[a.n.model].name}${a.n.wired ? ` (${S('cable')})` : ''} ${S('at')} (${fmt(a.n.x, 1)}; ${fmt(a.n.y, 1)})`).join(', ') : S('noDevices')));
    L.push(S('coverage') + ': ' + E.BAND_KEYS.map(bk => { const st = stats(fi, bk); return `${bandLabel(bk)} ${st.hasBand ? pct(st.good) : S('noDeviceBand')}`; }).join(' · '));
  });
  const topo = E.topology(P, MODELS);
  if (topo.length) L.push(`\n${S('backhaul')}: ` + topo.map(l => `${nodeName(l.child)} → ${nodeName(l.parent)}: ${l.wired ? S('cable') : `${dbm(l.v)} dBm ${S('on')} ${bandLabel(l.band)}`}`).join('; '));
  L.push('\n' + S('model'));
  return L.join('\n');
}
$('#copySummary').addEventListener('click', async () => {
  const text = summary(), fb = $('#copyFallback');
  track('copy_summary');
  try { await navigator.clipboard.writeText(text); fb.hidden = true; toast(t('toast.copied')); }
  catch { fb.hidden = false; fb.value = text; fb.focus(); fb.select(); toast(t('toast.copyFail')); }
});

/* ---------- dialogs and toast ---------- */
function ask({ title, message = '', input = null, ok = 'OK', danger = false }) {
  const dlg = $('#dlg'), inp = $('#dlgInput');
  $('#dlgTitle').textContent = title;
  $('#dlgMsg').textContent = message; $('#dlgMsg').hidden = !message;
  $('#dlgField').hidden = !input;
  if (input) { $('#dlgLabel').textContent = input.label; inp.value = input.value || ''; }
  $('#dlgOk').textContent = ok; $('#dlgOk').classList.toggle('danger', danger);
  dlg.returnValue = '';
  dlg.showModal();
  if (input) setTimeout(() => { inp.focus(); inp.select(); }, 0);
  return new Promise(res => {
    dlg.addEventListener('close', () => {
      if (dlg.returnValue !== 'ok') return res(null);
      res(input ? (inp.value.trim().slice(0, 60) || null) : true);
    }, { once: true });
  });
}
let toastTimer = 0;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
}

/* ---------- boot ---------- */
function afterFloor() { suggestion = null; renderFloors(); renderPanel(); resize(); }
function renderAll() { renderProjects(); bandsSig = ''; renderBands(); fillMatSel(); fillModelSel(); afterFloor(); }

St.migrateLegacy();
setDrawer(sheetMode.matches ? false : drawerPref());
{
  const list = St.listProjects();
  const saved = (St.currentId() && St.loadProject(St.currentId())) || (list[0] && St.loadProject(list[0].id));
  openProject(saved || St.exampleProject({ name: t('project.exampleName'), ground: NAMES.ground, rooms: raw('project.exampleRooms') }));
}
new ResizeObserver(resize).observe(area);
new ResizeObserver(() => { layoutVars(); }).observe(el('stageBar'));
window.addEventListener('resize', resize);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule);
compact.addEventListener('change', () => { readout(null); placePop(); });
if (document.fonts) document.fonts.ready.then(() => { layoutVars(); if (fitted) fitView(); schedule(); });
setTool(P.example ? 'select' : 'wall');
renderLegend();

$('#tourBtn')?.addEventListener('click', startTour);

// "Back to the planner" shows once less than half of the workspace is on screen.
new IntersectionObserver(([e]) => { $('#toTop').hidden = e.intersectionRatio >= 0.5; }, { threshold: [0, 0.5] }).observe(ws);
$('#toTop').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  $('#toTop').hidden = true;
  setTimeout(() => cv.focus({ preventScroll: true }), 400);
});
const isBot = /bot|crawl|spider|slurp|mediapartners|lighthouse|headless/i.test(navigator.userAgent);
if (!tourSeen() && !isBot) setTimeout(startTour, 700);
