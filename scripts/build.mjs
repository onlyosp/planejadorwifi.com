#!/usr/bin/env node
// Builds the static site into dist/. Node standard library only, no dependencies.
//
// Pages come from src/*.html templates rendered once per language in i18n/*.json:
//   {{key.path}}    escaped text from the language file
//   {{{key.path}}}  raw HTML from the language file
//   {{@name}}       value computed here (canonical URL, hreflang links, FAQ, tables...)
// Portuguese is served at /, English at /en/ and Spanish at /es/.
//
// Optional HTML is wrapped in <!-- build:KEY --> ... <!-- /build:KEY -->. KEY is `home`
// (simulator page), `ptHome`, `thirdParty` (an extension loads third-party code) or a flag an
// extension declares; a leading `!` inverts it.
//
// Environment:
//   SITE_URL         public origin used in canonical links and the sitemap (default below)
//   SITE_EXTENSIONS  comma-separated paths to build extensions, see "Extensions" further down
//
// CSS and JS URLs get a ?v=<content hash> suffix (HTML references and module imports), so a
// deploy is never hidden behind CDN or browser caches.

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { MATERIALS, SLAB, SIGNAL_LEVELS, LINK_LEVELS, N_EXP, GOOD, BANDS, BAND_KEYS, BUILTIN_MODELS, FLOOR_H, COVER_CELL, SUGGEST } from '../assets/js/engine.js';
import { createDates } from './lastmod.mjs';
import { HOMES, TARGET, ROOM, DOOR, coverage, exampleHome } from './scenarios.mjs';
import { encodeShare, SHARE_PREFIX } from '../assets/js/store.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = (process.env.SITE_URL || 'https://planejadorwifi.com').replace(/\/$/, '');
export const LANGS = ['pt-BR', 'en', 'es'];
const DEFAULT_LANG = 'pt-BR';
// Guides share one template (src/guide.html). Each one's texts live in every language file under
// guides.items.<id> and its public path under paths["guide-<id>"]. `published` is the date it first
// went online; the modified date comes from git. `example` is the example home (scripts/scenarios.mjs)
// its call to action opens in the planner. `related` lists other guide ids, in order.
const GUIDES = [
  { id: 'router', published: '2026-10-29', example: 'h120', related: ['nodes', 'walls', 'mesh'] },
  { id: 'nodes', published: '2026-10-29', example: 'h200', related: ['router', 'mesh', 'walls'] },
  { id: 'mesh', published: '2026-10-29', example: 'twoStory', related: ['nodes', 'bands', 'router'] },
  { id: 'walls', published: '2026-10-29', example: 'apartment', related: ['dbm', 'router', 'bands'] },
  { id: 'dbm', published: '2026-10-29', example: 'h150', related: ['walls', 'bands', 'nodes'] },
  { id: 'bands', published: '2026-10-29', example: 'long', related: ['mesh', 'dbm', 'walls'] },
];
const guidePage = id => `guide-${id}`;
const guideOf = page => GUIDES.find(g => guidePage(g.id) === page);
// Reference pages (src/doc.html): texts under the page key in every language file, plus the
// links listed at the end of the page as [text, path].
const DOCS = {
  methodology: { published: '2026-10-29', type: 'Article',
    links: d => [...GUIDES.map(g => [d.guides.items[g.id].h1, d.paths[guidePage(g.id)]]), [d.guides.all, d.paths.guides]] },
  about: { published: '2026-10-29', type: 'AboutPage',
    links: d => [[d.guides.methodology, d.paths.methodology], [d.guides.all, d.paths.guides], [d.footer.privacy, d.paths.privacy]] },
};

const PAGES = {
  index: 'src/index.html', guides: 'src/guides.html',
  ...Object.fromEntries(GUIDES.map(g => [guidePage(g.id), 'src/guide.html'])),
  ...Object.fromEntries(Object.keys(DOCS).map(id => [id, 'src/doc.html'])),
  privacy: 'src/privacy.html', notFound: 'src/404.html',
};
export const INDEXED = ['index', 'guides', ...GUIDES.map(g => guidePage(g.id)), ...Object.keys(DOCS), 'privacy'];
// What each page's content is made of, for its last-modified date: its template plus its own
// part of the language file (see scripts/lastmod.mjs).
function sources(page) {
  const g = guideOf(page);
  if (g) return { files: ['src/guide.html'], keys: [`guides.items.${g.id}`] };
  if (DOCS[page]) return { files: ['src/doc.html'], keys: [page] };
  return {
    index: { files: ['src/index.html'], keys: ['meta', 'intro', 'guide', 'faq'] },
    guides: { files: ['src/guides.html'], keys: ['guides.index'] },
    privacy: { files: ['src/privacy.html'], keys: ['privacy'] },
  }[page] || { files: [PAGES[page]], keys: [] };
}
const STATIC = ['assets', 'site.webmanifest'];
const MATERIAL_ORDER = ['tijolo', 'concreto', 'slab', 'gesso', 'madeira', 'vidro', 'metal'];

