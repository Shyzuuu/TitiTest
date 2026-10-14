import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationClock, normalizeSpeed, formatSpeed, SPEED_PRESETS } from '../../src/simulation/SimulationClock.js';
import { FixedStepRunner, STEP } from '../../src/simulation/FixedStepRunner.js';
import { RandomProvider, isValidSeed } from '../../src/simulation/RandomProvider.js';
import { fakeClock } from '../helpers/fixtures.mjs';

/** Fait avancer horloge + runner pendant `seconds` réelles à 60 images/s et renvoie le nombre de pas. */
function simulate(clock, sc, runner, seconds) {
  let steps = 0;
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    clock.advance(1000 / 60);
    steps += runner.advance(sc.tick(), () => {});
  }
  return steps;
}

test('SimulationClock : vitesse normale = temps réel', () => {
  const c = fakeClock();
  const sc = new SimulationClock({ now: c.now });
  sc.start();
  c.advance(100);
  assert.ok(Math.abs(sc.tick() - 0.1) < 1e-12);
  // Plafond par image (0,25 s) : une image d'une seconde (onglet gelé) ne compte que 0,25 s.
  c.advance(1000);
  assert.ok(Math.abs(sc.tick() - 0.25) < 1e-12);
  assert.ok(Math.abs(sc.droppedRealTime - 0.75) < 1e-12);
});

test('SimulationClock + runner : 1,00× / 0,50× / 0,10× produisent 60 / 30 / 6 pas par seconde réelle', () => {
  for (const [speed, expected] of [[1, 120], [0.5, 60], [0.1, 12]]) {
    const c = fakeClock();
    const sc = new SimulationClock({ now: c.now });
    const r = new FixedStepRunner();
    sc.setMultiplier(speed);
    sc.start();
    const steps = simulate(c, sc, r, 2);
    assert.ok(Math.abs(steps - expected) <= 1, `${speed}× : ${steps} pas (attendu ${expected})`);
    assert.ok(Math.abs(sc.simElapsed - 2 * speed) < 1e-9, 'temps simulé = temps réel × multiplicateur');
  }
});

test('SimulationClock : changement de vitesse à chaud, temps cumulé par vitesse', () => {
  const c = fakeClock();
  const sc = new SimulationClock({ now: c.now });
  const r = new FixedStepRunner();
  sc.start();
  simulate(c, sc, r, 1);
  sc.setMultiplier(0.1);
  simulate(c, sc, r, 1);
  sc.setMultiplier(1);
  simulate(c, sc, r, 1);
  assert.ok(Math.abs(sc.simElapsed - 2.1) < 1e-9);
  assert.ok(Math.abs(sc.realElapsed - 3) < 1e-9);
  const snap = sc.snapshot();
  assert.ok(Math.abs(snap.timeAtSpeed['1.00'] - 2) < 1e-9);
  assert.ok(Math.abs(snap.timeAtSpeed['0.10'] - 1) < 1e-9);
});

test('SimulationClock : la pause gèle le temps simulé et la reprise restaure le multiplicateur', () => {
  const c = fakeClock();
  const sc = new SimulationClock({ now: c.now });
  sc.setMultiplier(0.25);
  sc.start();
  c.advance(100);
  sc.tick();
  assert.equal(sc.pause(), true);
  assert.equal(sc.pause(), false, 'double pause sans effet');
  for (let i = 0; i < 10; i++) {
    c.advance(100);
    assert.equal(sc.tick(), 0);
  }
  assert.ok(Math.abs(sc.pausedDuration - 1) < 1e-9);
  assert.equal(sc.resume(), true);
  assert.equal(sc.multiplier, 0.25);
  c.advance(100);
  assert.ok(Math.abs(sc.tick() - 0.025) < 1e-12);
});

test('SimulationClock : jamais de temps négatif si l\'horloge recule', () => {
  const c = fakeClock(5000);
  const sc = new SimulationClock({ now: c.now });
  sc.start();
  c.set(4000);
  assert.equal(sc.tick(), 0);
  assert.equal(sc.simElapsed, 0);
  assert.ok(sc.realElapsed >= 0);
});

test('SimulationClock : le multiplicateur n\'est appliqué qu\'une fois (pas fixe constant)', () => {
  const c = fakeClock();
  const sc = new SimulationClock({ now: c.now });
  const r = new FixedStepRunner();
  sc.setMultiplier(0.5);
  sc.start();
  let deltas = 0;
  const steps = (() => {
    let n = 0;
    for (let i = 0; i < 60; i++) {
      c.advance(1000 / 60);
      n += r.advance(sc.tick(), () => {
        deltas += STEP; // chaque pas consomme exactement STEP, jamais STEP × multiplicateur
      });
    }
    return n;
  })();
  assert.ok(Math.abs(deltas - steps * STEP) < 1e-12);
  assert.ok(Math.abs(steps - 30) <= 1);
});

test('normalizeSpeed : bornes, arrondi et formats', () => {
  assert.equal(normalizeSpeed(0.25), 0.25);
  assert.equal(normalizeSpeed('0,5'), 0.5);
  assert.equal(normalizeSpeed(0.123), 0.12);
  for (const bad of [0, 0.05, 1.5, NaN, Infinity, 'abc', null, undefined, -1]) assert.throws(() => normalizeSpeed(bad));
  assert.deepEqual(SPEED_PRESETS.map((p) => p.value), [0.1, 0.25, 0.5, 0.75, 1]);
  assert.equal(formatSpeed(0.1), '0,10×');
});

test('FixedStepRunner : abandon du retard au-delà du plafond, alpha borné', () => {
  const r = new FixedStepRunner({ maxStepsPerFrame: 4 });
  const n = r.advance(STEP * 10, () => {});
  assert.equal(n, 4);
  assert.ok(r.droppedSteps >= 5);
  assert.ok(r.alpha >= 0 && r.alpha <= 1);
  let calls = 0;
  r.reset();
  r.advance(STEP * 3, () => {
    calls++;
    return false;
  });
  assert.equal(calls, 1, 'un pas qui renvoie false interrompt la boucle');
});

test('RandomProvider : déterministe, restaurable, bornes', () => {
  const a = new RandomProvider(42);
  const b = new RandomProvider(42);
  const sa = Array.from({ length: 1000 }, () => a.next());
  const sb = Array.from({ length: 1000 }, () => b.next());
  assert.deepEqual(sa, sb);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
  const st = a.getState();
  const x = a.next();
  a.setState(st);
  assert.equal(a.next(), x);
  for (let i = 0; i < 1000; i++) {
    const v = a.int(2, 5);
    assert.ok(v >= 2 && v <= 5 && Number.isInteger(v));
  }
  assert.throws(() => new RandomProvider(-1));
  assert.throws(() => new RandomProvider(1.5));
  assert.equal(isValidSeed(0xffffffff), true);
  assert.equal(a.weighted([['a', 0], ['b', 1]]), 'b');
});
