import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, applyBlocks, loadDicts, SLOTS, INDEXED, LANGS, SITE } from '../scripts/build.mjs';
import { coverage, TARGET } from '../scripts/scenarios.mjs';
import { decodeShare } from '../assets/js/store.js';

async function run(opts = {}) {
  const out = mkdtempSync(join(tmpdir(), 'planejador-build-'));
  await build({ outDir: out, env: {}, ...opts });
  const read = f => readFileSync(join(out, f), 'utf8');
  return { out, read, has: f => existsSync(join(out, f)), done: () => rmSync(out, { recursive: true, force: true }) };
}

// A small extension that uses every hook, to test the mechanism without any real service.
const demo = () => ({
  flags: { thirdParty: true, demo: true },
  i18n: { 'pt-BR': { demo: { hello: 'Olá' } }, en: { demo: { hello: 'Hello' } }, es: { demo: { hello: 'Hola' } } },
  slots: {
    head: '<meta name="demo-head" content="{{lang}}">',
    bodyEnd: '<div id="demo-end"><!-- build:demo -->{{demo.hello}}<!-- /build:demo --></div>',
    afterTool: '<div id="demo-after"></div>',
    inResults: '<div id="demo-results"></div>',
    inGuide: '<div id="demo-guide"></div>',
    afterGuide: '<div id="demo-after-guide"></div>',
    footer: '<a id="demo-footer" href="{{@privacy}}">x</a>',
    privacy: '<h2 id="demo-privacy">{{demo.hello}}</h2>',
  },
  writeFiles(outDir) { writeFileSync(join(outDir, 'assets/js/demo.js'), "import './i18n.js';\n"); },
});

test('the default build has no third-party code and only public files', async () => {
  const b = await run();
  try {
    const index = b.read('index.html'), privacy = b.read('politica-de-privacidade.html');
    const external = /<script[^>]+src="https?:|<link[^>]+rel="(?:stylesheet|preconnect|preload|modulepreload|dns-prefetch|icon)"[^>]+href="https?:/;
    assert.ok(!external.test(index + privacy), 'no external scripts, styles or fonts');
    assert.ok(b.has('assets/fonts/barlow-latin-400-normal.woff2'), 'fonts are self-hosted');
    assert.ok(!index.includes('{{') && !index.includes('<!-- build:'), 'templates fully rendered');
    assert.ok(privacy.includes('não usa cookies'), 'privacy policy states there is no tracking');
    for (const f of ['README.md', 'tests', 'src', 'i18n', '_headers', 'ads.txt']) assert.equal(b.has(f), false, `${f} must not be published`);
  } finally { b.done(); }
});

