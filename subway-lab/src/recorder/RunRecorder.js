/**
 * Enregistreur de run.
 * Les événements sont conservés en mémoire (tableau de tuples) et vidés par
 * morceaux incrémentaux dans un brouillon persistant : on n'écrit jamais
 * l'intégralité du fichier à chaque événement, et une fermeture brutale
 * laisse un brouillon récupérable au prochain lancement.
 */

import { LabError } from '../core/errors.js';
import { PHYSICS_VERSION } from '../game/constants.js';
import { TICK_RATE } from '../simulation/FixedStepRunner.js';
import { RUN_FORMAT, RUN_FORMAT_VERSION, validateEventTuple } from './EventSchema.js';
import { computeChecksum } from './RunValidator.js';

const DRAFT_PREFIX = 'draft:';

/**
 * @typedef {{ id: string, name: string, seed: number, config: import('../game/runConfig.js').RunConfig,
 *   initialSpeed: number, initialHash: string, createdAt?: string }} RecordingStart
 */

export class RunRecorder {
  /**
   * @param {{ saveManager?: import('../storage/SaveManager.js').SaveManager | null, flushEvery?: number, flushIntervalMs?: number }} [options]
   */
  constructor({ saveManager = null, flushEvery = 512, flushIntervalMs = 5000 } = {}) {
    this.saveManager = saveManager;
    this.flushEvery = flushEvery;
    this.flushIntervalMs = flushIntervalMs;
    this.reset();
  }

  reset() {
    this.active = false;
    /** @type {import('./EventSchema.js').EventTuple[]} */
    this.events = [];
    this.seq = 0;
    this.flushedCount = 0;
    this.chunkIndex = 0;
    this.lastFlushRealMs = 0;
    /** @type {RecordingStart & { createdAt: string } | null} */
    this.head = null;
    /** @type {string | null} */
    this.draftError = null;
    this.lastRealMs = 0;
    this.lastTick = 0;
  }

  get pendingCount() {
    return this.events.length - this.flushedCount;
  }

  get eventCount() {
    return this.events.length;
  }

  /** @param {RecordingStart} start */
  start(start) {
    if (this.active) throw new LabError('ALREADY_RECORDING', 'Un enregistrement est déjà en cours.');
    this.reset();
    this.active = true;
    this.head = { ...start, createdAt: start.createdAt ?? new Date().toISOString() };
    if (this.saveManager) {
      try {
        this.saveManager.writeRaw(`${DRAFT_PREFIX}${start.id}:head`, JSON.stringify({
          id: start.id, name: start.name, createdAt: this.head.createdAt,
          setup: this.buildSetup(),
        }));
      } catch (e) {
        this.draftError = /** @type {Error} */ (e).message;
      }
    }
  }

  buildSetup() {
    const h = /** @type {NonNullable<RunRecorder['head']>} */ (this.head);
    return {
      seed: h.seed, config: structuredClone(h.config), physicsVersion: PHYSICS_VERSION,
      initialSpeed: h.initialSpeed, initialHash: h.initialHash,
    };
  }

  /**
   * @param {string} type
   * @param {number} tick
   * @param {number} realMs
   * @param {Record<string, unknown>} [payload]
   * @returns {import('./EventSchema.js').EventTuple}
   */
  record(type, tick, realMs, payload = {}) {
    if (!this.active) throw new LabError('NOT_RECORDING', 'Aucun enregistrement actif.');
    // Ordre garanti : le temps ne recule jamais dans un enregistrement, même si l'appelant se trompe.
    const t = Math.max(tick, this.lastTick);
    const r = Math.max(Math.round(realMs), this.lastRealMs);
    this.lastTick = t;
    this.lastRealMs = r;
    /** @type {import('./EventSchema.js').EventTuple} */
    const e = [this.seq++, t, r, type, payload];
    this.events.push(e);
    if (this.saveManager && (this.pendingCount >= this.flushEvery || r - this.lastFlushRealMs >= this.flushIntervalMs)) {
      this.flushDraft(r);
    }
    return e;
  }

  /** @param {number} [realMs] */
  flushDraft(realMs = this.lastRealMs) {
    if (!this.saveManager || !this.active || !this.head || this.pendingCount === 0) return false;
    const chunk = this.events.slice(this.flushedCount);
    const name = `${DRAFT_PREFIX}${this.head.id}:c${String(this.chunkIndex).padStart(6, '0')}`;
    try {
      this.saveManager.writeRaw(name, JSON.stringify(chunk));
      this.chunkIndex++;
      this.flushedCount = this.events.length;
      this.draftError = null;
    } catch (e) {
      // Les événements restent en mémoire : la run reste sauvegardable ou exportable à l'arrêt.
      this.draftError = /** @type {Error} */ (e).message;
    }
    this.lastFlushRealMs = realMs;
    return this.draftError === null;
  }

