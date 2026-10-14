/**
 * Scénarios A à E du cahier des charges, exécutés sur le vrai LabController
 * (le même objet que pilote l'interface).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LabController } from '../../src/app/LabController.js';
import { EVENT_TYPES } from '../../src/recorder/EventSchema.js';
import { MemoryStorage } from '../../src/storage/StorageAdapter.js';
import { fakeClock, makeLab, recordAutopilotRun, replayToEnd, runFrames } from '../helpers/fixtures.mjs';

test('Scénario A — run normale : voies, sauts, glissades, pièces, fin, score et distance', () => {
  const { lab, clock } = makeLab();
  lab.startRun({ seed: 2024 });
  assert.equal(lab.fsm.state, 'RUNNING');
  const w = lab.world;
  // Piste contrôlée : on vide les obstacles proches et on place des pièces sur le trajet.
  w.obstacles.length = 0;
  w.spawner.nextRowZ = 1e9;
  for (let i = 0; i < 20; i++) w.addCollectible('COIN', 1, 4 + i * 2, 0.7);
  const lanes = [];
  for (const a of ['LANE_LEFT', 'LANE_RIGHT', 'JUMP', 'SLIDE', 'LANE_RIGHT', 'LANE_LEFT', 'JUMP', 'SLIDE']) {
    assert.equal(lab.input(a).accepted, true);
    runFrames(lab, clock, 30);
    lanes.push(w.player.lane);
  }
  assert.deepEqual(lanes, [0, 1, 1, 1, 2, 1, 1, 1]);
  runFrames(lab, clock, 120);
  assert.ok(w.coinsRun > 0, 'pièces collectées');
  const summary = lab.finishRun();
  assert.equal(lab.fsm.state, 'FINISHED');
  assert.ok(summary.distance > 50);
  assert.ok(summary.score >= Math.floor(summary.distance));
  assert.equal(lab.resources.balance('coins'), w.coinsRun, 'gains crédités au portefeuille');
});

test('Scénario B — run ralentie : 1,00× → 0,50× → 0,10× → 1,00×, chronologie conservée', () => {
  const { lab, clock } = makeLab();
  lab.resources.enableUnlimited('both');
  lab.autopilot = true;
  lab.startRun({ record: true, seed: 31, name: 'Ralentie' });
  const ticks = [];
  for (const speed of [1, 0.5, 0.1, 1]) {
    lab.setSpeed(speed);
    const t0 = lab.globalTick;
    const z0 = lab.world.player.z;
    runFrames(lab, clock, 120); // 2 s réelles
    ticks.push(lab.globalTick - t0);
    assert.ok(lab.world.player.z >= z0, 'la position ne recule jamais');
  }
  assert.ok(Math.abs(ticks[0] - 120) <= 1 && Math.abs(ticks[1] - 60) <= 1 && Math.abs(ticks[2] - 12) <= 1 && Math.abs(ticks[3] - 120) <= 1, `pas : ${ticks}`);
  const r = lab.stopRecording();
  assert.equal(r.ok, true);
  const speeds = r.run.events.filter((e) => e[3] === 'SPEED_CHANGE').map((e) => e[4].to);
  assert.deepEqual(speeds, [0.5, 0.1, 1]);
  // Chronologie : séquences et ticks monotones, temps réel cohérent (8 s réelles pour 5,2 s simulées).
  let prev = -1;
  for (const e of r.run.events) {
    assert.ok(e[1] >= prev);
    prev = e[1];
  }
  assert.ok(Math.abs(r.run.meta.realDurationMs - 8000) < 100);
  assert.ok(Math.abs(r.run.meta.simDurationS - 5.2) < 0.05);
});

test('Scénario C — enregistrer, sauvegarder, fermer, relancer, charger, rejouer, comparer', () => {
  const storage = new MemoryStorage();
  const first = makeLab({ storage });
  const rec = recordAutopilotRun(first.lab, 60 * 60, { seed: 4242 });
  assert.equal(rec.ok, true);
  const id = rec.summary.id;
  // « Fermeture » : on abandonne l'instance ; « relance » : nouvelle instance sur le même stockage.
  const second = makeLab({ storage });
  assert.equal(second.lab.fsm.state, 'READY');
  assert.ok(second.lab.repo.summary(id));
  const info = second.lab.loadReplay(id);
  assert.equal(info.id, id);
  const report = replayToEnd(second.lab, id);
  assert.equal(second.lab.fsm.state, 'FINISHED');
  assert.equal(report.exact, true, report.verdict);
  assert.ok(report.totals.matched > 50);
  assert.equal(report.final.scoreDelta, 0);
  // Le rejeu ne crée ni ne modifie aucun enregistrement.
  assert.equal(second.lab.repo.index.length, 1);
  assert.equal(second.lab.repo.get(id).run.checksum, rec.run.checksum);
});

test('Scénario D — ressources illimitées : achats, persistance après redémarrage', () => {
  const storage = new MemoryStorage();
  const a = makeLab({ storage }).lab;
  a.resources.enableUnlimited('both');
  for (const id of ['UPGRADE_MAGNET', 'UPGRADE_DOUBLE', 'START_MAGNET', 'CHAR_NEON', 'CHAR_GOLD', 'HOVERBOARD_5']) assert.equal(a.shop.buy(id).ok, true, id);
  a.startRun({ seed: 5 });
  a.world.player.crashed = true;
  for (let i = 0; i < 6; i++) {
    a.revive();
    a.advanceTicks(1);
    a.world.player.crashed = true;
  }
  assert.equal(a.resources.balance('coins'), Infinity);
  assert.equal(a.resources.balance('keys'), Infinity);
  const b = makeLab({ storage }).lab;
  assert.equal(b.resources.mode('coins'), 'UNLIMITED');
  assert.equal(b.resources.mode('keys'), 'UNLIMITED');
  assert.equal(b.shop.profile.upgrades.MAGNET, 1);
  assert.ok(b.shop.profile.characters.includes('GOLD'));
  assert.equal(b.shop.profile.hoverboards, 5);
});

test('Scénario E — erreurs : fichier invalide, double REC, rejeu pendant REC, panne de sauvegarde', () => {
  const storage = new MemoryStorage();
  const { lab } = makeLab({ storage });
  assert.throws(() => lab.repo.importJson('{"pas":"une run"}'), /Import refusé/);
  assert.throws(() => lab.repo.importJson('not json'), /JSON invalide/);
  lab.startRun({ record: true, seed: 1 });
  assert.throws(() => lab.startRun({ record: true }), /déjà en cours/);
  assert.throws(() => lab.startReplay('run_inexistant_0001'), /pendant un enregistrement/);
  assert.equal(lab.capabilities().replay, false);
  assert.equal(lab.capabilities().record, false);
  lab.input('JUMP');
  lab.advanceTicks(200);
  storage.failNextWrites = 1000;
  const res = lab.stopRecording();
  assert.equal(res.ok, false);
  assert.match(res.error, /Échec|Quota|sauvegarde/);
  assert.ok(lab.unsavedRun, 'run conservée en mémoire');
  assert.equal(lab.fsm.state, 'FINISHED', 'le programme reste utilisable');
  storage.failNextWrites = 0;
  const retry = lab.retrySaveUnsaved();
  assert.equal(retry.ok, true);
  assert.equal(lab.unsavedRun, null);
  lab.startRun();
  assert.equal(lab.fsm.state, 'RUNNING');
});

test('Changement de vitesse à chaud : état, timers, enregistrement intacts', () => {
  const { lab, clock } = makeLab();
  lab.startRun({ record: true, seed: 77 });
  runFrames(lab, clock, 90);
  lab.world.powerups.MAGNET = 300;
  const before = { z: lab.world.player.z, lane: lab.world.player.lane, coins: lab.world.coinsRun, events: lab.recorder.eventCount, tick: lab.globalTick, mag: lab.world.powerups.MAGNET, hash: lab.world.stateHash() };
  lab.setSpeed(0.1);
  assert.equal(lab.world.stateHash(), before.hash, 'changer de vitesse ne touche pas l\'état simulé');
  lab.setSpeed(1);
  assert.equal(lab.world.player.z, before.z);
  assert.equal(lab.world.powerups.MAGNET, before.mag, 'timers non réinitialisés');
  assert.equal(lab.recorder.eventCount, before.events + 2, 'deux SPEED_CHANGE ajoutés, rien supprimé');
  assert.equal(lab.recorder.active, true);
  assert.equal(lab.fsm.state, 'RECORDING');
});

test('Pause : simulation gelée, entrées ignorées (politique), marqueurs PAUSE/RESUME', () => {
  const { lab, clock } = makeLab();
  lab.setSpeed(0.25);
  lab.startRun({ record: true, seed: 8 });
  runFrames(lab, clock, 60);
  lab.pause();
  const hash = lab.world.stateHash();
  const tick = lab.globalTick;
  assert.equal(lab.input('JUMP').accepted, false);
  runFrames(lab, clock, 120);
  assert.equal(lab.world.stateHash(), hash);
  assert.equal(lab.globalTick, tick);
  assert.equal(lab.stats.ignoredInputs, 1);
  lab.resume();
  assert.equal(lab.clock.multiplier, 0.25, 'multiplicateur restauré');
  runFrames(lab, clock, 60);
  assert.ok(lab.globalTick > tick);
  const r = lab.stopRecording();
  const types = r.run.events.map((e) => e[3]);
  assert.ok(types.includes('PAUSE') && types.includes('RESUME'));
  assert.ok(!types.slice(types.indexOf('PAUSE'), types.indexOf('RESUME')).includes('JUMP'), 'entrée ignorée non enregistrée');
});

test('Contrôles du rejeu : pause réelle, reprise, ralenti, arrêt, recommencer, entrées refusées', () => {
  const { lab, clock } = makeLab();
  const rec = recordAutopilotRun(lab, 1200, { seed: 99 });
  lab.startReplay(rec.summary.id);
  runFrames(lab, clock, 60);
  const t1 = lab.globalTick;
  assert.ok(t1 > 0);
  lab.pause();
  assert.equal(lab.fsm.state, 'REPLAY_PAUSED');
  runFrames(lab, clock, 60);
  assert.equal(lab.globalTick, t1, 'PAUSE arrête réellement la simulation');
  lab.resume();
  lab.setSpeed(0.1);
  assert.equal(lab.followOriginalSpeed, false);
  const t2 = lab.globalTick;
  runFrames(lab, clock, 60);
  assert.ok(lab.globalTick - t2 <= 7, 'ralenti appliqué au rejeu');
  assert.equal(lab.input('JUMP').accepted, false);
  assert.throws(() => lab.restart(), /rejeu/);
  const partial = lab.stopReplay();
  assert.equal(lab.fsm.state, 'READY');
  assert.equal(partial.partial, true);
  assert.equal(partial.exact, true, partial.verdict);
  lab.restartReplay();
  assert.equal(lab.globalTick, 0);
  lab.setSpeed(1);
  lab.advanceTicks(1e9);
  assert.equal(lab.fsm.state, 'FINISHED');
  assert.equal(lab.lastReplayReport.exact, true);
});

test('Rejeu : divergence détectée si la run a été altérée de façon cohérente', () => {
  const { lab } = makeLab();
  const rec = recordAutopilotRun(lab, 1500, { seed: 1234 });
  const run = structuredClone(rec.run);
  // Altération « valide » : on retire une action et on recalcule l'empreinte (fichier bien formé mais différent).
  const idx = run.events.findIndex((e, i) => i > 5 && EVENT_TYPES[e[3]].category === 'action');
  run.events.splice(idx, 1);
  run.events.forEach((e, i) => (e[0] = i));
  run.meta.eventCount = run.events.length;
  run.id = 'run_altered_0001';
  return import('../../src/recorder/RunValidator.js').then(({ computeChecksum }) => {
    run.checksum = computeChecksum(run);
    lab.repo.save(run);
    const report = replayToEnd(lab, run.id);
    assert.equal(report.exact, false);
    assert.ok(report.totals.missing + report.totals.extra + report.totals.payloadDiffs + report.totals.timingDiffs > 0);
    assert.ok(report.firstDivergence);
  });
});

test('Erreur de simulation : sauvegarde de secours puis retour à un état cohérent', () => {
  const { lab } = makeLab();
  lab.startRun({ record: true, seed: 3 });
  lab.advanceTicks(100);
  lab.world.step = () => {
    throw new Error('panne simulée');
  };
  lab.advanceTicks(1);
  assert.equal(lab.fsm.state, 'ERROR');
  assert.equal(lab.repo.index.length, 1, 'la run partielle a été sauvegardée');
  const { run } = lab.repo.get(lab.repo.index[0].id);
  assert.ok(run.events.some((e) => e[3] === 'SIM_ERROR'));
  lab.recover();
  assert.equal(lab.fsm.state, 'READY');
});

test('Récupération au lancement d\'un enregistrement interrompu (fermeture brutale)', () => {
  const storage = new MemoryStorage();
  const clock = fakeClock();
  const a = new LabController({ storage, now: clock.now, recorderOptions: { flushEvery: 50 } }).init();
  a.autopilot = true;
  a.resources.enableUnlimited('both');
  a.startRun({ record: true, seed: 66 });
  a.advanceTicks(2000);
  a.recorder.flushDraft();
  // Pas de stopRecording : l'onglet est « tué ».
  const b = new LabController({ storage, now: clock.now }).init();
  assert.equal(b.repo.index.length, 1);
  assert.equal(b.repo.index[0].integrity, 'recovered');
  assert.ok(b.drainNotices().some((n) => /récupéré/.test(n.message)));
  const report = replayToEnd(b, b.repo.index[0].id);
  assert.equal(report.totals.missing + report.totals.extra + report.totals.payloadDiffs, 0, report.verdict);
});
