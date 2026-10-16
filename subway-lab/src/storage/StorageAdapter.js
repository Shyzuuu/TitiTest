/**
 * Adaptateurs de stockage clé/valeur synchrones. L'interface minimale permet
 * de substituer localStorage par une mémoire contrôlable en test (quota, pannes).
 *
 * @typedef {{ getItem(key: string): string | null, setItem(key: string, value: string): void,
 *   removeItem(key: string): void, keys(): string[] }} KeyValueStorage
 */

import { StorageError } from '../core/errors.js';

export class MemoryStorage {
  /**
   * @param {{ quotaChars?: number }} [options] quota en caractères UTF-16 (Infinity par défaut)
   */
  constructor({ quotaChars = Infinity } = {}) {
    /** @type {Map<string, string>} */
    this.map = new Map();
    this.quotaChars = quotaChars;
    this.usedChars = 0;
    /** Nombre d'écritures à faire échouer (simulation de panne). */
    this.failNextWrites = 0;
    this.writes = 0;
  }

  /** @param {string} key */
  getItem(key) {
    return this.map.has(key) ? /** @type {string} */ (this.map.get(key)) : null;
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  setItem(key, value) {
    if (this.failNextWrites > 0) {
      this.failNextWrites--;
      throw new Error('Panne d\'écriture simulée');
    }
    const prev = this.map.get(key);
    const delta = key.length + value.length - (prev === undefined ? 0 : key.length + prev.length);
    if (this.usedChars + delta > this.quotaChars) {
      const e = new Error('QuotaExceededError (simulé)');
      e.name = 'QuotaExceededError';
      throw e;
    }
    this.usedChars += delta;
    this.map.set(key, String(value));
    this.writes++;
  }

  /** @param {string} key */
  removeItem(key) {
    const prev = this.map.get(key);
    if (prev === undefined) return;
    this.usedChars -= key.length + prev.length;
    this.map.delete(key);
  }

  keys() {
    return [...this.map.keys()];
  }
}

/**
 * Enveloppe localStorage (navigateur). Lève StorageError si indisponible
 * (navigation privée stricte, cookies bloqués, WebView sans DOM storage).
 */
export class BrowserStorage {
  /** @param {Storage} [storage] */
  constructor(storage) {
    try {
      const s = storage ?? globalThis.localStorage;
      const probe = '__sslab_probe__';
      s.setItem(probe, '1');
      s.removeItem(probe);
      this.storage = s;
    } catch (e) {
      throw new StorageError('UNAVAILABLE', 'Stockage local indisponible : les runs ne seront pas conservées après fermeture.', { cause: String(e) });
    }
  }

  /** @param {string} key */
  getItem(key) {
    return this.storage.getItem(key);
  }

  /**
   * @param {string} key
   * @param {string} value
   */
  setItem(key, value) {
    this.storage.setItem(key, value);
  }

  /** @param {string} key */
  removeItem(key) {
    this.storage.removeItem(key);
  }

  keys() {
    /** @type {string[]} */
    const out = [];
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (k !== null) out.push(k);
    }
    return out;
  }
}
