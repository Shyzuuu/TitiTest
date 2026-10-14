/**
 * Générateur pseudo-aléatoire déterministe (mulberry32).
 * L'état complet tient dans un entier 32 bits : il est sérialisable,
 * restaurable et identique sur tous les moteurs JavaScript.
 */

export const MAX_SEED = 0xffffffff;

/**
 * @param {unknown} seed
 * @returns {boolean}
 */
export function isValidSeed(seed) {
  return Number.isInteger(seed) && /** @type {number} */ (seed) >= 0 && /** @type {number} */ (seed) <= MAX_SEED;
}

/** @returns {number} */
export function generateSeed() {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    return c.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * MAX_SEED) >>> 0;
}

export class RandomProvider {
  /** @param {number} seed */
  constructor(seed) {
    /** @type {number} */
    this.seed = 0;
    /** @type {number} */
    this.state = 0;
    this.setSeed(seed);
  }

  /** @param {number} seed */
  setSeed(seed) {
    if (!isValidSeed(seed)) {
      throw new RangeError(`Graine invalide : ${String(seed)} (entier 0..${MAX_SEED} attendu).`);
    }
    this.seed = seed >>> 0;
    this.state = this.seed;
  }

  /** @returns {number} flottant dans [0, 1) */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /**
   * @param {number} min
   * @param {number} maxInclusive
   * @returns {number}
   */
  int(min, maxInclusive) {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }

  /**
   * @param {number} probability
   * @returns {boolean}
   */
  chance(probability) {
    return this.next() < probability;
  }

  /**
   * @template T
   * @param {readonly T[]} items
   * @returns {T}
   */
  pick(items) {
    if (items.length === 0) throw new RangeError('pick() sur une liste vide.');
    return items[Math.floor(this.next() * items.length)];
  }

  /**
   * Tirage pondéré. Les poids nuls ou négatifs sont ignorés.
   * @template T
   * @param {ReadonlyArray<readonly [T, number]>} entries
   * @returns {T}
   */
  weighted(entries) {
    let total = 0;
    for (const [, w] of entries) if (w > 0) total += w;
    if (total <= 0) throw new RangeError('weighted() sans poids positif.');
    let r = this.next() * total;
    for (const [value, w] of entries) {
      if (w <= 0) continue;
      r -= w;
      if (r < 0) return value;
    }
    // Garde-fou contre l'arrondi flottant : renvoie la dernière entrée valide.
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i][1] > 0) return entries[i][0];
    throw new RangeError('weighted() incohérent.');
  }

  /** @returns {number} */
  getState() {
    return this.state;
  }

  /** @param {number} state */
  setState(state) {
    if (!isValidSeed(state)) throw new RangeError(`État RNG invalide : ${String(state)}.`);
    this.state = state >>> 0;
  }
}
