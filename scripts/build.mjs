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
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { MATERIALS, SLAB } from '../assets/js/engine.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = (process.env.SITE_URL || 'https://planejadorwifi.com').replace(/\/$/, '');
export const LANGS = ['pt-BR', 'en', 'es'];
const DEFAULT_LANG = 'pt-BR';
const PAGES = { index: 'src/index.html', privacy: 'src/privacy.html', notFound: 'src/404.html' };
const INDEXED = ['index', 'privacy'];
const STATIC = ['assets', 'robots.txt', 'llms.txt', 'site.webmanifest'];
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
if(/bot|crawl|spider|slurp|mediapartners|lighthouse|headless|preview/i.test(navigator.userAgent))return;
var p=localStorage.getItem('planejador:lang');
if(!p){var ls=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||''];
for(var i=0;i<ls.length&&!p;i++){var l=String(ls[i]).toLowerCase();p=l.indexOf('pt')===0?'pt-BR':l.indexOf('es')===0?'es':l.indexOf('en')===0?'en':null;}
p=p||'en';}
var to={en:'/en/',es:'/es/'}[p];if(to)location.replace(to+location.search+location.hash);
}catch(e){}})();</script>`;

function specials(dicts, lang, page) {
  const d = dicts[lang];
  const linkPage = INDEXED.includes(page) ? page : 'index';
  const hreflang = INDEXED.includes(page)
    ? [...LANGS.map(l => `<link rel="alternate" hreflang="${l}" href="${SITE}${dicts[l].paths[page]}">`),
      `<link rel="alternate" hreflang="x-default" href="${SITE}${dicts[DEFAULT_LANG].paths[page]}">`].join('\n')
    : '';
  const langOptions = LANGS.map(l => `<option value="${dicts[l].paths[linkPage]}" data-lang="${l}"${l === lang ? ' selected' : ''}>${esc(dicts[l].langName)}</option>`).join('');
  const names = d.guide.materialNames;
  const materialRows = MATERIAL_ORDER.map(k => {
    const db = k === 'slab' ? SLAB : MATERIALS[k].db;
    return `<tr><td>${esc(names[k])}</td>${db.map(v => `<td class="num">${v} dB</td>`).join('')}</tr>`;
  }).join('');
  const faqHtml = d.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('');
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Planejador WiFi', alternateName: ['Planejador Wi-Fi', 'planejadorwifi.com'], url: SITE + '/', inLanguage: d.lang },
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Planejador WiFi', url: SITE + d.paths.index, description: d.meta.appDescription,
      applicationCategory: 'UtilitiesApplication', operatingSystem: d.meta.os, inLanguage: d.lang, isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: d.lang,
      mainEntity: d.faq.map(f => ({ '@type': 'Question', name: stripTags(f.q), acceptedAnswer: { '@type': 'Answer', text: stripTags(f.a) } })) },
  ];
  const json = v => JSON.stringify(v).replace(/</g, '\\u003c');
  return {
    site: SITE,
    home: d.paths.index,
    privacy: d.paths.privacy,
    canonical: SITE + (d.paths[page] || d.paths.index),
    hreflang,
    langOptions,
    materialRows,
    faqHtml,
    jsonLd: ld.map(o => `<script type="application/ld+json">${json(o)}</script>`).join('\n'),
    i18nJson: `<script type="application/json" id="i18n">${json({ lang: d.lang, locale: d.locale, paths: d.paths, ui: d.ui, defaults: defaultNames(dicts) })}</script>`,
    langRedirect: LANG_REDIRECT,
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
 *   slots     { head, bodyEnd, afterTool, inGuide, afterGuide, footer, privacy }  HTML templates with the
 *                                      same {{key}} syntax, inserted at those points
 *   writeFiles(outDir)                 writes extra files (scripts, styles, headers...) before
 *                                      CSS/JS fingerprinting
 * List extensions in SITE_EXTENSIONS. Without any, the site ships no third-party code. */
export const SLOTS = ['head', 'bodyEnd', 'afterTool', 'inGuide', 'afterGuide', 'footer', 'privacy'];

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

function renderPage(page, lang, dicts, flags, slots) {
  let html = readFileSync(join(ROOT, PAGES[page]), 'utf8');
  for (const [slot, file] of Object.entries(PARTIALS)) {
    html = html.replaceAll(`{{{@${slot}}}}`, readFileSync(join(ROOT, 'src/partials', file + '.html'), 'utf8'));
  }
  for (const name of SLOTS) html = html.replaceAll(`{{{@slot.${name}}}}`, slots[name] || '');
  html = applyBlocks(html, { ...flags, home: page === 'index', ptHome: page === 'index' && lang === DEFAULT_LANG });
  return render(html, dicts[lang], specials(dicts, lang, page));
}

function sitemap(dicts, date) {
  const urls = INDEXED.flatMap(page => LANGS.map(lang => {
    const alts = [...LANGS.map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${dicts[l].paths[page]}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${dicts[DEFAULT_LANG].paths[page]}"/>`].join('\n');
    return `  <url>\n    <loc>${SITE}${dicts[lang].paths[page]}</loc>\n    <lastmod>${date}</lastmod>\n${alts}\n  </url>`;
  }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

function sourceDate() {
  try { return execSync('git log -1 --format=%cs', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || today(); }
  catch { return today(); }
}
const today = () => new Date().toISOString().slice(0, 10);

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

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const item of STATIC) {
    cpSync(join(ROOT, item), join(outDir, item), { recursive: true, filter: src => basename(src) !== '.DS_Store' });
  }

  for (const lang of LANGS) {
    for (const page of Object.keys(PAGES)) {
      const html = renderPage(page, lang, dicts, flags, slots);
      const left = html.match(/\{\{/);
      if (left) throw new Error(`Unreplaced placeholder in ${page} (${lang}).`);
      const file = join(outDir, outPath(dicts[lang].paths[page]));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, html);
    }
  }
  writeFileSync(join(outDir, 'sitemap.xml'), sitemap(dicts, sourceDate()));
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
