import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReplayEngine } from '../../src/replay/ReplayEngine.js';
import { compareRuns, formatReport } from '../../src/replay/ReplayComparator.js';
import { buildRun } from '../helpers/runs.mjs';

test('ReplayEngine : refuse une run invalide', () => {
  const e = new ReplayEngine();
  assert.throws(() => e.load({ format: 'x' }), /non rejouable/);
  const bad = buildRun();
  bad.events[1][4] = { hack: 1 };
  assert.throws(() => e.load(bad));
  assert.equal(e.loaded, false);
});

test('ReplayEngine : actions dans l\'ordre, au bon pas, vitesses et progression', () => {
  const e = new ReplayEngine();
  const info = e.load(buildRun());
  assert.equal(info.actionCount, 2);
  assert.equal(info.endTick, 30);
  const buf = [];
  const seen = [];
  for (let t = 0; t < 30; t++) {
    for (const a of e.takeActionsAt(t, buf)) seen.push([t, a[3]]);
    const sp = e.takeSpeedAt(t);
    if (sp !== null) seen.push([t, `speed ${sp}`]);
  }
  assert.deepEqual(seen, [[5, 'JUMP'], [6, 'speed 0.25'], [20, 'LANE_LEFT']]);
  assert.equal(e.progress(15), 0.5);
  assert.equal(e.isFinished(29), false);
  assert.equal(e.isFinished(30), true);
  e.rewind();
  assert.equal(e.takeActionsAt(5, buf).length, 1, 'rembobinage');
});

test('ReplayEngine : vérification en direct des points de contrôle', () => {
  const e = new ReplayEngine();
  const run = buildRun();
  e.load(run);
  e.expectedCheckpoints.set(119, { wt: 120, d: 10, s: 5, x: 0, y: 0, ln: 1, c: 0, k: 0, h: 'aaaaaaaa' });
  assert.equal(e.checkCheckpoint(119, { wt: 120, d: 10, s: 5, x: 0, y: 0, ln: 1, c: 0, k: 0, h: 'aaaaaaaa' }), null);
  const div = e.checkCheckpoint(119, { wt: 120, d: 10, s: 6, x: 0, y: 0, ln: 1, c: 0, k: 0, h: 'bbbbbbbb' });
  assert.match(div.detail, /s: 5 → 6/);
  assert.equal(e.divergenceCount, 1);
});

test('ReplayComparator : identique ⇒ exact', () => {
  const r = compareRuns(buildRun(), buildRun());
  assert.equal(r.exact, true);
  assert.equal(r.totals.missing + r.totals.extra + r.totals.timingDiffs + r.totals.payloadDiffs, 0);
  assert.ok(formatReport(r)[0].includes('exacte'));
});

test('ReplayComparator : manquants, supplémentaires, écarts temporels, données, état, final', () => {
  const a = buildRun();
  const b = structuredClone(a);
  b.events = b.events.filter((e) => e[3] !== 'LANE_LEFT'); // manquant
  b.events.splice(2, 0, [0, 7, 0, 'SLIDE', {}]); // supplémentaire
  b.events.find((e) => e[3] === 'JUMP')[1] = 6; // écart temporel
  b.events.find((e) => e[3] === 'COIN')[4] = { id: 4, n: 1 }; // données
  a.events.splice(5, 0, [0, 25, 0, 'CHECKPOINT', { wt: 25, d: 1, s: 1, x: 0, y: 0, ln: 1, c: 0, k: 0, h: '11111111' }]);
  b.events.push([0, 25, 0, 'CHECKPOINT', { wt: 25, d: 1.5, s: 3, x: 2.4, y: 0, ln: 2, c: 0, k: 0, h: '22222222' }]);
  b.meta = { ...b.meta, score: 60 };
  const r = compareRuns(a, b);
  assert.equal(r.exact, false);
  assert.equal(r.totals.missing, 1);
  assert.equal(r.totals.extra, 1);
  assert.equal(r.totals.timingDiffs, 1);
  assert.equal(r.totals.maxTimingTicks, 1);
  assert.equal(r.totals.payloadDiffs, 2, 'pièce + point de contrôle');
  assert.equal(r.checkpoints.mismatched, 1);
  assert.ok(Math.abs(r.checkpoints.maxPositionDelta - 2.4) < 1e-9);
  assert.equal(r.checkpoints.maxScoreDelta, 2);
  assert.equal(r.final.scoreDelta, 10);
  assert.equal(r.firstDivergence.tick, 5);
});

test('ReplayComparator : comparaison partielle limitée au point d\'arrêt', () => {
  const a = buildRun();
  const b = structuredClone(a);
  b.events = b.events.filter((e) => e[1] < 12);
  const r = compareRuns(a, b, { untilTick: 12 });
  assert.equal(r.exact, true);
  assert.equal(r.partial, true);
  assert.equal(r.final.compared, false);
});