test('extensions fill every slot, merge texts, set flags and add files', async () => {
  const b = await run({ extensions: [demo] });
  try {
    const en = b.read('en/index.html'), privacy = b.read('es/privacidad.html');
    assert.ok(en.includes('<meta name="demo-head" content="en">'));
    assert.ok(en.includes('<div id="demo-end">Hello</div>'));
    for (const id of ['demo-after', 'demo-results', 'demo-guide', 'demo-after-guide', 'demo-footer']) assert.ok(en.includes(`id="${id}"`), id);
    assert.ok(privacy.includes('<h2 id="demo-privacy">Hola</h2>'));
    assert.ok(!b.read('politica-de-privacidade.html').includes('não usa cookies'), 'third-party flag hides the no-tracking statement');
    assert.match(b.read('assets/js/demo.js'), /from '.\/i18n\.js\?v=|import '.\/i18n\.js'/);
  } finally { b.done(); }
});

test('unknown extension slots and block flags stop the build', async () => {
  await assert.rejects(run({ extensions: [() => ({ slots: { nowhere: 'x' } })] }), /Unknown extension slot/);
  assert.throws(() => applyBlocks('<!-- build:nope -->x<!-- /build:nope -->', {}), /Unknown/);
  assert.throws(() => applyBlocks('<!-- build:home -->x', { home: true }), /Unbalanced/);
  assert.deepEqual(SLOTS, ['head', 'bodyEnd', 'afterTool', 'inResults', 'inGuide', 'afterGuide', 'footer', 'privacy']);
});

test('negated blocks keep content only when the flag is off', () => {
  assert.equal(applyBlocks('a<!-- build:!thirdParty -->b<!-- /build:!thirdParty -->c', { thirdParty: false }), 'abc');
  assert.equal(applyBlocks('a<!-- build:!thirdParty -->b<!-- /build:!thirdParty -->c', { thirdParty: true }), 'ac');
});

test('CSS and JS URLs carry the content hash', async () => {
  const b = await run();
  try {
    const index = b.read('index.html');
    const v = index.match(/assets\/js\/app\.js\?v=([0-9a-f]{10})"/)?.[1];
    assert.ok(v, 'app.js is versioned');
    assert.ok(index.includes(`assets/css/style.css?v=${v}"`));
    for (const f of ['app.js', 'store.js', 'tour.js']) {
      const imports = [...b.read('assets/js/' + f).matchAll(/from\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
      assert.ok(imports.length && imports.every(i => i.endsWith(`.js?v=${v}`)), `${f}: ${imports}`);
    }
  } finally { b.done(); }
});

test('robots.txt lets every crawler in and llms.txt lists every page of the sitemap', async () => {
  const b = await run();
  try {
    const robots = b.read('robots.txt'), llms = b.read('llms.txt'), sitemap = b.read('sitemap.xml');
    assert.match(robots, /^User-agent: \*\nAllow: \/\n/);
    assert.ok(!/Disallow/i.test(robots), 'nothing is blocked');
    assert.match(robots, /\nSitemap: https?:\/\/[^\s]+\/sitemap\.xml\n$/);
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    assert.ok(locs.length >= 6);
    for (const url of locs) assert.ok(llms.includes(`](${url})`), `llms.txt links ${url}`);
    assert.match(llms, /^# Planejador WiFi\n\n> /);
    for (const lastmod of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) assert.match(lastmod[1], /^\d{4}-\d{2}-\d{2}$/);
  } finally { b.done(); }
});

test('every indexable page has its own title and description, full hreflang, valid JSON-LD and is listed for crawlers', async () => {
  const b = await run(), dicts = loadDicts();
  const file = path => (path.endsWith('/') ? path + 'index.html' : path + '.html').slice(1);
  const attr = (html, re) => html.match(re)?.[1];
  try {
    const sitemap = b.read('sitemap.xml'), llms = b.read('llms.txt'), titles = new Map(), descriptions = new Map();
    for (const lang of LANGS) for (const page of INDEXED) {
      const path = dicts[lang].paths[page], url = SITE + path, where = `${page} (${lang})`, html = b.read(file(path));
      const title = attr(html, /<title>([^<]+)<\/title>/), description = attr(html, /<meta name="description" content="([^"]+)">/);
      assert.ok(title && description, `${where}: title and description`);
      assert.ok(!titles.has(title), `${where}: title also used by ${titles.get(title)}`);
      assert.ok(!descriptions.has(description), `${where}: description also used by ${descriptions.get(description)}`);
      titles.set(title, where); descriptions.set(description, where);
      assert.equal(attr(html, /<link rel="canonical" href="([^"]+)">/), url, `${where}: canonical`);
      const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g)].map(m => [m[1], m[2]]);
      assert.deepEqual(alternates, [...LANGS.map(l => [l, SITE + dicts[l].paths[page]]), ['x-default', SITE + dicts['pt-BR'].paths[page]]], `${where}: hreflang`);
      assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${where}: one h1`);
      assert.ok(!/<meta name="robots"[^>]*noindex/.test(html), `${where}: indexable`);
      assert.ok(sitemap.includes(`<loc>${url}</loc>`), `${where}: in the sitemap`);
      assert.ok(llms.includes(`](${url}):`), `${where}: in llms.txt`);
      const ld = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map(m => JSON.parse(m[1]));
      assert.ok(ld.length, `${where}: has JSON-LD`);
      for (const o of ld) assert.ok(o['@context'] === 'https://schema.org' && o['@type'], `${where}: JSON-LD ${o['@type']}`);
    }
    assert.ok(!sitemap.includes('404'), 'the 404 page stays out of the sitemap');
  } finally { b.done(); }
});

test('guide pages get the guide slots, the generated numbers and article data', async () => {
  const b = await run({ extensions: [demo] });
  try {
    const page = b.read('en/guides/where-to-put-wifi-router.html');
    for (const id of ['demo-guide', 'demo-after-guide', 'demo-footer', 'demo-end']) assert.ok(page.includes(`id="${id}"`), id);
    assert.ok(!/\{[a-z]+(\.\w+)*\}/.test(page.replace(/<script[\s\S]*?<\/script>/g, '')), 'every model token is filled');
    const types = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1])['@type']);
    assert.deepEqual(types, ['Article', 'BreadcrumbList', 'FAQPage']);
    assert.ok(!b.read('privacy.html'.replace(/^/, 'en/')).includes('demo-guide'), 'guide slots stay out of other pages');
  } finally { b.done(); }
});

test('the methodology page is an article with its sections and links to every guide', async () => {
  const b = await run();
  try {
    const page = b.read('en/methodology.html');
    const types = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1])['@type']);
    assert.deepEqual(types, ['Article', 'BreadcrumbList']);
    assert.ok(page.includes('href="/en/guides/wifi-signal-strength-dbm"'), 'page links are filled from paths');
    for (const guide of [...b.read('en/guides/index.html').matchAll(/<h2><a href="([^"]+)"/g)].map(m => m[1])) assert.ok(page.includes(`href="${guide}"`), guide);
  } finally { b.done(); }
});

test('every guide opens its example home in the planner of its language', async () => {
  const b = await run();
  try {
    const guides = [...b.read('es/guias/index.html').matchAll(/<h2><a href="\/es\/guias\/([^"]+)"/g)].map(m => m[1]);
    assert.equal(guides.length, 6);
    for (const slug of guides) {
      const page = b.read(`es/guias/${slug}.html`);
      const href = page.match(/<a class="btn" href="\/es\/#p=([\w-]+)">/);
      assert.ok(href, slug);
      const p = await decodeShare(href[1]);
      const nodes = p.floors.flatMap(f => f.nodes);
      assert.ok(page.includes(`El ejemplo: ${p.name[0].toLowerCase() + p.name.slice(1)}.`), `${slug}: the caption names the project`);
      assert.match(p.name, /^\p{Lu}/u, `${slug}: the project name starts with a capital`);
      assert.match(p.name, new RegExp(` ${nodes.length} nodos?$`), `${slug}: the name counts the nodes it opens with`);
      assert.equal(nodes.filter(n => n.main).length, 1, slug);
    }
  } finally { b.done(); }
});

test('the about page describes the project and links to the methodology and the privacy policy', async () => {
  const b = await run();
  try {
    const page = b.read('es/acerca-de.html');
    const ld = [...page.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
    assert.deepEqual(ld.map(o => o['@type']), ['AboutPage', 'BreadcrumbList']);
    assert.equal(ld[0].about['@type'], 'Organization');
    assert.ok(page.includes('<meta property="og:type" content="website">'));
    for (const path of ['/es/metodologia', '/es/privacidad', '/es/guias/']) assert.ok(page.includes(`href="${path}"`), path);
  } finally { b.done(); }
});

// The guides state these in words around the generated numbers; if the model changes enough to
// break one, rewrite the sentence (i18n guides.items.nodes) along with this test.
test('the example homes still support what the nodes guide says', () => {
  const c = id => coverage(id), first = id => c(id).steps[1];
  assert.equal(c('h120').need, 1, 'one node is enough up to the 120 m² house');
  assert.ok(c('h150').need >= 2 && c('h200').need > 1, 'a second node comes in after that');
  assert.ok(c('long').need > c('h150').need && first('long')[0] < first('h150')[0], 'a long house needs more than a square one of similar size');
  assert.equal(c('twoStory').need, 2, 'one node per floor in a two-story house');
  assert.ok(first('twoStory')[1] < TARGET, 'one node downstairs leaves the upper floor short');
  assert.ok(c('apartment').need >= 2, 'a small apartment with concrete walls may need two');
});
