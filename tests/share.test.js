import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_MODELS } from '../assets/js/engine.js';
import { encodeShare, decodeShare, normalizeProject, exampleProject, SHARE_MAX } from '../assets/js/store.js';

const ids = new Set(BUILTIN_MODELS.map(m => m.id));
const builtins = Object.fromEntries(BUILTIN_MODELS.map(m => [m.id, m]));

test('a project link brings back the same plan, without the background image', async () => {
  const p = normalizeProject(exampleProject(), ids);
  p.floors[0].bg = { src: 'data:image/png;base64,AAAA', mpp: 0.02, alpha: 0.5 };
  p.floors[0].nodes[1].wired = true;
  const code = await encodeShare(p, builtins);
  assert.match(code, /^[\w-]+$/, 'base64url, safe in a fragment');
  assert.ok(code.length < 1500, `the example house fits in a short link (${code.length})`);
  const back = normalizeProject(await decodeShare(code), ids);
  for (const k of ['name', 'w', 'h', 'band']) assert.equal(back[k], p[k], k);
  const withoutImage = ({ bg, ...f }) => f;
  assert.equal(back.floors[0].bg, null);
  assert.deepEqual(withoutImage(back.floors[0]), withoutImage(p.floors[0]));
});

test('custom models travel in the link and positions keep centimeters', async () => {
  const custom = { id: 'c_test', name: 'Meu roteador', short: 'Meu', bands: ['2.4', '5'], adj: -3 };
  const p = normalizeProject({ name: 'Casa', floors: [{ walls: [{ x1: 1.234567, y1: 1, x2: 5, y2: 1, m: 'tijolo' }], nodes: [{ x: 2, y: 2, model: 'c_test', main: true }], labels: [] }] }, new Set([...ids, 'c_test']));
  const back = await decodeShare(await encodeShare(p, { ...builtins, c_test: custom }));
  assert.equal(back.floors[0].walls[0].x1, 1.23);
  assert.equal(back.models.length, 1);
  assert.equal(back.models[0].name, 'Meu roteador');
  assert.equal(back.floors[0].nodes[0].model, 'c_test');
});

test('a broken or foreign link is refused', async () => {
  const code = await encodeShare(normalizeProject(exampleProject(), ids), builtins);
  await assert.rejects(decodeShare(code.slice(0, code.length / 2)));
  await assert.rejects(decodeShare('not-a-project'));
  await assert.rejects(decodeShare(''));
});

test('a link that inflates to a huge text is refused', async () => {
  const big = new TextEncoder().encode(JSON.stringify({ v: 1, f: [], n: 'x'.repeat(3 << 20) }));
  const z = new Uint8Array(await new Response(new Blob([big]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  const code = btoa(String.fromCharCode(...z)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  assert.ok(code.length < SHARE_MAX);
  await assert.rejects(decodeShare(code));
});
