/**
 * Régressions de déterminisme : ces tests protègent la fidélité du rejeu.
 * Si « empreinte de référence » échoue après une modification volontaire de la
 * physique ou du générateur, incrémenter PHYSICS_VERSION puis mettre à jour GOLDEN.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameWorld } from '../../src/game/GameWorld.js';
import { defaultRunConfig } from '../../src/game/runConfig.js';
import { PHYSICS_VERSION } from '../../src/game/constants.js';
import { makeLab, recordAutopilotRun, replayToEnd, runFrames, scriptedAction } from '../helpers/fixtures.mjs';

const GOLDEN = { physics: 2, hash: 'c2a2c94b' };

test('Empreinte de référence de la physique (graine et entrées fixes)', () => {
  const w = new GameWorld({ seed: 20261014, config: defaultRunConfig() });
  for (let i = 0; i < 3000; i++) {
    if (i % 45 === 0) w.applyAction(scriptedAction(i / 45));
    if (w.player.crashed) w.applyAction('REVIVE');
    w.step();
  }
  assert.equal(PHYSICS_VERSION, GOLDEN.physics);
  assert.equal(w.stateHash(), GOLDEN.hash);
});

test('Le profil de vitesse (enregistrement comme rejeu) n\'influence jamais le résultat', () => {
  const { lab, clock } = makeLab();
  lab.resources.enableUnlimited('both');
  lab.autopilot = true;
  lab.startRun({ record: true, seed: 5150 });
  // Enregistrement en images réelles avec changements de vitesse fréquents.
  const profile = [1, 0.1, 0.75, 0.25, 1, 0.5, 0.1, 1];
  for (const s of profile) {
    lab.setSpeed(s);
    runFrames(lab, clock, 90);
  }
  lab.autopilot = false;
  const rec = lab.stopRecording();
  assert.equal(rec.ok, true);
  const finalHash = rec.run.events.filter((e) => e[3] === 'CHECKPOINT').at(-1)?.[4].h;
  // Rejeu à vitesse constante 1,00× via images, puis à 0,10× : même résultat que l'original.
  for (const replaySpeed of [1, 0.1]) {
    lab.startReplay(rec.summary.id);
    lab.setSpeed(replaySpeed);
    let guard = 0;
    while (lab.fsm.state === 'REPLAYING' && guard++ < 100000) runFrames(lab, clock, 1);
    assert.equal(lab.lastReplayReport.exact, true, `${replaySpeed}× : ${lab.lastReplayReport.verdict}`);
  }
  assert.ok(finalHash);
});

test('Redémarrage (R) pendant un enregistrement : rejoué à l\'identique', () => {
  const { lab } = makeLab();
  lab.startRun({ record: true, seed: 11 });
  lab.advanceTicks(200);
  lab.input('LANE_LEFT');
  lab.advanceTicks(50);
  lab.restart();
  lab.input('JUMP'); // arrivée après R : appliquée au même pas que le redémarrage, après lui
  lab.advanceTicks(300);
  const rec = lab.stopRecording();
  const types = rec.run.events.map((e) => e[3]);
  assert.ok(types.includes('RESTART'));
  assert.ok(types.indexOf('JUMP') > types.indexOf('RESTART'));
  assert.equal(replayToEnd(lab, rec.summary.id).exact, true);
});

test('Résurrection pendant un enregistrement : gratuite au rejeu, rejouée à l\'identique', () => {
  const { lab } = makeLab();
  lab.resources.setCustom('keys', 3);
  lab.startRun({ record: true, seed: 404 });
  let guard = 0;
  while (!lab.world.player.crashed && guard++ < 20000) lab.advanceTicks(1);
  assert.equal(lab.world.player.crashed, true, 'collision attendue sans entrée');
  lab.revive();
  lab.advanceTicks(240);
  const rec = lab.stopRecording();
  assert.equal(lab.resources.balance('keys'), 2 + lab.world.keysRun, '1 clé dépensée à l\'enregistrement');
  const keysBefore = lab.resources.balance('keys');
  const report = replayToEnd(lab, rec.summary.id);
  assert.equal(report.exact, true, report.verdict);
  assert.equal(lab.resources.balance('keys'), keysBefore, 'le rejeu ne dépense ni ne crédite rien');
});

test('La configuration figée dans la run prime sur le profil courant', () => {
  const { lab } = makeLab();
  lab.resources.enableUnlimited('both');
  lab.shop.buy('START_MAGNET');
  lab.shop.buy('UPGRADE_MAGNET');
  const rec = recordAutopilotRun(lab, 1500, { seed: 909 });
  assert.equal(rec.run.setup.config.startBonus, 'MAGNET');
  // Le profil évolue après l'enregistrement…
  for (let i = 0; i < 4; i++) lab.shop.buy('UPGRADE_MAGNET');
  lab.shop.buy('CHAR_NEON');
  lab.shop.equip('NEON');
  // … mais le rejeu reste exact.
  assert.equal(replayToEnd(lab, rec.summary.id).exact, true);
});

test('Ordre des événements : séquence stricte, actions avant leurs conséquences', () => {
  const { lab } = makeLab();
  const rec = recordAutopilotRun(lab, 3000, { seed: 2 });
  const ev = rec.run.events;
  ev.forEach((e, i) => assert.equal(e[0], i));
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i][1] >= ev[i - 1][1]);
  const revive = ev.findIndex((e) => e[3] === 'REVIVE');
  if (revive >= 0) {
    const after = ev.slice(revive + 1).find((e) => e[3] === 'PLAYER_STATE');
    assert.equal(after?.[4].from, 'CRASHED');
  }
});

test('Hoverboard pendant un enregistrement : planche déduite du profil, rejeu exact et gratuit', () => {
  const { lab } = makeLab();
  lab.resources.enableUnlimited('coins');
  lab.shop.buy('HOVERBOARD_5');
  lab.startRun({ record: true, seed: 3131 });
  lab.advanceTicks(30);
  assert.equal(lab.input('HOVERBOARD').accepted, true);
  lab.advanceTicks(600);
  const rec = lab.stopRecording();
  assert.equal(rec.run.setup.config.hoverboards, 5);
  assert.ok(rec.run.events.some((e) => e[3] === 'HOVERBOARD_START'));
  assert.equal(lab.shop.profile.hoverboards, 4, 'une planche consommée');
  const report = replayToEnd(lab, rec.summary.id);
  assert.equal(report.exact, true, report.verdict);
  assert.equal(lab.shop.profile.hoverboards, 4, 'le rejeu ne consomme rien');
});
