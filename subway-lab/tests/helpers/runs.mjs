/** Runs minimales construites avec le vrai enregistreur (pas de JSON écrit à la main). */

import { defaultRunConfig } from '../../src/game/runConfig.js';
import { RunRecorder } from '../../src/recorder/RunRecorder.js';

export function startArgs(id = 'run_test_0001') {
  return { id, name: 'Test', seed: 99, config: defaultRunConfig(), initialSpeed: 1, initialHash: 'abcdef01' };
}

/** Run minimale valide. */
export function buildRun(saveManager = null) {
  const r = new RunRecorder({ saveManager });
  r.start(startArgs());
  r.record('RUN_START', 0, 0, { seed: 99, speed: 1, physics: 1 });
  r.record('JUMP', 5, 80, {});
  r.record('SPEED_CHANGE', 6, 90, { from: 1, to: 0.25 });
  r.record('COIN', 10, 400, { id: 3, n: 1 });
  r.record('LANE_LEFT', 20, 900, {});
  return r.stop({ tick: 30, realMs: 1200, reason: 'stop', stats: { score: 50, distance: 12.5, coins: 1, keys: 0 } });
}

