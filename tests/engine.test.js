import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../assets/js/engine.js';
import { normalizeProject, normalizeModel, exampleProject, withModels, blankProject } from '../assets/js/store.js';

const MODELS = Object.fromEntries(E.BUILTIN_MODELS.map(m => [m.id, m]));
const IDS = new Set(Object.keys(MODELS));
const room = (walls = [], nodes = []) => normalizeProject({ w: 20, h: 10, floors: [{ walls, nodes }] }, IDS);
const node = (x, y, model = 'be25') => ({ x, y, model, main: true });

test('hit detects crossing and ignores parallel segments', () => {
  assert.equal(E.hit(0, 0, 10, 0, 5, -1, 5, 1), true);
  assert.equal(E.hit(0, 0, 10, 0, 0, 1, 10, 1), false);
  assert.equal(E.hit(0, 0, 4, 0, 5, -1, 5, 1), false);
});

test('signal drops with distance', () => {
  const p = room([], [node(1, 5)]);
  const an = E.nodesAll(p)[0];
  assert.ok(E.sig(p, MODELS, an, 3, 5, 0, '5') > E.sig(p, MODELS, an, 12, 5, 0, '5'));
});

test('each wall subtracts its material loss for the band', () => {
  const open = room([], [node(1, 5)]);
  const walled = room([{ x1: 5, y1: 0, x2: 5, y2: 10, m: 'tijolo' }], [node(1, 5)]);
  for (const [bk, b] of Object.entries(E.BANDS)) {
    if (!MODELS.be65.bands.includes(bk)) continue;
    open.floors[0].nodes[0].model = walled.floors[0].nodes[0].model = 'be65';
    const a = E.sig(open, MODELS, E.nodesAll(open)[0], 10, 5, 0, bk);
    const w = E.sig(walled, MODELS, E.nodesAll(walled)[0], 10, 5, 0, bk);
    assert.ok(Math.abs(a - w - E.MATERIALS.tijolo.db[b.i]) < 1e-9, `band ${bk}`);
  }
});

test('a model without 6 GHz gives no 6 GHz signal', () => {
  const p = room([], [node(1, 5, 'be25')]);
  assert.equal(E.sig(p, MODELS, E.nodesAll(p)[0], 3, 5, 0, '6'), -Infinity);
  assert.equal(E.stats(p, MODELS, 0, '6').hasBand, false);
});

test('other floors add slab loss', () => {
  const p = normalizeProject({ w: 10, h: 10, floors: [{ nodes: [node(5, 5)] }, {}] }, IDS);
  const an = E.nodesAll(p)[0];
  assert.ok(E.sig(p, MODELS, an, 5, 5, 1, '5') < E.sig(p, MODELS, an, 5, 5, 0, '5') - E.SLAB[1]);
});

test('stats of the example house are consistent', () => {
  const p = normalizeProject(exampleProject(), IDS);
  const s = E.stats(p, MODELS, 0, '5');
  assert.equal(s.counts.reduce((a, b) => a + b, 0), s.n);
  assert.ok(s.good > 0.3 && s.good <= 1);
});

test('suggest finds a point that improves a long house', () => {
  const walls = [
    { x1: 0, y1: 0, x2: 20, y2: 0, m: 'tijolo' }, { x1: 20, y1: 0, x2: 20, y2: 10, m: 'tijolo' },
    { x1: 20, y1: 10, x2: 0, y2: 10, m: 'tijolo' }, { x1: 0, y1: 10, x2: 0, y2: 0, m: 'tijolo' },
    { x1: 7, y1: 0, x2: 7, y2: 10, m: 'concreto' }, { x1: 14, y1: 0, x2: 14, y2: 10, m: 'concreto' },
  ];
  const p = room(walls, [node(2, 5)]);
  const s = E.suggest(p, MODELS, 0, '5', 'be25');
  assert.ok(!s.none, s.none);
  assert.ok(s.to > s.from);
  assert.ok(s.x > 7, 'should land beyond the first concrete wall');
});

