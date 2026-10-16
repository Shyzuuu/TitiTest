/** Outils partagés par les tests : horloge factice, contrôleur prêt à l'emploi, scripts d'entrées. */

import { LabController } from '../../src/app/LabController.js';
import { MemoryStorage } from '../../src/storage/StorageAdapter.js';

export function fakeClock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    /** @param {number} ms */
    advance: (ms) => {
      t += ms;
    },
    set: (/** @type {number} */ v) => {
      t = v;
    },
  };
}

/**
 * @param {{ storage?: MemoryStorage, clock?: ReturnType<typeof fakeClock>, budgetChars?: number, recorderOptions?: object }} [o]
 */
export function makeLab(o = {}) {
  const storage = o.storage ?? new MemoryStorage();
  const clock = o.clock ?? fakeClock();
  const lab = new LabController({ storage, now: clock.now, budgetChars: o.budgetChars, recorderOptions: o.recorderOptions }).init();
  return { lab, storage, clock };
}

/**
 * Simule n images d'affichage à 60 Hz réels.
 * @param {LabController} lab
 * @param {ReturnType<typeof fakeClock>} clock
 * @param {number} frames
 * @param {number} [frameMs]
 */
export function runFrames(lab, clock, frames, frameMs = 1000 / 60) {
  for (let i = 0; i < frames; i++) {
    clock.advance(frameMs);
    lab.frame();
  }
}

/**
 * Script d'entrées déterministe (indépendant du RNG de la simulation).
 * @param {number} i
 */
export function scriptedAction(i) {
  const seq = ['LANE_LEFT', 'JUMP', 'LANE_RIGHT', 'SLIDE', 'LANE_RIGHT', 'JUMP', 'LANE_LEFT', 'SLIDE'];
  return seq[i % seq.length];
}

/**
 * Joue une run enregistrée au pilote automatique (ressources illimitées pour les résurrections).
 * @param {LabController} lab
 * @param {number} ticks
 * @param {{ seed?: number, name?: string }} [o]
 */
export function recordAutopilotRun(lab, ticks, o = {}) {
  lab.resources.enableUnlimited('both');
  lab.autopilot = true;
  lab.startRun({ record: true, name: o.name ?? 'Run de test', seed: o.seed ?? 12345 });
  lab.advanceTicks(ticks);
  lab.autopilot = false;
  return lab.stopRecording();
}

/**
 * Rejoue jusqu'au bout sans horloge.
 * @param {LabController} lab
 * @param {string} id
 */
export function replayToEnd(lab, id) {
  lab.startReplay(id);
  lab.advanceTicks(Number.MAX_SAFE_INTEGER);
  return lab.lastReplayReport;
}
