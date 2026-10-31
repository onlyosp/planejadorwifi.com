import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The build reads SITE_URL and PRIVACY_URL when it loads, so this file loads its own copy of it.
process.env.SITE_URL = 'https://example.com/wifi/';
process.env.PRIVACY_URL = 'https://example.com/privacidade';
const { build, loadDicts, INDEXED, LANGS } = await import('../scripts/build.mjs?base');
delete process.env.SITE_URL;
delete process.env.PRIVACY_URL;

const files = dir => readdirSync(dir).flatMap(n => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));

test('a site below a path keeps every page, file and link below it', async () => {
  const out = mkdtempSync(join(tmpdir(), 'planejador-base-'));
  try {
    await build({ outDir: out, env: {}, extensions: [] });
    const dicts = loadDicts(), read = f => readFileSync(join(out, f), 'utf8');
    assert.deepEqual(readdirSync(out), ['wifi'], 'nothing at the host root');
    assert.ok(!existsSync(join(out, 'wifi/robots.txt')), 'no robots.txt: only the host root can serve one');
    for (const f of ['index.html', 'en/index.html', 'es/index.html', 'sitemap.xml', 'llms.txt', 'site.webmanifest', 'assets/css/style.css', '404.html']) {
      assert.ok(existsSync(join(out, 'wifi', f)), f);
    }

    assert.ok(!INDEXED.includes('privacy') && !existsSync(join(out, 'wifi/politica-de-privacidade.html')), 'no privacy page of its own');
    for (const lang of LANGS) assert.equal(dicts[lang].paths.privacy, 'https://example.com/privacidade');

    for (const f of files(out).filter(f => f.endsWith('.html'))) {
      const html = readFileSync(f, 'utf8'), where = f.slice(out.length);
      for (const [, url] of html.matchAll(/(?:href|src|content|value)="(\/[^"]*)"/g)) {
        assert.ok(url.startsWith('/wifi/'), `${where}: ${url} is outside /wifi/`);
      }
      for (const [, url] of html.matchAll(/(?:href|content)="(https:\/\/example\.com[^"]*)"/g)) {
        assert.ok(url.startsWith('https://example.com/wifi/') || url === 'https://example.com/privacidade', `${where}: ${url}`);
      }
    }

    const index = read('wifi/index.html');
    assert.ok(index.includes('<link rel="canonical" href="https://example.com/wifi/">'));
    assert.ok(index.includes('href="https://example.com/privacidade"'), 'the footer links to the outside privacy policy');
    assert.match(index, /\{"en":"\/wifi\/en\/","es":"\/wifi\/es\/"\}\[p\]/, 'the language redirect stays below /wifi');
    assert.match(index, /src="\/wifi\/assets\/js\/app\.js\?v=\w+"/, 'scripts are fingerprinted below /wifi');
    const sitemap = read('wifi/sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    assert.equal(locs.length, LANGS.length * INDEXED.length);
    assert.ok(locs.includes('https://example.com/wifi/') && locs.every(u => u.startsWith('https://example.com/wifi/')));
    assert.ok(!sitemap.includes('privacidade'));
    assert.ok(read('wifi/llms.txt').includes('(https://example.com/wifi/en/)'));
    assert.ok(read('wifi/assets/css/style.css').includes('url(../fonts/'), 'fonts load relative to the stylesheet');
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});
