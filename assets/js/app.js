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
// Usage events (project_create, suggest_node...). Nothing listens in the public build; a build
// extension may forward them to its own statistics tool.
const track = (name, params = {}) => window.dispatchEvent(new CustomEvent('planejador:track', { detail: { name, params } }));


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
let k = 40, dpr = 1, ver = 0;
let hist = [];
const cur = () => P.floors[P.floor];
const nodesAll = () => E.nodesAll(P);
const nodeName = gi => { const a = nodesAll()[gi]; return a && a.n.main ? t('node.main') : t('node.n', { n: gi + 1 }); };

function pushHist() { hist.push(JSON.stringify(P)); if (hist.length > 80) hist.shift(); }
function undo() {
  if (!hist.length) return;
  P = St.normalizeProject(JSON.parse(hist.pop()), new Set(Object.keys(MODELS)), NAMES);
  sel = null; ver++; persist(); renderAll();
}
function dirty() { ver++; suggestion = null; persist(); schedule(); renderPanel(); }

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
  hist = []; sel = null; measure = null; suggestion = null; ver++;
  persistNow(); renderAll();
}

/* ---------- drawing ---------- */
let C = {};
function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  ['sheet', 'ink', 'muted', 'line', 'grid', 'grid-strong', 'accent', 'on-accent', 'q0', 'q1', 'q2', 'q3', 'q4', ...Object.keys(MATERIALS).map(m => 'm-' + m)]
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

// On wide screens the whole plan fits in the viewport, so the map and its toolbar stay usable
// together while the side column scrolls. Phones use the full width instead.
const area = $('#canvasArea'), wide = matchMedia('(min-width: 1101px)');
const STAGE_CHROME = 230; // stage height outside the canvas: option bar, readout, legend, note
function resize() {
  const w = area.clientWidth; if (!w || !P) return;
  k = w / P.w;
  if (wide.matches) k = Math.min(k, Math.max(300, window.innerHeight - STAGE_CHROME) / P.h);
  dpr = window.devicePixelRatio || 1;
  const cw = Math.round(P.w * k), ch = Math.round(P.h * k);
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  draw();
}
let raf = 0;
function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); }

function line(w) { ctx.beginPath(); ctx.moveTo(w.x1 * k, w.y1 * k); ctx.lineTo(w.x2 * k, w.y2 * k); ctx.stroke(); }
function halo(t, x, y, color) {
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = C.sheet; ctx.lineJoin = 'round';
  ctx.strokeText(t, x, y); ctx.fillStyle = color; ctx.fillText(t, x, y); ctx.restore();
}

