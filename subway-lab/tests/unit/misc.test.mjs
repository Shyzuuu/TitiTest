import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StateMachine, States, TRANSITIONS } from '../../src/app/StateMachine.js';
import { keyCandidates, parseSettings, defaultSettings, resolveBinding, swipeToAction, defaultKeyMap } from '../../src/input/InputController.js';

test('StateMachine : transitions autorisées, refus et journal', () => {
  const m = new StateMachine();
  const seen = [];
  m.onChange((to, from) => seen.push(`${from}>${to}`));
  m.transition(States.READY);
  m.transition(States.RECORDING);
  m.transition(States.RECORDING_PAUSED);
  m.transition(States.RECORDING);
  assert.throws(() => m.transition(States.REPLAYING), /interdite/);
  m.transition(States.FINISHED);
  m.transition(States.REPLAYING);
  m.transition(States.REPLAY_PAUSED);
  m.transition(States.REPLAYING);
  m.transition(States.FINISHED);
  assert.equal(seen.length, 9);
  assert.equal(m.history.length, 9);
  m.fail('test');
  assert.equal(m.state, States.ERROR);
  assert.equal(m.can(States.RUNNING), false);
  m.transition(States.READY);
  // Aucun état ne permet d'enregistrer et de rejouer simultanément.
  for (const [from, tos] of Object.entries(TRANSITIONS)) {
    if (from.startsWith('RECORDING')) assert.ok(!tos.some((t) => t.startsWith('REPLAY')));
    if (from.startsWith('REPLAY')) assert.ok(!tos.some((t) => t.startsWith('RECORDING')));
  }
});

test('Entrées : AZERTY et QWERTY, glissements, validation des réglages', () => {
  const km = defaultKeyMap();
  // AZERTY : la touche marquée « A » a le code KeyQ.
  assert.equal(resolveBinding(km, keyCandidates(/** @type {any} */ ({ code: 'KeyQ', key: 'a' }))), 'LANE_LEFT');
  assert.equal(resolveBinding(km, keyCandidates(/** @type {any} */ ({ code: 'Space', key: ' ' }))), 'JUMP');
  assert.equal(resolveBinding(km, keyCandidates(/** @type {any} */ ({ code: 'Escape', key: 'Escape' }))), 'PAUSE');
  assert.equal(resolveBinding(km, keyCandidates(/** @type {any} */ ({ code: 'KeyR', key: 'r' }))), 'RESTART');
  assert.equal(swipeToAction(-50, 5, 28), 'LANE_LEFT');
  assert.equal(swipeToAction(50, -5, 28), 'LANE_RIGHT');
  assert.equal(swipeToAction(3, -60, 28), 'JUMP');
  assert.equal(swipeToAction(3, 60, 28), 'SLIDE');
  assert.equal(swipeToAction(10, 10, 28), null);
  assert.deepEqual(parseSettings(defaultSettings()), defaultSettings());
  assert.throws(() => parseSettings({ ...defaultSettings(), keymap: { ...km, JUMP: ['<script>'] } }));
  assert.throws(() => parseSettings({ ...defaultSettings(), swipeThreshold: 1 }));
});
