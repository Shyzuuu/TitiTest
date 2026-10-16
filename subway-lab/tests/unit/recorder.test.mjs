import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RunRecorder } from '../../src/recorder/RunRecorder.js';
import { validateRun, computeChecksum } from '../../src/recorder/RunValidator.js';
import { toVerboseEvent, fromVerboseEvent, validateEventTuple, createRunId, RUN_ID_PATTERN } from '../../src/recorder/EventSchema.js';
import { buildRun, startArgs } from '../helpers/runs.mjs';
import { SaveManager } from '../../src/storage/SaveManager.js';
import { MemoryStorage } from '../../src/storage/StorageAdapter.js';

test('RunRecorder : démarrage, ordre stable, arrêt et métadonnées', () => {
  const run = buildRun();
  assert.equal(run.events.length, 6);
  run.events.forEach((e, i) => assert.equal(e[0], i));
  assert.equal(run.events.at(-1)[3], 'RUN_END');
  assert.equal(run.meta.endTick, 30);
  assert.equal(run.meta.eventCount, 6);
  assert.equal(run.meta.simDurationS, 0.5);
  const v = validateRun(run);
  assert.equal(v.ok, true, v.errors.join(' '));
});

test('RunRecorder : refuse un second démarrage et un enregistrement inactif', () => {
  const r = new RunRecorder();
  r.start(startArgs());
  assert.throws(() => r.start(startArgs()), /déjà en cours/);
  r.abort();
  assert.throws(() => r.record('JUMP', 0, 0, {}), /Aucun enregistrement/);
});

test('RunRecorder : le temps ne recule jamais (tick et temps réel monotones)', () => {
  const r = new RunRecorder();
  r.start(startArgs());
  r.record('RUN_START', 0, 0, { seed: 99, speed: 1, physics: 1 });
  r.record('JUMP', 10, 500, {});
  const e = r.record('SLIDE', 5, 100, {});
  assert.equal(e[1], 10);
  assert.equal(e[2], 500);
});

test('RunRecorder : vidage incrémental par morceaux (pas de réécriture complète)', () => {
  const storage = new MemoryStorage();
  const sm = new SaveManager(storage);
  const r = new RunRecorder({ saveManager: sm, flushEvery: 10, flushIntervalMs: 1e9 });
  r.start(startArgs());
  r.record('RUN_START', 0, 0, { seed: 99, speed: 1, physics: 1 });
  for (let i = 1; i <= 35; i++) r.record('JUMP', i, i, {});
  const chunks = sm.list('draft:run_test_0001:c');
  assert.equal(chunks.length, 3);
  const sizes = chunks.map((c) => JSON.parse(storage.getItem(`sslab:${c}`)).length);
  assert.deepEqual(sizes, [10, 10, 10], 'chaque morceau ne contient que les nouveaux événements');
  assert.equal(r.pendingCount, 6);
});

test('RunRecorder : récupération d\'un brouillon après fermeture brutale', () => {
  const storage = new MemoryStorage();
  const sm = new SaveManager(storage);
  const r = new RunRecorder({ saveManager: sm, flushEvery: 5, flushIntervalMs: 1e9 });
  r.start(startArgs('run_crash_0001'));
  r.record('RUN_START', 0, 0, { seed: 99, speed: 1, physics: 1 });
  for (let i = 1; i <= 12; i++) r.record(i % 2 ? 'JUMP' : 'SLIDE', i * 3, i * 50, {});
  r.record('CHECKPOINT', 40, 700, { wt: 40, d: 9.5, s: 12, x: 0, y: 0, ln: 1, c: 2, k: 0, h: '0123abcd' });
  r.record('JUMP', 41, 710, {}); // dernier pas potentiellement incomplet : écarté à la récupération
  r.flushDraft();
  // « Crash » : on abandonne l'objet sans stop() ; un morceau tronqué est ajouté.
  storage.setItem('sslab:draft:run_crash_0001:c000099', '[[999,');
  const { runs, errors } = RunRecorder.recoverDrafts(sm);
  assert.equal(errors.length, 0);
  assert.equal(runs.length, 1);
  const rec = runs[0];
  assert.equal(rec.meta.recovered, true);
  assert.equal(rec.events.length, 15, 'RUN_START + 12 + CHECKPOINT + RUN_END');
  assert.equal(rec.meta.score, 12);
  assert.equal(rec.meta.endTick, 41);
  assert.equal(validateRun(rec).ok, true);
});

