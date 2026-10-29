import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build, applyBlocks, SLOTS } from '../scripts/build.mjs';

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
