import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, loadDicts, LANGS, INDEXED } from '../scripts/build.mjs';
import { MATERIALS, SLAB } from '../assets/js/engine.js';

const dicts = loadDicts();
const BASE = 'pt-BR';

// Every key path with its value type, e.g. "ui.tour.steps:array".
function shape(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix + k;
    if (Array.isArray(v)) return [`${key}:array:${v.length}`, ...v.flatMap((x, i) => (x && typeof x === 'object' ? shape(x, `${key}.${i}.`) : []))];
    if (v && typeof v === 'object') return shape(v, key + '.');
    return [`${key}:${typeof v}`];
  }).sort();
}

test('every language has exactly the keys of the Portuguese file', () => {
  const base = shape(dicts[BASE]);
  for (const lang of LANGS.filter(l => l !== BASE)) {
    const other = shape(dicts[lang]);
    assert.deepEqual(other.filter(k => !base.includes(k)), [], `${lang} has extra keys`);
    assert.deepEqual(base.filter(k => !other.includes(k)), [], `${lang} is missing keys`);
  }
});

test('every material and signal category has a label in every language', () => {
  for (const lang of LANGS) {
    const d = dicts[lang];
    for (const m of Object.keys(MATERIALS)) {
      assert.ok(d.ui.materials[m], `${lang}: ui.materials.${m}`);
      assert.ok(d.guide.materialNames[m], `${lang}: guide.materialNames.${m}`);
    }
    assert.equal(d.ui.cats.length, 5, `${lang}: ui.cats`);
  }
});

test('placeholders in translated strings match the Portuguese ones', () => {
  const params = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
  const walk = (a, b, path) => {
    if (typeof a === 'string') { assert.equal(params(b), params(a), `${path}`); return; }
    if (a && typeof a === 'object') for (const k of Object.keys(a)) walk(a[k], b?.[k], `${path}.${k}`);
  };
  for (const lang of LANGS.filter(l => l !== BASE)) walk(dicts[BASE].ui, dicts[lang].ui, lang + ':ui');
});

test('guides quote the same model numbers in every language', () => {
  // {db.tijolo.b5}-style tokens are filled from engine.js by the build; every translation must use the same ones.
  const tokens = s => [...String(s).matchAll(/\{([\w.]+)\}/g)].map(m => m[1]).sort().join(',');
  const walk = (a, b, path) => {
    if (typeof a === 'string') { assert.equal(tokens(b), tokens(a), path); return; }
    if (a && typeof a === 'object') for (const k of Object.keys(a)) walk(a[k], b?.[k], `${path}.${k}`);
  };
  for (const lang of LANGS.filter(l => l !== BASE)) walk(dicts[BASE].guides, dicts[lang].guides, lang + ':guides');
});

test('each language gets its own pages, hreflang links and language switcher', async () => {
  const out = mkdtempSync(join(tmpdir(), 'planejador-i18n-'));
  try {
    await build({ outDir: out, env: {} });
    const read = f => readFileSync(join(out, f), 'utf8');
    for (const lang of LANGS) {
      const d = dicts[lang];
      for (const page of ['index', 'privacy', 'notFound']) {
        const path = d.paths[page], file = path.endsWith('/') ? path + 'index.html' : /\.\w+$/.test(path) ? path : path + '.html';
        if (page !== 'notFound') assert.ok(!path.endsWith('.html'), `${lang} ${page}: public path must not end in .html`);
        assert.ok(existsSync(join(out, file)), `${lang} ${page} missing at ${file}`);
        const html = read(file);
        assert.ok(html.includes(`<html lang="${lang}">`), `${file} lang`);
        assert.ok(html.includes('id="langSel"'), `${file} switcher`);
      }
      const home = read(d.paths.index.replace(/^\//, '') + 'index.html');
      for (const l of LANGS) assert.ok(home.includes(`hreflang="${l}" href="https://planejadorwifi.com${dicts[l].paths.index}"`), `${lang} → ${l}`);
      assert.ok(home.includes('hreflang="x-default"'));
      assert.ok(home.includes(`<link rel="canonical" href="https://planejadorwifi.com${d.paths.index}">`));
      assert.equal(home.includes('location.replace'), lang === BASE, 'language redirect only on the Portuguese home');
      const ui = JSON.parse(home.match(/<script type="application\/json" id="i18n">(.*?)<\/script>/s)[1]);
      assert.deepEqual(ui.defaults.ground, LANGS.map(l => dicts[l].ui.floors.ground), 'generated floor names of every language');
      for (const [k, m] of Object.entries(MATERIALS)) assert.ok(home.includes(`<tr><td>${d.guide.materialNames[k]}</td>${m.db.map(v => `<td class="num">${v} dB</td>`).join('')}</tr>`), `${lang} table ${k}`);
      assert.ok(home.includes(SLAB.map(v => `<td class="num">${v} dB</td>`).join('')), `${lang} slab row`);
    }
    const sitemap = read('sitemap.xml');
    assert.equal((sitemap.match(/<loc>/g) || []).length, LANGS.length * INDEXED.length);
    assert.ok(read('404.html').includes('noindex'));
  } finally { rmSync(out, { recursive: true, force: true }); }
});