  /**
   * @param {{ tick: number, realMs: number, reason: string, stats: { score: number, distance: number, coins: number, keys: number }, recovered?: boolean }} end
   * @returns {import('./RunValidator.js').RunRecord}
   */
  stop(end) {
    if (!this.active || !this.head) throw new LabError('NOT_RECORDING', 'Aucun enregistrement actif.');
    const { score, distance, coins, keys } = end.stats;
    const last = this.record('RUN_END', end.tick, end.realMs, {
      reason: end.reason, s: score, d: Math.round(distance * 1000) / 1000, c: coins, k: keys,
    });
    this.active = false;
    const meta = {
      endTick: last[1],
      realDurationMs: last[2],
      simDurationS: last[1] / TICK_RATE,
      eventCount: this.events.length,
      score, distance: Math.round(distance * 1000) / 1000, coins, keys,
      recovered: !!end.recovered,
    };
    /** @type {any} */
    const run = {
      format: RUN_FORMAT, version: RUN_FORMAT_VERSION, id: this.head.id, name: this.head.name,
      createdAt: this.head.createdAt, updatedAt: new Date().toISOString(),
      meta, setup: this.buildSetup(), events: this.events, checksum: '',
    };
    run.checksum = computeChecksum(run);
    return run;
  }

  /** Supprime le brouillon (après sauvegarde réussie ou abandon volontaire). */
  discardDraft() {
    if (!this.saveManager || !this.head) return;
    removeDraft(this.saveManager, this.head.id);
  }

  abort() {
    this.discardDraft();
    this.reset();
  }

  /**
   * Reconstitue les runs interrompues (fermeture brutale, crash du navigateur).
   * @param {import('../storage/SaveManager.js').SaveManager} saveManager
   * @returns {{ runs: import('./RunValidator.js').RunRecord[], errors: string[] }}
   */
  static recoverDrafts(saveManager) {
    /** @type {Map<string, string[]>} */
    const byId = new Map();
    for (const name of saveManager.list(DRAFT_PREFIX)) {
      const m = /^draft:(run_[a-z0-9_]+):(head|c\d{6})$/.exec(name);
      if (!m) continue;
      if (!byId.has(m[1])) byId.set(m[1], []);
      /** @type {string[]} */ (byId.get(m[1])).push(m[2]);
    }
    /** @type {import('./RunValidator.js').RunRecord[]} */
    const runs = [];
    /** @type {string[]} */
    const errors = [];
    for (const [id, parts] of byId) {
      try {
        const headRaw = saveManager.readRaw(`${DRAFT_PREFIX}${id}:head`);
        if (!headRaw) throw new Error('en-tête absent');
        const head = JSON.parse(headRaw);
        /** @type {import('./EventSchema.js').EventTuple[]} */
        const events = [];
        for (const part of parts.filter((p) => p !== 'head').sort()) {
          const raw = saveManager.readRaw(`${DRAFT_PREFIX}${id}:${part}`);
          let chunk;
          try {
            chunk = JSON.parse(raw ?? '[]');
          } catch {
            break; // morceau tronqué : on garde tout ce qui précède
          }
          if (!Array.isArray(chunk)) break;
          let valid = true;
          for (const e of chunk) {
            if (validateEventTuple(e, events.length) !== null || e[0] !== events.length) {
              valid = false;
              break;
            }
            events.push(e);
          }
          if (!valid) break;
        }
        if (events.length === 0 || events[0][3] !== 'RUN_START') throw new Error('aucun événement exploitable');
        // Le vidage peut couper au milieu d'un pas : les événements du dernier pas sont
        // retirés pour que la run se termine sur un pas complet (rejeu exact jusque-là).
        const lastTick = events[events.length - 1][1];
        if (lastTick > 0) while (events.length > 1 && events[events.length - 1][1] === lastTick) events.pop();
        const rec = new RunRecorder();
        rec.start({ ...head.setup, id, name: `${head.name} (récupérée)`.slice(0, 80), createdAt: head.createdAt });
        rec.events = events;
        rec.seq = events.length;
        const lastEvent = events[events.length - 1];
        rec.lastTick = lastEvent[1];
        rec.lastRealMs = lastEvent[2];
        let stats = { score: 0, distance: 0, coins: 0, keys: 0 };
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i][3] === 'CHECKPOINT') {
            const p = /** @type {any} */ (events[i][4]);
            stats = { score: p.s, distance: p.d, coins: p.c, keys: p.k };
            break;
          }
        }
        runs.push(rec.stop({ tick: Math.max(lastTick, lastEvent[1]), realMs: lastEvent[2], reason: 'recovered', stats, recovered: true }));
      } catch (e) {
        errors.push(`Brouillon ${id} irrécupérable : ${/** @type {Error} */ (e).message}`);
      }
    }
    return { runs, errors };
  }
}

/**
 * @param {import('../storage/SaveManager.js').SaveManager} saveManager
 * @param {string} id
 */
export function removeDraft(saveManager, id) {
  for (const name of saveManager.list(`${DRAFT_PREFIX}${id}:`)) saveManager.remove(name);
}