export function applyBlocks(html, flags) {
  const re = /<!-- build:(!?)([\w-]+) -->([\s\S]*?)<!-- \/build:\1\2 -->/g;
  let out = html, prev;
  do {
    prev = out;
    out = out.replace(re, (_, neg, key, body) => {
      if (!(key in flags)) throw new Error(`Unknown build block "${key}".`);
      return (neg ? !flags[key] : flags[key]) ? body : '';
    });
  } while (out !== prev);
  if (out.includes('<!-- build:') || out.includes('<!-- /build:')) throw new Error('Unbalanced build block markers.');
  return out;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripTags = s => String(s).replace(/<[^>]+>/g, '');
const lookup = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function loadDicts(dir = join(ROOT, 'i18n')) {
  return Object.fromEntries(LANGS.map(l => [l, JSON.parse(readFileSync(join(dir, l + '.json'), 'utf8'))]));
}

export function render(tpl, dict, special) {
  return tpl.replace(/\{\{\{\s*(@?[\w.]+)\s*\}\}\}|\{\{\s*(@?[\w.]+)\s*\}\}/g, (_, raw, plain) => {
    const key = raw || plain;
    const v = key.startsWith('@') ? special[key.slice(1)] : lookup(dict, key);
    if (v === undefined || (typeof v === 'object' && v !== null)) throw new Error(`Missing value for "${key}" (${dict.lang}).`);
    return raw ? String(v) : esc(v);
  });
}

// Public paths have no .html extension (the host serves /x from x.html); files on disk do.
const outPath = p => (p.endsWith('/') ? p + 'index.html' : /\.\w+$/.test(p) ? p : p + '.html').replace(/^\//, '');

// Runs before any style or module loads, on the Portuguese home page only. Visitors whose saved
// choice or browser language is English or Spanish (or anything other than Portuguese) go to
// /en/ or /es/. Crawlers are left alone so every version stays indexable.
const LANG_REDIRECT = `<script>(function(){try{
if(/bot|crawl|spider|slurp|mediapartners|lighthouse|headless|preview|inspectiontool|google-|bing|claude|anthropic|openai|chatgpt|perplexity/i.test(navigator.userAgent))return;
var p=localStorage.getItem('planejador:lang');
if(!p){var ls=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||''];
for(var i=0;i<ls.length&&!p;i++){var l=String(ls[i]).toLowerCase();p=l.indexOf('pt')===0?'pt-BR':l.indexOf('es')===0?'es':l.indexOf('en')===0?'en':null;}
p=p||'en';}
var to={en:'/en/',es:'/es/'}[p];if(to)location.replace(to+location.search+location.hash);
}catch(e){}})();</script>`;

/* ---------- numbers from the model ----------
 * Guide texts never type the model's numbers: they write {tokens} that the build fills from
 * engine.js, in the page's number format. Bands are b24, b5 and b6; materials are the keys of
 * MATERIALS plus "slab".
 *   {db.tijolo.b5}         loss of one wall, in dB
 *   {level.1}              lower bound of signal category 1 (good), in dBm
 *   {n}                    path loss exponent
 *   {range.b5}             distance in meters where the signal stays good, with nothing in the way
 *   {range.b5.tijolo.2}    the same through two walls of that material
 *   {factor.b5.tijolo}     how many times one wall of that material shortens that distance
 *   {linkrange.b5.tijolo}  like range, for a node-to-node link that stays at {link.1} or better
 *   {ratio.1.3}            how many times more power signal level 1 has than level 3
 *   {mw.b5}                transmit power of the band in milliwatts
 *   {grid} {suggest.cell} {suggest.wallGap} {suggest.floor}  coverage grid and suggest() settings
 *   {room} {door}          room width and door width of the example homes, in meters
 *   {href.dbm}             public path of a guide (by id) or of a page (methodology, privacy)
 *   {link.0}               lower bound of backhaul quality 0 (great) or 1 (ok), in dBm
 *   {mhz.b5} {pl0.b5} {tx.b5}  reference frequency, loss at 1 m and transmit power of a band
 *   {floorh}               floor-to-floor height, in meters
 *   {cover.h120.2}         share of an example home with good signal using 2 nodes (scripts/scenarios.mjs);
 *                          {cover.twoStory.1.1} the same for one floor (0 = ground)
 *   {need.h120}            nodes the example home needs; {area.h120} its area in m²; {target} the goal
 *   {table.materials} {table.signal} {table.nodes} {table.bands}  generated tables */
const BAND_TOKENS = { b24: '2.4', b5: '5', b6: '6' };
const lossOf = mat => (mat === 'slab' ? SLAB : MATERIALS[mat]?.db);

function modelValue(token, d) {
  const [kind, ...a] = token.split('.');
  const num = (v, digits = 0) => new Intl.NumberFormat(d.locale, { maximumFractionDigits: digits }).format(v).replace('-', '\u2212');
  const band = k => { const b = BANDS[BAND_TOKENS[k]]; if (!b) throw new Error(`Unknown band in {${token}}`); return b; };
  const loss = (mat, b) => { const l = lossOf(mat); if (!l) throw new Error(`Unknown material in {${token}}`); return l[b.i]; };
  const pct = v => coverPct(v, d);
  const home = id => { if (!HOMES[id]) throw new Error(`Unknown example home in {${token}}`); return coverage(id); };
  if (kind === 'db') return num(loss(a[0], band(a[1])));
  if (kind === 'level' && SIGNAL_LEVELS[+a[0]] !== undefined) return num(SIGNAL_LEVELS[+a[0]]);
  if (kind === 'n') return num(N_EXP, 1);
  if (kind === 'range' || kind === 'linkrange') {
    const b = band(a[0]), walls = a[1] ? loss(a[1], b) * (a[2] ? +a[2] : 1) : 0;
    const m = 10 ** ((b.tx - b.pl0 - walls - (kind === 'range' ? GOOD : LINK_LEVELS[1])) / (10 * N_EXP));
    return num(m, m < 10 ? 1 : 0);
  }
  if (kind === 'ratio' && SIGNAL_LEVELS[+a[0]] !== undefined && SIGNAL_LEVELS[+a[1]] !== undefined) return num(10 ** ((SIGNAL_LEVELS[+a[0]] - SIGNAL_LEVELS[+a[1]]) / 10));
  if (kind === 'mw') return num(Math.round(10 ** (band(a[0]).tx / 10) / 10) * 10);
  if (kind === 'grid') return num(COVER_CELL, 2);
  if (kind === 'suggest' && SUGGEST[a[0]] !== undefined) return num(SUGGEST[a[0]], 1);
  if (kind === 'room') return num(ROOM, 1);
  if (kind === 'door') return num(DOOR, 1);
  if (kind === 'size') { const h = HOMES[a[0]]; if (!h) throw new Error(`Unknown example home in {${token}}`); return `${num(h.w, 1)} × ${num(h.h, 1)} m`; }
  if (kind === 'href') { const p = d.paths[guidePage(a[0])] || d.paths[a[0]]; if (!p) throw new Error(`Unknown page in {${token}}`); return p; }
  if (kind === 'factor') { const b = band(a[0]); return num(10 ** (loss(a[1], b) / (10 * N_EXP)), 1); }
  if (kind === 'link' && LINK_LEVELS[+a[0]] !== undefined) return num(LINK_LEVELS[+a[0]]);
  if (kind === 'mhz') return num(band(a[0]).mhz);
  if (kind === 'pl0') return num(band(a[0]).pl0, 1);
  if (kind === 'tx') return num(band(a[0]).tx);
  if (kind === 'floorh') return num(FLOOR_H);
  if (kind === 'target') return pct(TARGET);
  if (kind === 'cover' && a.length >= 2) {
    const step = home(a[0]).steps[+a[1]];
    if (!step) throw new Error(`Unknown node count in {${token}}`);
    return pct(a[2] !== undefined ? step[+a[2]] : step.reduce((x, y) => x + y, 0) / step.length);
  }
  if (kind === 'need') return home(a[0]).need ?? '—';
  if (kind === 'area') return num(home(a[0]).area);
  if (kind === 'table' && a[0] === 'materials') return materialTable(d);
  if (kind === 'table' && a[0] === 'signal') return signalTable(d);
  if (kind === 'table' && a[0] === 'nodes') return nodesTable(d);
  if (kind === 'table' && a[0] === 'bands') return bandsTable(d);
  throw new Error(`Unknown model token {${token}} (${d.lang}).`);
}
// Fills the tokens, then keeps numbers with their units on one line (5 GHz, 18 dB, 8,1 m, 4 × 4 m).
export const fillModel = (html, d) => String(html).replace(/\{([a-z]+(?:\.\w+)*)\}/g, (_, token) => modelValue(token, d))
  .replace(/(\d) (GHz|dBm|dB|m)(?![\w-])/g, '$1\u00a0$2').replace(/(\d) × (?=\d)/g, '$1\u00a0×\u00a0');

function materialRows(d) {
  const names = d.guide.materialNames;
  return MATERIAL_ORDER.map(k => `<tr><td>${esc(names[k])}</td>${lossOf(k).map(v => `<td class="num">${v} dB</td>`).join('')}</tr>`).join('');
}
function signalRows(d) {
  const dbm = v => `${String(v).replace('-', '\u2212')}`, L = SIGNAL_LEVELS, g = d.guide;
  const ranges = [g.levelBest.replace('{v}', dbm(L[0])),
    ...L.slice(1).map((l, i) => g.levelRange.replace('{a}', dbm(L[i])).replace('{b}', dbm(l))),
    g.levelBelow.replace('{v}', dbm(L.at(-1)))];
  return ranges.map((r, i) => `<tr><td class="mono">${esc(r)}</td><td><i class="sw" style="background:var(--q${i})"></i>${esc(d.ui.cats[i].name)}</td><td>${esc(g.signalUse[i])}</td></tr>`).join('');
}
const tableWrap = (head, rows) => `<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
const materialTable = d => tableWrap(`<th>${esc(d.guide.material)}</th>${['2_4', '5', '6'].map(b => `<th class="num">${esc(d.bands[b])}</th>`).join('')}`, materialRows(d));
const signalTable = d => tableWrap(`<th>${esc(d.guide.signal)}</th><th>${esc(d.guide.level)}</th><th>${esc(d.guide.practice)}</th>`, signalRows(d));
// Coverage shares are rounded down, so 89.6% never reads as reaching a 90% goal.
const coverPct = (v, d) => new Intl.NumberFormat(d.locale, { style: 'percent', maximumFractionDigits: 0 }).format(Math.floor(v * 100 + 1e-9) / 100);
// Example homes of the table: area, share with good signal using 1 to 3 nodes, nodes needed.
function nodesTable(d) {
  const T = d.guides.tables, num = v => new Intl.NumberFormat(d.locale).format(v), pct = v => coverPct(v, d);
  const rows = Object.keys(HOMES).filter(id => HOMES[id].table).map(id => {
    const c = coverage(id);
    return `<tr><td>${num(c.area)}\u00a0m²</td>${[1, 2, 3].map(n => `<td class="num">${pct(c.steps[n][0])}</td>`).join('')}<td class="num">${c.need ?? '—'}</td></tr>`;
  }).join('');
  return tableWrap(`<th>${esc(T.area)}</th>${T.withNodes.map(h => `<th class="num">${esc(h)}</th>`).join('')}<th class="num">${esc(T.need.replace('{target}', pct(TARGET)))}</th>`, rows);
}
// Model constants per band: reference frequency, loss at 1 m, transmit power.
function bandsTable(d) {
  const T = d.guides.tables, num = (v, f = 0) => new Intl.NumberFormat(d.locale, { maximumFractionDigits: f }).format(v);
  const rows = BAND_KEYS.map(k => { const b = BANDS[k];
    return `<tr><td>${esc(d.bands[k.replace('.', '_')])}</td><td class="num">${num(b.mhz)}\u00a0MHz</td><td class="num">${num(b.pl0, 1)}\u00a0dB</td><td class="num">${num(b.tx)}\u00a0dBm</td></tr>`; }).join('');
  return tableWrap(`<th>${esc(T.band)}</th><th class="num">${esc(T.mhz)}</th><th class="num">${esc(T.pl0)}</th><th class="num">${esc(T.tx)}</th>`, rows);
}

const ldJson = v => JSON.stringify(v).replace(/</g, '\\u003c');
const ldScripts = list => list.map(o => `<script type="application/ld+json">${ldJson(o)}</script>`).join('\n');
const longDate = (iso, d) => new Intl.DateTimeFormat(d.locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));
const ORG = () => ({ '@type': 'Organization', name: 'Planejador WiFi', url: SITE + '/', logo: { '@type': 'ImageObject', url: SITE + '/assets/img/icon-512.png' } });
const crumbsLd = items => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
const crumbsHtml = (d, items) => `<nav class="crumbs" aria-label="${esc(d.guides.crumbLabel)}"><ol>${items.map(([name, url], i) =>
  i === items.length - 1 ? `<li aria-current="page">${esc(name)}</li>` : `<li><a href="${esc(url.slice(SITE.length) || '/')}">${esc(name)}</a></li>`).join('')}</ol></nav>`;

const sectionsOf = (list, d) => list.map(s => `<section aria-labelledby="${esc(s.id)}"><h2 id="${esc(s.id)}">${esc(s.q || s.h)}</h2>\n${fillModel(s.html, d)}</section>`);
const articleLd = (d, { headline, description, url, published, modified }) => ({ '@context': 'https://schema.org', '@type': 'Article',
  headline, description, inLanguage: d.lang, url, mainEntityOfPage: url, image: SITE + '/assets/img/og-image.png',
  datePublished: published, dateModified: modified, author: ORG(), publisher: ORG() });
const dated = (d, published, modified) => ({ updated: d.guides.updated.replace('{date}', longDate(modified, d)), dateIso: modified });

// Values for a reference page (methodology, about): its sections, its links and its structured data.
function docSpecials(dicts, lang, page, dateOf) {
  const d = dicts[lang], G = d.guides, P = d[page], doc = DOCS[page], url = SITE + d.paths[page];
  const modified = [doc.published, dateOf(page, lang)].sort().at(-1);
  const crumbs = [[G.home, SITE + d.paths.index], [P.short, url]];
  const links = doc.links(d).map(([text, path]) => `<li><a href="${esc(path)}">${esc(text)}</a></li>`);
  const main = doc.type === 'Article'
    ? articleLd(d, { headline: P.h1, description: P.description, url, published: doc.published, modified })
    : { '@context': 'https://schema.org', '@type': doc.type, name: P.h1, description: P.description, url, inLanguage: d.lang,
      dateModified: modified, isPartOf: { '@type': 'WebSite', name: 'Planejador WiFi', url: SITE + '/' }, about: ORG() };
  return {
    title: P.title, description: P.description, h1: P.h1, ogTitle: P.h1, ogDescription: P.description,
    ogType: doc.type === 'Article' ? 'article' : 'website',
    crumbs: crumbsHtml(d, crumbs), ...dated(d, doc.published, modified),
    lead: `<div class="answer">${fillModel(P.lead, d)}</div>`, sections: sectionsOf(P.sections, d).join('\n'),
    related: `<nav class="related" aria-labelledby="related-title"><h2 id="related-title">${esc(P.related)}</h2><ul>${links.join('')}</ul></nav>`,
    jsonLd: ldScripts([main, crumbsLd(crumbs)]),
  };
}

// Each guide's example home as a project link (#p=…, see encodeShare() in store.js), named in
// the page language: "Open this example in the planner".
const exampleName = (d, g) => stripTags(fillModel(d.guides.items[g.id].example, d));
async function exampleLinks(dicts) {
  const out = {};
  for (const lang of LANGS) for (const g of GUIDES) {
    const d = dicts[lang], name = exampleName(d, g);
    out[`${lang}|${g.id}`] = d.paths.index + SHARE_PREFIX + await encodeShare({ ...exampleHome(g.example), name: name[0].toLocaleUpperCase(lang) + name.slice(1) });
  }
  return out;
}

// Values for the guides index and the guide pages.
function guideSpecials(dicts, lang, page, dateOf, examples) {
  const d = dicts[lang], G = d.guides, url = SITE + d.paths[page];
  const home = [G.home, SITE + d.paths.index], index = [G.index.h1, SITE + d.paths.guides];
  const og = (title, description) => ({ ogTitle: title, ogDescription: description });
  if (page === 'guides') {
    const list = GUIDES.map(g => {
      const it = G.items[g.id];
      return `<li><h2><a href="${esc(d.paths[guidePage(g.id)])}">${esc(it.h1)}</a></h2><p>${esc(it.description)}</p></li>`;
    }).join('');
    return {
      title: G.index.title, description: G.index.description, h1: G.index.h1, ...og(G.index.h1, G.index.description),
      crumbs: crumbsHtml(d, [home, index]), guideList: `<ul class="guide-list">${list}</ul>`,
      jsonLd: ldScripts([
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: G.index.h1, description: G.index.description, url, inLanguage: d.lang,
          isPartOf: { '@type': 'WebSite', name: 'Planejador WiFi', url: SITE + '/' },
          mainEntity: { '@type': 'ItemList', itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + d.paths[guidePage(g.id)], name: G.items[g.id].h1 })) } },
        crumbsLd([home, index]),
      ]),
    };
  }
  const g = guideOf(page), it = { ...G.items[g.id], ...pageMeta(d, page) };
  const modified = [g.published, dateOf(page, lang)].sort().at(-1);
  const sections = sectionsOf(it.sections, d);
  const half = Math.ceil(sections.length / 2);
  const faq = it.faq || [];
  const related = g.related.filter(id => GUIDES.some(x => x.id === id));
  const links = [...related.map(id => `<li><a href="${esc(d.paths[guidePage(id)])}">${esc(G.items[id].h1)}</a></li>`),
    ...(d.paths.methodology ? [`<li><a href="${esc(d.paths.methodology)}">${esc(G.methodology)}</a></li>`] : []),
    `<li><a href="${esc(d.paths.guides)}">${esc(G.all)}</a></li>`];
  const ld = [
    articleLd(d, { headline: it.h1, description: it.description, url, published: g.published, modified }),
    crumbsLd([home, index, [it.short, url]]),
  ];
  if (faq.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: d.lang,
    mainEntity: faq.map(f => ({ '@type': 'Question', name: stripTags(fillModel(f.q, d)), acceptedAnswer: { '@type': 'Answer', text: stripTags(fillModel(f.a, d)) } })) });
  return {
    title: it.title, description: it.description, h1: it.h1, ...og(it.h1, it.description),
    crumbs: crumbsHtml(d, [home, index, [it.short, url]]),
    ...dated(d, g.published, modified),
    answer: `<div class="answer">${fillModel(it.answer, d)}</div>`,
    sectionsA: sections.slice(0, half).join('\n'), sectionsB: sections.slice(half).join('\n'),
    note: fillModel(G.note, d),
    cta: `<aside class="cta" aria-labelledby="cta-title"><h2 id="cta-title">${esc(it.cta.title)}</h2><p>${esc(it.cta.text)}</p>`
      + `<p class="cta-actions"><a class="btn primary" href="${esc(d.paths.index)}#simulator">${esc(G.ctaButton)}</a><a class="btn" href="${esc(examples[`${lang}|${g.id}`])}">${esc(G.exampleButton)}</a></p>`
      + `<p class="cta-note">${esc(G.exampleLabel.replace('{name}', exampleName(d, g)))}</p></aside>`,
    faq: faq.length ? `<h2 id="faq">${esc(G.faqTitle)}</h2><div class="faq">${faq.map(f => `<details><summary>${fillModel(f.q, d)}</summary><p>${fillModel(f.a, d)}</p></details>`).join('')}</div>` : '',
    related: `<nav class="related" aria-labelledby="related-title"><h2 id="related-title">${esc(G.related)}</h2><ul>${links.join('')}</ul></nav>`,
    jsonLd: ldScripts(ld),
  };
}

function specials(dicts, lang, page, dateOf, examples) {
  const d = dicts[lang];
  const linkPage = INDEXED.includes(page) ? page : 'index';
  const hreflang = INDEXED.includes(page)
    ? [...LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${SITE}${dicts[l].paths[page]}">`),
      `<link rel="alternate" hreflang="x-default" href="${SITE}${dicts[DEFAULT_LANG].paths[page]}">`].join('\n')
    : '';
  const langOptions = LANGS.map(l => `<option value="${dicts[l].paths[linkPage]}" data-lang="${l}"${l === lang ? ' selected' : ''}>${esc(dicts[l].langName)}</option>`).join('');
  const faqHtml = d.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Planejador WiFi', alternateName: ['Planejador Wi-Fi', 'planejadorwifi.com'], url: SITE + '/', inLanguage: d.lang },
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Planejador WiFi', url: SITE + d.paths.index, description: d.meta.appDescription,
      applicationCategory: 'UtilitiesApplication', operatingSystem: d.meta.os, inLanguage: d.lang, isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: d.lang,
      mainEntity: d.faq.map(f => ({ '@type': 'Question', name: stripTags(f.q), acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) } })) },
  ];
  return {
    site: SITE,
    home: d.paths.index,
    guides: d.paths.guides,
    privacy: d.paths.privacy,
    canonical: SITE + (d.paths[page] || d.paths.index),
    hreflang,
    langOptions,
    materialRows: materialRows(d),
    signalRows: signalRows(d),
    faqHtml,
    jsonLd: ldScripts(ld),
    i18nJson: `<script type="application/json" id="i18n">${ldJson({ lang: d.lang, locale: d.locale, paths: d.paths, ui: d.ui, defaults: defaultNames(dicts) })}</script>`,
    langRedirect: LANG_REDIRECT,
    ...(page === 'guides' || guideOf(page) ? guideSpecials(dicts, lang, page, dateOf, examples) : {}),
    ...(DOCS[page] ? docSpecials(dicts, lang, page, dateOf) : {}),
  };
}