test('RunRecorder : échec d\'écriture du brouillon → événements conservés en mémoire', () => {
  const storage = new MemoryStorage();
  const sm = new SaveManager(storage);
  const r = new RunRecorder({ saveManager: sm, flushEvery: 2, flushIntervalMs: 1e9 });
  r.start(startArgs());
  storage.failNextWrites = 100;
  r.record('RUN_START', 0, 0, { seed: 99, speed: 1, physics: 1 });
  r.record('JUMP', 1, 1, {});
  r.record('JUMP', 2, 2, {});
  assert.ok(r.draftError);
  storage.failNextWrites = 0;
  const run = r.stop({ tick: 3, realMs: 3, reason: 'stop', stats: { score: 0, distance: 0, coins: 0, keys: 0 } });
  assert.equal(run.events.length, 4);
  assert.equal(validateRun(run).ok, true);
});

test('RunValidator : détecte corruption, troncature, ordre, types, champs injectés, version', () => {
  const ok = buildRun();
  const mutate = (fn) => {
    const r = structuredClone(ok);
    fn(r);
    return validateRun(r);
  };
  assert.match(mutate((r) => (r.events[3][4].n = 7)).errors.join(), /intégrité/);
  assert.match(mutate((r) => r.events.pop()).errors.join(), /RUN_END|eventCount|tronquée/);
  assert.match(mutate((r) => (r.events[2][0] = 9)).errors.join(), /séquence/);
  assert.match(mutate((r) => (r.events[4][1] = 1)).errors.join(), /antérieur/);
  assert.match(mutate((r) => (r.events[2][3] = 'EVAL')).errors.join(), /type inconnu/);
  assert.match(mutate((r) => (r.events[1][4] = { code: 'alert(1)' })).errors.join(), /inattendu/);
  assert.match(mutate((r) => (r.version = 99)).errors.join(), /inconnue/);
  assert.match(mutate((r) => (r.format = 'autre')).errors.join(), /Format/);
  assert.match(mutate((r) => (r.id = '../etc')).errors.join(), /Identifiant/);
  assert.match(mutate((r) => (r.setup.seed = -4)).errors.join(), /Graine/);
  assert.match(mutate((r) => (r.events[3][2] = -1)).errors.join(), /temps réel/);
  assert.equal(validateRun(null).ok, false);
  assert.equal(validateRun([]).ok, false);
  const big = structuredClone(ok);
  big.events = { length: 2e6 };
  assert.equal(validateRun(big).ok, false);
});

test('RunValidator : migration v0 (événements verbeux) → v1', () => {
  const v1 = buildRun();
  const v0 = structuredClone(v1);
  v0.version = 0;
  v0.events = v1.events.map(toVerboseEvent);
  delete v0.setup.physicsVersion;
  delete v0.setup.initialHash;
  const res = validateRun(v0);
  assert.equal(res.ok, true, res.errors.join(' '));
  assert.equal(res.migratedFrom, 0);
  assert.deepEqual(res.run.events, v1.events);
});

test('EventSchema : forme verbeuse documentée et identifiants', () => {
  const e = [12, 270, 7200, 'LANE_LEFT', {}];
  const v = toVerboseEvent(/** @type {any} */ (e));
  assert.deepEqual(v, { sequence: 12, simulationTime: 4.5, realTime: 7.2, type: 'LANE_LEFT', payload: {} });
  assert.deepEqual(fromVerboseEvent(v), e);
  assert.equal(validateEventTuple(e, 0), null);
  assert.match(createRunId(), RUN_ID_PATTERN);
  assert.equal(computeChecksum(buildRun()), buildRun().checksum, 'empreinte indépendante de l\'instance');
});