test('suggestSteps reports rising progress and ends with the same result as suggest', () => {
  const walls = [{ x1: 6, y1: 0, x2: 6, y2: 10, m: 'concreto' }, { x1: 12, y1: 0, x2: 12, y2: 10, m: 'concreto' }];
  const p = room(walls, [node(2, 5)]);
  const it = E.suggestSteps(p, MODELS, 0, '5', 'be25');
  let r = it.next(), last = -1, steps = 0;
  while (!r.done) {
    assert.ok(r.value >= last && r.value <= 1, 'progress stays between 0 and 1 and never goes back');
    last = r.value; steps++; r = it.next();
  }
  assert.ok(steps > 10);
  assert.deepEqual(r.value, E.suggest(p, MODELS, 0, '5', 'be25'));
});

test('topology marks wired nodes and links the rest to a neighbour', () => {
  const p = room([], [node(2, 5), { x: 10, y: 5, model: 'be25', wired: true }, { x: 18, y: 5, model: 'be25' }]);
  const t = E.topology(p, MODELS);
  assert.equal(t.length, 2);
  assert.equal(t[0].wired, true);
  assert.equal(t[1].parent, 1, 'third node links to the nearest one');
});

test('topology reaches the main node even when two satellites prefer each other', () => {
  const concrete = [{ x1: 8, y1: 0, x2: 8, y2: 10, m: 'concreto' }, { x1: 11, y1: 0, x2: 11, y2: 10, m: 'concreto' }];
  const p = room(concrete, [node(2, 5), { x: 15, y: 5, model: 'be25' }, { x: 16, y: 5, model: 'be25' }]);
  const t = E.topology(p, MODELS);
  assert.equal(t.length, 2);
  const parent = Object.fromEntries(t.map(l => [l.child, l.parent]));
  for (const start of [1, 2]) {
    let i = start, hops = 0;
    while (i !== 0 && hops < 5) { i = parent[i]; hops++; }
    assert.equal(i, 0, `node ${start} reaches the main node`);
  }
  assert.ok(E.weakLinks(p, MODELS).length >= 1, 'the link through two concrete walls is weak');
});

test('suggest reports a weak backhaul link when no spot helps', () => {
  const box = [[0, 0, 20, 0], [20, 0, 20, 10], [20, 10, 0, 10], [0, 10, 0, 0]].map(([x1, y1, x2, y2]) => ({ x1, y1, x2, y2, m: 'gesso' }));
  const p = room([...box, { x1: 9, y1: 0, x2: 9, y2: 10, m: 'concreto' }, { x1: 10, y1: 0, x2: 10, y2: 10, m: 'concreto' }],
    [node(4, 5), { x: 15, y: 5, model: 'be25' }]);
  const s = E.suggest(p, MODELS, 0, '5', 'be25');
  assert.equal(s.none, 'weakLink');
  assert.deepEqual([s.child, s.parent], [1, 0]);
});

test('link quality follows the rounded dBm shown to the user', () => {
  assert.equal(E.linkCat(-70.3), 2);
  assert.equal(E.linkCat(-70.6), 4);
});

test('normalizeProject repairs bad input', () => {
  const p = normalizeProject({ w: 999, band: 'x', floors: [{ walls: [{ x1: 0, y1: 0, x2: 1, y2: 1, m: 'lava' }], nodes: [{ x: 1, y: 1, model: 'nope' }, { x: 2, y: 2, model: 'be65', main: true }, { x: 3, y: 3, model: 'be65', main: true }] }] }, IDS);
  assert.equal(p.w, 80);
  assert.equal(p.band, '5');
  assert.equal(p.floors[0].walls.length, 0);
  assert.equal(p.floors[0].nodes[0].model, 'be25');
  assert.equal(p.floors[0].nodes.filter(n => n.main).length, 1);
  assert.equal(normalizeProject(null, IDS).floors.length, 1);
});

test('custom models validate and travel with the project', () => {
  assert.equal(normalizeModel({ id: 'c1', name: 'X', bands: [] }), null);
  const m = normalizeModel({ id: 'c1', name: 'Asus BT8', bands: ['6', '2.4', 'x'], adj: 40 });
  assert.deepEqual(m.bands, ['2.4', '6']);
  assert.equal(m.adj, 10);
  const models = { ...MODELS, c1: m };
  const p = blankProject();
  p.floors[0].nodes.push({ x: 1, y: 1, model: 'c1', main: true });
  assert.deepEqual(withModels(p, models).models.map(x => x.id), ['c1']);
});