function draw() {
  if (!P) return;
  readTokens();
  const W = cv.width / dpr, H = cv.height / dpr, f = cur(), all = nodesAll();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = C.sheet; ctx.fillRect(0, 0, W, H);

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
  for (let x = 0; x <= P.w; x++) { ctx.strokeStyle = x % 5 === 0 ? C['grid-strong'] : C.grid; ctx.beginPath(); ctx.moveTo(Math.round(x * k) + 0.5, 0); ctx.lineTo(Math.round(x * k) + 0.5, H); ctx.stroke(); }
  for (let y = 0; y <= P.h; y++) { ctx.strokeStyle = y % 5 === 0 ? C['grid-strong'] : C.grid; ctx.beginPath(); ctx.moveTo(0, Math.round(y * k) + 0.5); ctx.lineTo(W, Math.round(y * k) + 0.5); ctx.stroke(); }
  ctx.fillStyle = C.muted; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top'; ctx.textAlign = 'start';
  for (let x = 2; x < P.w; x += 2) ctx.fillText(x + ' m', x * k + 3, 3);
  for (let y = 2; y < P.h; y += 2) ctx.fillText(y + ' m', 3, y * k + 3);

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
    ctx.lineWidth = Math.max(w.m === 'tijolo' || w.m === 'concreto' ? 4 : 2.5, MATERIALS[w.m].w * k);
    if (w.m === 'vidro') { ctx.setLineDash([6, 3]); line(w); ctx.setLineDash([]); } else line(w);
  });

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 13px "Barlow Semi Condensed", "Arial Narrow", sans-serif';
  f.labels.forEach((l, i) => halo(l.t, l.x * k, l.y * k, sel && sel.type === 'label' && sel.i === i ? C.accent : C.ink));

  E.topology(P, MODELS).forEach(l => {
    const a = all[l.child], b = all[l.parent];
    if (a.fi !== P.floor || b.fi !== P.floor) return;
    ctx.save(); ctx.lineWidth = 2;
    if (l.wired) { ctx.strokeStyle = C.ink; ctx.setLineDash([2, 4]); } else { ctx.strokeStyle = C['q' + E.linkCat(l.v)]; ctx.setLineDash([8, 5]); }
    ctx.beginPath(); ctx.moveTo(a.n.x * k, a.n.y * k); ctx.lineTo(b.n.x * k, b.n.y * k); ctx.stroke(); ctx.restore();
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    halo(l.wired ? t('node.cable') : dbm(l.v) + ' dBm', (a.n.x + b.n.x) / 2 * k, (a.n.y + b.n.y) / 2 * k, C.ink);
  });

  const r = Math.max(9, 0.28 * k);
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
    ctx.fillText(a.n.main ? 'P' : String(gi + 1), x, y + 1);
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
}

/* ---------- canvas interaction ---------- */
function pos(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k, px: e.clientX - r.left, py: e.clientY - r.top }; }
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
function hitTest(p) {
  const f = cur(), tol = Math.max(0.25, 9 / k);
  for (let i = f.nodes.length - 1; i >= 0; i--) if (Math.hypot(f.nodes[i].x - p.x, f.nodes[i].y - p.y) < Math.max(0.45, 14 / k)) return { type: 'node', i };
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

cv.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  const p = pos(e);
  hideLabelInput(true);
  try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  if (tool === 'wall' || tool === 'measure') {
    const s = snapPt(p.x, p.y);
    drag = { kind: tool, x1: s.x, y1: s.y, x2: s.x, y2: s.y };
    if (tool === 'measure') measure = null;
  } else if (tool === 'node') {
    pushHist();
    const s = snapPt(p.x, p.y);
    cur().nodes.push({ x: s.x, y: s.y, model, main: !nodesAll().length, wired: false });
    sel = { type: 'node', i: cur().nodes.length - 1 };
    dirty();
  } else if (tool === 'erase') {
    const h = hitTest(p);
    if (h) { pushHist(); removeHit(h); sel = null; dirty(); }
  } else if (tool === 'label') {
    openLabelInput(p);
  } else if (tool === 'select') {
    const h = hitTest(p);
    sel = h;
    if (h && (h.type === 'node' || h.type === 'label')) { pushHist(); drag = { kind: h.type, i: h.i, moved: false }; }
    renderPanel(); draw(); readout(p);
  }
});
cv.addEventListener('pointermove', e => {
  const p = pos(e);
  if (drag) {
    if (drag.kind === 'wall') { const s = wallEnd(drag.x1, drag.y1, p); drag.x2 = s.x; drag.y2 = s.y; }
    else if (drag.kind === 'measure') { const s = snapPt(p.x, p.y); drag.x2 = s.x; drag.y2 = s.y; }
    else {
      const o = drag.kind === 'node' ? cur().nodes[drag.i] : cur().labels[drag.i];
      const s = drag.kind === 'node' ? snapPt(p.x, p.y) : { x: clamp(p.x, 0, P.w), y: clamp(p.y, 0, P.h) };
      if (o && (o.x !== s.x || o.y !== s.y)) {
        o.x = s.x; o.y = s.y; drag.moved = true;
        if (drag.kind === 'node') { ver++; suggestion = null; }
      }
    }
    schedule();
  }
  readout(p);
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.kind === 'wall') {
    if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= 0.2) { pushHist(); cur().walls.push({ x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, m: mat }); dirty(); }
    else schedule();
  } else if (d.kind === 'measure') {
    measure = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) >= 0.1 ? { ...d, fi: P.floor } : null;
    showCalib(); schedule();
  } else if (!d.moved) hist.pop();
  else dirty();
}
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('pointerleave', () => { if (!drag) readout(null); });