// Names the app generates (floors, example project) in every language, so a project created in one
// language shows them translated in another. See localizeDefaults() in app.js.
function defaultNames(dicts) {
  const all = f => LANGS.map(l => f(dicts[l].ui));
  return {
    ground: all(u => u.floors.ground),
    nth: all(u => u.floors.nth),
    exampleName: all(u => u.project.exampleName),
    exampleRooms: all(u => u.project.exampleRooms),
  };
}

const PARTIALS = { head: 'head', header: 'header', footer: 'footer' };

/* ---------- extensions ----------
 * A build extension adds deployment-specific features (for example a statistics or donation
 * widget) without changing this repository. It is an ES module whose default export is
 * setup({ env, langs }) returning any of:
 *   flags     { name: boolean }        usable in <!-- build:name --> blocks; set
 *                                      thirdParty: true if it loads third-party code
 *   i18n      { 'pt-BR': {...}, ... }  deep-merged into each language file
 *   slots     { head, bodyEnd, afterTool, inResults, inGuide, afterGuide, footer, privacy }  HTML templates with the
 *                                      same {{key}} syntax, inserted at those points
 *   writeFiles(outDir)                 writes extra files (scripts, styles, headers...) before
 *                                      CSS/JS fingerprinting
 * List extensions in SITE_EXTENSIONS. Without any, the site ships no third-party code. */
