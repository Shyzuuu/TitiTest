/**
 * Rejeu de longue durée et enregistrement volumineux.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { LabController } from '../../src/app/LabController.js';
import { MemoryStorage } from '../../src/storage/StorageAdapter.js';
import { DEFAULT_BUDGET_CHARS } from '../../src/storage/SaveManager.js';
import { RunRecorder } from '../../src/recorder/RunRecorder.js';
import { validateRun } from '../../src/recorder/RunValidator.js';
import { compareRuns } from '../../src/replay/ReplayComparator.js';
import { startArgs } from '../helpers/runs.mjs';

test('Run de 30 minutes simulées : sauvegardée dans le budget localStorage et rejouée exactement', () => {
  // Quota réaliste : le stockage refuse au-delà du budget d'un localStorage typique.
  const storage = new MemoryStorage({ quotaChars: DEFAULT_BUDGET_CHARS });
  const lab = new LabController({ storage }).init();
  lab.resources.enableUnlimited('both');
  lab.autopilot = true;
  lab.startRun({ record: true, seed: 30303, name: 'Run longue' });
  lab.advanceTicks(30 * 60 * 60);
  lab.autopilot = false;
  const rec = lab.stopRecording();
  assert.equal(rec.ok, true, rec.ok ? '' : rec.error);
  assert.equal(rec.run.meta.simDurationS, 1800);
  assert.ok(rec.summary.chars < DEFAULT_BUDGET_CHARS / 4, `taille ${rec.summary.chars} caractères`);
  assert.equal(storage.keys().filter((k) => k.includes(':draft:')).length, 0, 'brouillon supprimé après sauvegarde');
  lab.startReplay(rec.summary.id);
  lab.advanceTicks(Number.MAX_SAFE_INTEGER);
  const r = lab.lastReplayReport;
  assert.equal(r.exact, true, r.verdict);
  assert.equal(r.checkpoints.compared, 900);
});

test('Enregistrement volumineux (300 000 événements) : validation et comparaison en temps raisonnable', () => {
  const rec = new RunRecorder();
  rec.start(startArgs('run_big_000001'));
  rec.record('RUN_START', 0, 0, { seed: 99, speed: 1, physics: 1 });
  const types = ['JUMP', 'LANE_LEFT', 'LANE_RIGHT', 'SLIDE'];
  for (let i = 1; i < 300000; i++) {
    if (i % 3 === 0) rec.record('COIN', i, i, { id: i, n: i / 3 });
    else rec.record(types[i % 4], i, i, {});
  }
  const run = rec.stop({ tick: 300001, realMs: 300001, reason: 'stop', stats: { score: 0, distance: 0, coins: 0, keys: 0 } });
  let t = performance.now();
  assert.equal(validateRun(run).ok, true);
  const validateMs = performance.now() - t;
  t = performance.now();
  assert.equal(compareRuns(run, run).exact, true);
  const compareMs = performance.now() - t;
  console.log(`# 300 000 événements : validation ${validateMs.toFixed(0)} ms, comparaison ${compareMs.toFixed(0)} ms`);
  assert.ok(validateMs < 5000 && compareMs < 5000);
});