function readout(p) {
  const el = $('#readout');
  if (!p) { el.textContent = t('readout.idle'); return; }
  const nodes = nodesAll();
  const where = `x ${fmt(p.x, 1)} · y ${fmt(p.y, 1)} m`;
  if (!nodes.length) { el.innerHTML = `${where} · <b>${esc(t('readout.noNodes'))}</b>`; return; }
  const b = E.bestAt(P, MODELS, p.x, p.y, P.floor, P.band, nodes);
  const others = E.BAND_KEYS.filter(bk => bk !== P.band)
    .map(bk => `${bandLabel(bk)} ${dbm(E.bestAt(P, MODELS, p.x, p.y, P.floor, bk, nodes).v)}`).join(' · ');
  el.innerHTML = b.v === -Infinity
    ? `${where} · <b>${esc(t('readout.noBand', { band: bandLabel(P.band) }))}</b> · ${others}`
    : `${where} · <b>${dbm(b.v)} dBm, ${esc(cat(E.catOf(b.v)).name.toLowerCase())}</b> ${esc(t('readout.via'))} ${esc(nodeName(b.who))} · ${others}`;
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

document.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select,dialog')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const map = { v: 'select', w: 'wall', n: 'node', t: 'label', m: 'measure', e: 'erase' };
  const t = map[e.key.toLowerCase()];
  if (t) { setTool(t); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); pushHist(); removeHit(sel); sel = null; dirty(); }
  if (e.key === 'Escape') { drag = null; sel = null; measure = null; showCalib(); renderPanel(); schedule(); }
});