export const SLOTS = ['head', 'bodyEnd', 'afterTool', 'inResults', 'inGuide', 'afterGuide', 'footer', 'privacy'];

export async function loadExtensions(list) {
  const paths = String(list || '').split(',').map(p => p.trim()).filter(Boolean);
  return Promise.all(paths.map(async p => (await import(pathToFileURL(resolve(ROOT, p)).href)).default));
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
function deepMerge(base, extra) {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra || {})) out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v;
  return out;
}

function renderPage(page, lang, dicts, flags, slots, dateOf, examples) {
  let html = readFileSync(join(ROOT, PAGES[page]), 'utf8');
  for (const [slot, file] of Object.entries(PARTIALS)) {
    html = html.replaceAll(`{{{@${slot}}}}`, readFileSync(join(ROOT, 'src/partials', file + '.html'), 'utf8'));
  }
  for (const name of SLOTS) html = html.replaceAll(`{{{@slot.${name}}}}`, slots[name] || '');
  html = applyBlocks(html, { ...flags, home: page === 'index', ptHome: page === 'index' && lang === DEFAULT_LANG });
  return render(html, dicts[lang], specials(dicts, lang, page, dateOf, examples));
}

function sitemap(dicts, dateOf) {
  const urls = INDEXED.flatMap(page => LANGS.map(lang => {
    const alts = [...LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${dicts[l].paths[page]}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${dicts[DEFAULT_LANG].paths[page]}"/>`].join('\n');
    return `  <url>\n    <loc>${SITE}${dicts[lang].paths[page]}</loc>\n    <lastmod>${dateOf(page, lang)}</lastmod>\n${alts}\n  </url>`;
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

// Every crawler, search engines and AI assistants alike, may read every page.
const robots = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

// Title and description of an indexable page, as shown in search results.
function pageMeta(d, page) {
  if (page === 'index') return { title: d.meta.title, description: d.meta.description };
  if (page === 'guides') return d.guides.index;
  const g = guideOf(page);
  if (g) { const it = d.guides.items[g.id]; return { title: fillModel(it.title, d), description: fillModel(it.description, d) }; }
  return { title: d[page].title, description: d[page].description };
}

// llms.txt (llmstxt.org): what the site is and where its pages are, in every language, plus the
// model's key numbers, taken from engine.js so they never drift from what the planner computes.
function llms(dicts) {
  const en = dicts.en, names = en.guide.materialNames, cats = en.ui.cats;
  const lines = ['# Planejador WiFi', '', `> ${en.meta.appDescription} ${en.llms.summary}`, ''];
  for (const lang of LANGS) {
    const d = dicts[lang];
    lines.push(`## ${d.langName}`, '', d.llms.when, '');
    for (const page of INDEXED) {
      const m = pageMeta(d, page);
      lines.push(`- [${m.title}](${SITE}${d.paths[page]}): ${m.description}`);
    }
    lines.push('');
  }
  const db = v => v.join('/');
  const levels = SIGNAL_LEVELS;
  lines.push('## Key facts', '',
    `- Model: log-distance path loss with exponent ${N_EXP}, plus the attenuation of every wall crossed and of each slab between floors. Typical error ±8 dB: it compares placements and does not replace a site survey.`,
    `- Attenuation in dB at 2.4/5/6 GHz: ${MATERIAL_ORDER.map(k => `${names[k].toLowerCase()} ${db(k === 'slab' ? SLAB : MATERIALS[k].db)}`).join('; ')}.`,
    `- Signal levels: ${cats[0].name.toLowerCase()} at ${levels[0]} dBm or better; ${levels.slice(1).map((l, i) => `${cats[i + 1].name.toLowerCase()} from ${levels[i]} to ${l}`).join('; ')}; ${cats[4].name.toLowerCase()} below ${levels.at(-1)} dBm.`,
    `- Built-in router models: ${BUILTIN_MODELS.filter(m => m.id !== 'isp').map(m => m.name).join(', ')}, plus a generic ISP router and the visitor's own models.`,
    '- Free, no sign-up, open source (MIT). Projects stay in the visitor\'s browser.', '');
  return lines.join('\n');
}

function htmlFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'assets' ? [] : htmlFiles(p);
    return name.endsWith('.html') ? [p] : [];
  });
}

export async function build({ outDir = join(ROOT, 'dist'), env = process.env, extensions } = {}) {
  const exts = extensions ?? await loadExtensions(env.SITE_EXTENSIONS);
  const parts = exts.map(e => (typeof e === 'function' ? e : e.setup)({ env, langs: LANGS }) || {});
  const flags = { thirdParty: false };
  const slots = {};
  let dicts = loadDicts();
  for (const p of parts) {
    for (const [k, v] of Object.entries(p.flags || {})) flags[k] = !!(flags[k] || v);
    for (const name of SLOTS) if (p.slots?.[name]) slots[name] = (slots[name] || '') + p.slots[name];
    for (const unknown of Object.keys(p.slots || {}).filter(n => !SLOTS.includes(n))) throw new Error(`Unknown extension slot "${unknown}".`);
    if (p.i18n) dicts = Object.fromEntries(LANGS.map(l => [l, deepMerge(dicts[l], p.i18n[l])]));
  }

  const raw = loadDicts(); // without extension texts: the dates follow this repository's own files
  const pageDate = createDates(ROOT);
  const dateCache = new Map();
  const dateOf = (page, lang) => {
    const id = page + '|' + lang;
    if (!dateCache.has(id)) {
      const src = sources(page);
      dateCache.set(id, pageDate({ files: src.files, sections: src.keys.map(key => ({ file: `i18n/${lang}.json`, key, current: raw[lang] })) }));
    }
    return dateCache.get(id);
  };

  const examples = await exampleLinks(dicts);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const item of STATIC) {
    cpSync(join(ROOT, item), join(outDir, item), { recursive: true, filter: src => basename(src) !== '.DS_Store' });
  }

  for (const lang of LANGS) {
    for (const page of Object.keys(PAGES)) {
      const html = renderPage(page, lang, dicts, flags, slots, dateOf, examples);
      const left = html.match(/\{\{/);
      if (left) throw new Error(`Unreplaced placeholder in ${page} (${lang}).`);
      const file = join(outDir, outPath(dicts[lang].paths[page]));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html);
    }
  }
  writeFileSync(join(outDir, 'sitemap.xml'), sitemap(dicts, dateOf));
  writeFileSync(join(outDir, 'robots.txt'), robots());
  writeFileSync(join(outDir, 'llms.txt'), llms(dicts));
  for (const p of parts) if (p.writeFiles) p.writeFiles(outDir);

  const version = fingerprint(outDir);
  return { flags, extensions: exts.length, version };
}

// Appends ?v=<hash of all CSS and JS> to every stylesheet, script and relative module import.
export function fingerprint(outDir) {
  const dirs = ['assets/css', 'assets/js'];
  const files = dirs.flatMap(d => readdirSync(join(outDir, d)).filter(f => /\.(css|js)$/.test(f)).sort().map(f => join(outDir, d, f)));
  const hash = createHash('sha256');
  for (const f of files) hash.update(f.slice(outDir.length)).update(readFileSync(f));
  const v = hash.digest('hex').slice(0, 10);

  for (const f of files.filter(f => f.endsWith('.js'))) {
    const js = readFileSync(f, 'utf8').replace(/(\bfrom\s*['"])(\.{1,2}\/[\w./-]+\.js)(['"])/g, `$1$2?v=${v}$3`);
    writeFileSync(f, js);
  }
  for (const path of htmlFiles(outDir)) {
    const html = readFileSync(path, 'utf8').replace(/((?:href|src)=")(\/?assets\/(?:css|js)\/[\w.-]+\.(?:css|js))(")/g, `$1$2?v=${v}$3`);
    writeFileSync(path, html);
  }
  return v;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = await build();
    console.log(`Built dist/ (languages: ${LANGS.join(', ')}, extensions: ${r.extensions}, version: ${r.version})`);
  } catch (e) {
    console.error('Build failed: ' + e.message);
    process.exit(1);
  }
}
