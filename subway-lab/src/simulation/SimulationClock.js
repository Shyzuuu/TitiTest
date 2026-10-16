/**
 * Horloge de simulation : SEUL endroit où le multiplicateur de vitesse est appliqué.
 * Les systèmes de gameplay ne voient jamais de delta variable : ils consomment des
 * pas fixes fournis par FixedStepRunner, ce qui exclut toute double application.
 */

export const MIN_SPEED = 0.1;
export const MAX_SPEED = 1.0;

export const SPEED_PRESETS = Object.freeze([
  Object.freeze({ id: 'ULTRA', label: 'Ultra ralenti', value: 0.1 }),
  Object.freeze({ id: 'EXTREME', label: 'Ralenti extrême', value: 0.25 }),
  Object.freeze({ id: 'STRONG', label: 'Ralenti important', value: 0.5 }),
  Object.freeze({ id: 'LIGHT', label: 'Ralenti léger', value: 0.75 }),
  Object.freeze({ id: 'NORMAL', label: 'Vitesse normale', value: 1.0 }),
]);

/** @returns {number} millisecondes monotones */
export function monotonicNow() {
  const p = globalThis.performance;
  if (p && typeof p.now === 'function') return p.now();
  // Repli Node sans performance : process.hrtime est monotone.
  const proc = /** @type {any} */ (globalThis).process;
  if (proc && typeof proc.hrtime?.bigint === 'function') return Number(proc.hrtime.bigint()) / 1e6;
  return Date.now();
}

/**
 * Valide et normalise un multiplicateur (2 décimales, bornes [0,10 ; 1,00]).
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeSpeed(value) {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    throw new RangeError(`Multiplicateur invalide : ${String(value)}.`);
  }
  if (n < MIN_SPEED - 1e-9 || n > MAX_SPEED + 1e-9) {
    throw new RangeError(`Multiplicateur hors bornes : ${n} (attendu ${MIN_SPEED}–${MAX_SPEED}).`);
  }
  return Math.round(n * 100) / 100;
}

/**
 * @param {number} value
 * @returns {string} ex. « 0,25× »
 */
export function formatSpeed(value) {
  return `${value.toFixed(2).replace('.', ',')}×`;
}

export class SimulationClock {
  /**
   * @param {{ now?: () => number, maxFrameDelta?: number }} [options]
   */
  constructor({ now = monotonicNow, maxFrameDelta = 0.25 } = {}) {
    this.now = now;
    // Plafond par image : évite un rattrapage massif après un onglet masqué.
    this.maxFrameDelta = maxFrameDelta;
    this.multiplier = 1;
    this.paused = false;
    this.running = false;
    this.lastReal = 0;
    this.realElapsed = 0;
    this.simElapsed = 0;
    this.pausedDuration = 0;
    this.droppedRealTime = 0;
    /** @type {Map<number, number>} secondes réelles passées à chaque vitesse */
    this.timeAtSpeed = new Map();
  }

  /** Démarre (ou redémarre) une session ; conserve le multiplicateur courant. */
  start() {
    this.running = true;
    this.paused = false;
    this.lastReal = this.now();
    this.realElapsed = 0;
    this.simElapsed = 0;
    this.pausedDuration = 0;
    this.droppedRealTime = 0;
    this.timeAtSpeed.clear();
  }

  stop() {
    this.running = false;
    this.paused = false;
  }

  /**
   * @param {unknown} value
   * @returns {{ from: number, to: number, changed: boolean }}
   */
  setMultiplier(value) {
    const to = normalizeSpeed(value);
    const from = this.multiplier;
    this.multiplier = to;
    return { from, to, changed: from !== to };
  }

  /** @returns {boolean} vrai si l'état a changé */
  pause() {
    if (!this.running || this.paused) return false;
    this.tick(); // solde le temps écoulé à la vitesse courante avant de geler
    this.paused = true;
    return true;
  }

  /** @returns {boolean} */
  resume() {
    if (!this.running || !this.paused) return false;
    this.tick(); // comptabilise la durée de pause
    this.paused = false;
    return true;
  }

  /**
   * À appeler une fois par image. Renvoie le temps de simulation à consommer.
   * @returns {number} secondes de simulation (>= 0)
   */
  tick() {
    if (!this.running) return 0;
    const t = this.now();
    let realDelta = (t - this.lastReal) / 1000;
    this.lastReal = t;
    // Une horloge non monotone (ou un appel répété au même instant) ne doit jamais produire de temps négatif.
    if (!(realDelta > 0)) realDelta = 0;
    this.realElapsed += realDelta;
    if (this.paused) {
      this.pausedDuration += realDelta;
      return 0;
    }
    const clamped = Math.min(realDelta, this.maxFrameDelta);
    this.droppedRealTime += realDelta - clamped;
    this.timeAtSpeed.set(this.multiplier, (this.timeAtSpeed.get(this.multiplier) ?? 0) + clamped);
    const sim = clamped * this.multiplier;
    this.simElapsed += sim;
    return sim;
  }

  snapshot() {
    return {
      running: this.running,
      paused: this.paused,
      multiplier: this.multiplier,
      realElapsed: this.realElapsed,
      simElapsed: this.simElapsed,
      pausedDuration: this.pausedDuration,
      droppedRealTime: this.droppedRealTime,
      timeAtSpeed: Object.fromEntries([...this.timeAtSpeed.entries()].map(([k, v]) => [k.toFixed(2), v])),
    };
  }
}