/* ---------- tool rail ---------- */
function setTool(name) {
  tool = name;
  document.querySelectorAll('#toolset [data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === name)));
  $('#matGroup').hidden = name !== 'wall';
  $('#modelGroup').hidden = name !== 'node';
  $('#toolHint').textContent = t('hints.' + tool);
  cv.style.cursor = name === 'select' ? 'default' : name === 'erase' ? 'not-allowed' : 'crosshair';
}
document.querySelectorAll('#toolset [data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));

function fillMatSel() {
  const bi = BANDS[P.band].i;
  $('#matSel').innerHTML = Object.entries(MATERIALS)
    .map(([key, m]) => `<option value="${key}"${key === mat ? ' selected' : ''}>${esc(matLabel(key))} · −${m.db[bi]} dB</option>`).join('');
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
$('#manageModels').addEventListener('click', openModels);

function renderBands() {
  $('#bands').innerHTML = E.BAND_KEYS.map(bk => [bk, BANDS[bk]])
    .map(([bk]) => `<button type="button" role="radio" aria-checked="${bk === P.band}" data-band="${bk}">${bandLabel(bk)}</button>`).join('');
}
$('#bands').addEventListener('click', e => {
  const b = e.target.closest('[data-band]'); if (!b) return;
  P.band = b.dataset.band; suggestion = null; persist(); renderBands(); fillMatSel(); renderPanel(); schedule();
});

function renderFloors() {
  $('#floors').innerHTML = P.floors.map((f, i) => `<button type="button" role="tab" aria-selected="${i === P.floor}" data-floor="${i}">${esc(f.name)}</button>`).join('')
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

/* ---------- side panel ---------- */
function renderPanel() {
  const st = stats(P.floor, P.band), bl = bandLabel(P.band), f = cur(), all = nodesAll();
  let h = `<h2>${esc(t('panel.coverage', { band: bl }))}${P.floors.length > 1 ? ' · ' + esc(f.name) : ''}</h2>`;
  if (!all.length) h += `<p class="small muted">${t('panel.needNode')}</p>`;
  else if (!st.hasBand) h += `<p class="small muted">${esc(t('panel.noBand', { band: bl }))}</p>`;
  else {
    h += `<div><div class="big">${pct(st.good)}<small>${esc(t('panel.goodShare'))}</small></div><p class="small muted">${esc(t('panel.area', { area: fmt(st.area, 0) }))}</p></div>`;
    const weak = E.weakLinks(P, MODELS)[0];
    if (weak) h += `<p class="small warn">${esc(t('panel.weakNote', { node: nodeName(weak.child) }))}</p>`;
    h += `<div class="bar" aria-hidden="true">${st.counts.map((c, i) => (c ? `<span style="width:${c / st.n * 100}%;background:var(--q${i})"></span>` : '')).join('')}</div>`;
    h += `<div class="rows">${[0, 1, 2, 3, 4].map(i => `<div class="r"><i class="sw" style="background:var(--q${i})"></i><span>${esc(cat(i).name)} <em>${esc(cat(i).use)}</em></span><span class="n">${pct(st.n ? st.counts[i] / st.n : 0)}</span></div>`).join('')}</div>`;
  }
  h += `<div class="bands3">${E.BAND_KEYS.map(bk => { const s = stats(P.floor, bk); return `<div><div class="v">${s.hasBand ? pct(s.good) : '—'}</div><div class="l">${bandLabel(bk)}</div></div>`; }).join('')}</div>`;
  $('#pCoverage').innerHTML = h;

  const topo = E.topology(P, MODELS);
  let lh = `<h2>${esc(t('panel.linksTitle'))}</h2>`;
  if (all.length < 2) lh += `<p class="small muted">${esc(t('panel.linksEmpty'))}</p>`;
  else {
    lh += topo.map(l => `<div class="link"><span>${esc(nodeName(l.child))} → ${esc(nodeName(l.parent))}${all[l.child].fi !== all[l.parent].fi ? ` <span class="muted">${esc(t('panel.otherFloor'))}</span>` : ''}</span>`
      + (l.wired ? `<span class="pill pill-wire">${esc(t('panel.cable'))}</span>` : `<span class="pill"><i class="dot" style="background:var(--q${E.linkCat(l.v)})"></i>${dbm(l.v)} dBm · ${bandLabel(l.band)}</span>`)
      + (l.wired ? '' : `<span class="small muted full">${esc(t('panel.linkQuality', { q: t('panel.linkWords.' + E.linkCat(l.v)) }))}</span>`) + '</div>').join('');
    lh += `<p class="small muted">${esc(t('panel.linksHint'))}</p>`;
  }
  $('#pLinks').innerHTML = lh;

  let sh = `<h2>${esc(t('panel.suggestTitle'))}</h2>`;
  if (suggestion && suggestion.none) sh += `<p class="small">${esc(t('panel.none.' + suggestion.none, suggestion.child != null ? { child: nodeName(suggestion.child), parent: nodeName(suggestion.parent) } : undefined))}</p><button type="button" data-sug="clear" class="ghost">${esc(t('panel.ok'))}</button>`;
  else if (suggestion) {
    const extra = suggestion.relaxed ? esc(t('panel.suggestRelaxed'))
      : suggestion.link != null ? esc(t('panel.suggestLink', { v: dbm(suggestion.link) })) : '';
    sh += `<p class="small">${t('panel.suggestResult', { model: esc(MODELS[suggestion.model].name), x: fmt(suggestion.x, 1), y: fmt(suggestion.y, 1), band: bl, from: pct(suggestion.from), to: pct(suggestion.to) })}${extra}</p>`
      + `<div class="btnrow"><button type="button" data-sug="add" class="primary">${esc(t('panel.addHere'))}</button><button type="button" data-sug="clear" class="ghost">${esc(t('panel.discard'))}</button></div>`;
  } else {
    sh += `<p class="small muted">${esc(t('panel.suggestIntro', { band: bl }))}</p><button type="button" data-sug="run">${esc(t('panel.suggestRun'))}</button>`;
  }
  $('#pSuggest').innerHTML = sh;

  renderSel();
  $('#exampleBar').hidden = !P.example;
  $('#areaW').value = P.w; $('#areaH').value = P.h;
  $('#heatOn').checked = P.heat; $('#alpha').value = Math.round(P.alpha * 100);
  $('#bgCtl').hidden = !f.bg;
  if (f.bg) $('#bgAlpha').value = Math.round(f.bg.alpha * 100);
  $('#delFloor').hidden = P.floors.length < 2;
  $('#delFloor').textContent = t('floors.remove', { name: f.name });
}
$('#pSuggest').addEventListener('click', e => {
  const act = e.target.closest('[data-sug]')?.dataset.sug;
  if (act === 'run') {
    e.target.textContent = t('panel.computing'); e.target.disabled = true;
    setTimeout(() => { suggestion = E.suggest(P, MODELS, P.floor, P.band, model); renderPanel(); schedule(); }, 20);
    track('suggest_node', { band: P.band });
  } else if (act === 'add' && suggestion) {
    pushHist();
    cur().nodes.push({ x: suggestion.x, y: suggestion.y, model: suggestion.model, main: !nodesAll().length, wired: !!suggestion.relaxed });
    sel = { type: 'node', i: cur().nodes.length - 1 };
    dirty();
  } else if (act === 'clear') { suggestion = null; renderPanel(); schedule(); }
});

function renderSel() {
  const box = $('#pSel'), f = cur();
  const item = sel && (sel.type === 'wall' ? f.walls : sel.type === 'node' ? f.nodes : f.labels)[sel.i];
  if (!item) { box.hidden = true; return; }
  box.hidden = false;
  if (sel.type === 'wall') {
    box.innerHTML = `<h2>${esc(t('sel.wall'))}</h2><p class="small muted">${fmt(Math.hypot(item.x2 - item.x1, item.y2 - item.y1), 2)} m</p>
      <label class="eyebrow" for="selMat">${esc(t('sel.material'))}</label>
      <select id="selMat">${Object.entries(MATERIALS).map(([key, m]) => `<option value="${key}"${key === item.m ? ' selected' : ''}>${esc(matLabel(key))} · −${m.db.join('/')} dB</option>`).join('')}</select>
      <div class="btnrow"><button type="button" data-selact="del">${esc(t('sel.delWall'))}</button></div>`;
  } else if (sel.type === 'node') {
    const gi = nodesAll().findIndex(a => a.n === item);
    box.innerHTML = `<h2>${esc(nodeName(gi))}</h2>
      <label class="eyebrow" for="selModel">${esc(t('sel.model'))}</label><select id="selModel">${modelOptions(item.model)}</select>
      ${item.main ? `<p class="small muted">${esc(t('sel.mainNote'))}</p>` : `<label class="check"><input type="checkbox" id="selWired"${item.wired ? ' checked' : ''}> ${esc(t('sel.wired'))}</label>`}
      <div class="btnrow">${item.main ? '' : `<button type="button" data-selact="main">${esc(t('sel.makeMain'))}</button>`}<button type="button" data-selact="del">${esc(t('sel.delNode'))}</button></div>`;
  } else {
    box.innerHTML = `<h2>${esc(t('sel.room'))}</h2><label class="sr" for="selText">${esc(t('sel.text'))}</label><input type="text" id="selText" value="${esc(item.t)}" maxlength="40">
      <div class="btnrow"><button type="button" data-selact="del">${esc(t('sel.delRoom'))}</button></div>`;
  }
}
$('#pSel').addEventListener('change', e => {
  const f = cur(), id = e.target.id;
  if (!sel) return;
  pushHist();
  if (id === 'selMat') f.walls[sel.i].m = e.target.value;
  else if (id === 'selModel') f.nodes[sel.i].model = e.target.value;
  else if (id === 'selWired') f.nodes[sel.i].wired = e.target.checked;
  else if (id === 'selText') { const text = e.target.value.trim(); if (!text) { hist.pop(); return; } f.labels[sel.i].t = text; }
  dirty();
});
$('#pSel').addEventListener('click', e => {
  const act = e.target.closest('[data-selact]')?.dataset.selact;
  if (!act || !sel) return;
  pushHist();
  if (act === 'del') { removeHit(sel); sel = null; }
  else if (act === 'main') { nodesAll().forEach(a => { a.n.main = false; }); const n = cur().nodes[sel.i]; n.main = true; n.wired = false; }
  dirty();
});

/* ---------- plan, area and background image ---------- */
$('#areaW').addEventListener('change', e => { pushHist(); P.w = clamp(+e.target.value || 16, 4, 80); dirty(); resize(); });
$('#areaH').addEventListener('change', e => { pushHist(); P.h = clamp(+e.target.value || 12, 4, 80); dirty(); resize(); });
$('#bgFile').addEventListener('change', e => {
  const file = e.target.files[0]; if (!file) return;
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
      dirty(); resize();
      toast(t('toast.imageLoaded'));
    };
    im.onerror = () => toast(t('toast.imageError'));
    im.src = rd.result;
  };
  rd.readAsDataURL(file); e.target.value = '';
});
$('#bgAlpha').addEventListener('input', e => { if (cur().bg) { cur().bg.alpha = e.target.value / 100; persist(); schedule(); } });
$('#bgRemove').addEventListener('click', () => { pushHist(); cur().bg = null; dirty(); });
function showCalib() {
  const box = $('#calib');
  if (!measure) { box.hidden = true; return; }
  box.hidden = false;
  $('#calLenNow').textContent = fmt(Math.hypot(measure.x2 - measure.x1, measure.y2 - measure.y1), 2) + ' m';
  $('#calForm').hidden = !cur().bg;
}
$('#calApply').addEventListener('click', () => {
  const real = +$('#calLen').value, f = cur();
  if (!measure || !f.bg || !(real > 0)) return;
  const L = Math.hypot(measure.x2 - measure.x1, measure.y2 - measure.y1); if (L < 0.05) return;
  pushHist(); f.bg.mpp *= real / L; measure = null; showCalib();
  const im = imgFor(f.bg.src);
  if (im.naturalWidth) { P.w = clamp(Math.max(P.w, Math.ceil(im.naturalWidth * f.bg.mpp)), 4, 80); P.h = clamp(Math.max(P.h, Math.ceil(im.naturalHeight * f.bg.mpp)), 4, 80); }
  dirty(); resize();
});
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
  if (act === 'rename') {
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
$('#keepExample').addEventListener('click', () => { delete P.example; persist(); renderPanel(); });

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
function afterFloor() { suggestion = null; renderFloors(); renderPanel(); showCalib(); resize(); }
function renderAll() { renderProjects(); renderBands(); fillMatSel(); fillModelSel(); afterFloor(); }

St.migrateLegacy();
{
  const list = St.listProjects();
  const saved = (St.currentId() && St.loadProject(St.currentId())) || (list[0] && St.loadProject(list[0].id));
  openProject(saved || St.exampleProject({ name: t('project.exampleName'), ground: NAMES.ground, rooms: raw('project.exampleRooms') }));
}
new ResizeObserver(resize).observe(area);
window.addEventListener('resize', resize);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', schedule);
if (document.fonts) document.fonts.ready.then(schedule);
setTool(P.example ? 'select' : 'wall');
renderLegend();
readout(null);

$('#tourBtn')?.addEventListener('click', startTour);
const isBot = /bot|crawl|spider|slurp|mediapartners|lighthouse|headless/i.test(navigator.userAgent);
if (!tourSeen() && !isBot) setTimeout(startTour, 700);
