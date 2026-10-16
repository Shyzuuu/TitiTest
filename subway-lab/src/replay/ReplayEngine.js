/**
 * Planificateur de rejeu : à partir d'une run validée, fournit pour chaque pas
 * les actions à injecter (dans leur ordre de séquence d'origine), les
 * changements de vitesse d'origine et les points de contrôle attendus.
 * Il ne possède pas le monde : c'est le contrôleur qui l'exécute, avec le même
 * code de pas que pendant l'enregistrement.
 */

import { LabError, ValidationError } from '../core/errors.js';
import { PHYSICS_VERSION } from '../game/constants.js';
import { EVENT_TYPES } from '../recorder/EventSchema.js';
import { validateRun } from '../recorder/RunValidator.js';
import { TICK_RATE } from '../simulation/FixedStepRunner.js';

/** @typedef {import('../recorder/EventSchema.js').EventTuple} EventTuple */

export class ReplayEngine {
  constructor() {
    /** @type {import('../recorder/RunValidator.js').RunRecord | null} */
    this.run = null;
    /** @type {EventTuple[]} */
    this.actions = [];
    /** @type {EventTuple[]} */
    this.speedChanges = [];
    /** @type {Map<number, Record<string, any>>} */
    this.expectedCheckpoints = new Map();
    this.endTick = 0;
    this.cursor = 0;
    this.speedCursor = 0;
    /** @type {string[]} */
    this.warnings = [];
    /** @type {{ tick: number, detail: string } | null} */
    this.lastDivergence = null;
    this.divergenceCount = 0;
  }

  get loaded() {
    return this.run !== null;
  }

  /**
   * @param {unknown} rawRun
   * @returns {{ id: string, name: string, endTick: number, durationS: number, eventCount: number, actionCount: number, warnings: string[] }}
   */
  load(rawRun) {
    const v = validateRun(rawRun);
    if (!v.ok || !v.run) throw new ValidationError(`Run non rejouable : ${v.errors.join(' ')}`, v.errors);
    const run = v.run;
    this.warnings = [...v.warnings];
    if (run.setup.physicsVersion !== PHYSICS_VERSION) {
      this.warnings.push('Physique différente : la reproduction exacte n\'est pas garantie.');
    }
    this.run = run;
    this.actions = run.events.filter((e) => EVENT_TYPES[e[3]].category === 'action');
    this.speedChanges = run.events.filter((e) => e[3] === 'SPEED_CHANGE');
    this.expectedCheckpoints = new Map(run.events.filter((e) => e[3] === 'CHECKPOINT').map((e) => [e[1], e[4]]));
    this.endTick = run.meta.endTick;
    this.rewind();
    return {
      id: run.id, name: run.name, endTick: this.endTick, durationS: this.endTick / TICK_RATE,
      eventCount: run.events.length, actionCount: this.actions.length, warnings: this.warnings,
    };
  }

  rewind() {
    this.cursor = 0;
    this.speedCursor = 0;
    this.lastDivergence = null;
    this.divergenceCount = 0;
  }

  unload() {
    this.run = null;
    this.actions = [];
    this.speedChanges = [];
    this.expectedCheckpoints.clear();
    this.endTick = 0;
    this.rewind();
  }

  /**
   * Actions planifiées pour ce pas, dans l'ordre de séquence d'origine.
   * @param {number} tick
   * @param {EventTuple[]} out tableau réutilisé (vidé ici) pour éviter une allocation par pas
   * @returns {EventTuple[]}
   */
  takeActionsAt(tick, out) {
    if (!this.run) throw new LabError('NO_REPLAY', 'Aucune run chargée pour le rejeu.');
    out.length = 0;
    while (this.cursor < this.actions.length && this.actions[this.cursor][1] <= tick) {
      out.push(this.actions[this.cursor++]);
    }
    return out;
  }

  /**
   * @param {number} tick
   * @returns {number | null} vitesse d'origine à appliquer à ce pas
   */
  takeSpeedAt(tick) {
    /** @type {number | null} */
    let speed = null;
    while (this.speedCursor < this.speedChanges.length && this.speedChanges[this.speedCursor][1] <= tick) {
      speed = /** @type {number} */ (this.speedChanges[this.speedCursor++][4].to);
    }
    return speed;
  }

  /**
   * Vérification en direct d'un point de contrôle produit par le rejeu.
   * @param {number} tick
   * @param {Record<string, any>} actual
   * @returns {{ tick: number, detail: string } | null}
   */
  checkCheckpoint(tick, actual) {
    const expected = this.expectedCheckpoints.get(tick);
    if (!expected) return null;
    if (expected.h === actual.h) return null;
    const fields = ['d', 's', 'x', 'y', 'ln', 'c', 'k'].filter((k) => expected[k] !== actual[k]);
    const detail = fields.length
      ? fields.map((k) => `${k}: ${expected[k]} → ${actual[k]}`).join(', ')
      : `empreinte ${expected.h} → ${actual.h}`;
    this.lastDivergence = { tick, detail };
    this.divergenceCount++;
    return this.lastDivergence;
  }

  /** @param {number} tick */
  progress(tick) {
    return this.endTick > 0 ? Math.min(1, tick / this.endTick) : 1;
  }

  /** @param {number} tick */
  isFinished(tick) {
    return tick >= this.endTick;
  }
}
