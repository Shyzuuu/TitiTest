/**
 * Persistance robuste au-dessus d'un stockage clé/valeur :
 *  1. écriture dans `<clé>.tmp` ;
 *  2. relecture et validation du contenu écrit ;
 *  3. copie de la version précédente dans `<clé>.bak` ;
 *  4. remplacement de `<clé>` (setItem est atomique par clé dans localStorage) ;
 *  5. suppression du temporaire.
 * À la lecture, une clé principale corrompue bascule sur `.bak` avec avertissement.
 */

import { StorageError } from '../core/errors.js';

export const NAMESPACE = 'sslab';
/** Budget prudent : localStorage est limité à ~5 Mo (caractères UTF-16) par origine. */
export const DEFAULT_BUDGET_CHARS = 4_800_000;

/**
 * @param {unknown} e
 * @returns {boolean}
 */
function isQuotaError(e) {
  const err = /** @type {{name?: string, code?: number}} */ (e);
  return !!err && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED' || err.code === 22 || err.code === 1014);
}

export class SaveManager {
  /**
   * @param {import('./StorageAdapter.js').KeyValueStorage} storage
   * @param {{ budgetChars?: number }} [options]
   */
  constructor(storage, { budgetChars = DEFAULT_BUDGET_CHARS } = {}) {
    this.storage = storage;
    this.budgetChars = budgetChars;
    this.lastError = /** @type {StorageError | null} */ (null);
    this.lastWriteAt = 0;
    this.writeCount = 0;
    this.writing = false;
  }

  /** @param {string} name */
  key(name) {
    return `${NAMESPACE}:${name}`;
  }

  /** @returns {number} caractères utilisés par l'espace de noms du laboratoire */
  usageChars() {
    let total = 0;
    const prefix = `${NAMESPACE}:`;
    for (const k of this.storage.keys()) {
      if (!k.startsWith(prefix)) continue;
      total += k.length + (this.storage.getItem(k)?.length ?? 0);
    }
    return total;
  }

  /**
   * @param {string} name
   * @returns {string | null}
   */
  readRaw(name) {
    try {
      return this.storage.getItem(this.key(name));
    } catch (e) {
      throw new StorageError('READ_FAILED', `Lecture impossible de « ${name} ».`, { cause: String(e) });
    }
  }

  /**
   * Lecture validée avec repli sur la sauvegarde précédente.
   * @template T
   * @param {string} name
   * @param {(value: unknown) => T} parse lève une exception si la valeur est invalide
   * @returns {{ value: T | null, source: 'primary' | 'backup' | 'none', error: string | null }}
   */
  read(name, parse) {
    /** @type {string | null} */
    let primaryError = null;
    for (const [suffix, source] of /** @type {const} */ ([['', 'primary'], ['.bak', 'backup']])) {
      const raw = this.readRaw(name + suffix);
      if (raw === null) continue;
      try {
        const value = parse(JSON.parse(raw));
        return { value, source, error: primaryError };
      } catch (e) {
        if (source === 'primary') primaryError = `Données « ${name} » corrompues : ${/** @type {Error} */ (e).message}`;
      }
    }
    return { value: null, source: 'none', error: primaryError };
  }

  /**
   * @param {string} name
   * @param {unknown} value
   * @param {{ validate?: (value: unknown) => void, keepBackup?: boolean }} [options]
   * @returns {{ chars: number }}
   */
  writeAtomic(name, value, { validate, keepBackup = true } = {}) {
    if (this.writing) {
      // Réentrance (écriture déclenchée depuis un callback d'écriture) : refusée pour éviter un entrelacement.
      throw new StorageError('WRITE_FAILED', 'Une sauvegarde est déjà en cours.');
    }
    this.writing = true;
    const key = this.key(name);
    const tmpKey = `${key}.tmp`;
    try {
      const json = JSON.stringify(value);
      if (typeof json !== 'string') throw new StorageError('WRITE_FAILED', `Valeur non sérialisable pour « ${name} ».`);
      const existing = this.storage.getItem(key);
      const existingBak = keepBackup ? this.storage.getItem(`${key}.bak`) : null;
      // Pire cas transitoire : temporaire + principal + sauvegarde coexistent.
      const projected = this.usageChars() - (existingBak?.length ?? 0) + json.length * 2 + (existing?.length ?? 0);
      if (projected > this.budgetChars) {
        throw new StorageError(
          'QUOTA',
          `Espace insuffisant pour sauvegarder « ${name} » (${formatChars(json.length)} nécessaires, budget ${formatChars(this.budgetChars)}). Exportez puis supprimez d'anciennes runs.`,
          { required: json.length, budget: this.budgetChars },
        );
      }
      this.storage.setItem(tmpKey, json);
      const readBack = this.storage.getItem(tmpKey);
      if (readBack !== json) throw new StorageError('VERIFY_FAILED', `Vérification échouée après écriture de « ${name} ».`);
      if (validate) validate(JSON.parse(readBack));
      if (keepBackup && existing !== null) this.storage.setItem(`${key}.bak`, existing);
      this.storage.setItem(key, json);
      this.storage.removeItem(tmpKey);
      this.lastWriteAt = Date.now();
      this.writeCount++;
      this.lastError = null;
      return { chars: json.length };
    } catch (e) {
      safeRemove(this.storage, tmpKey);
      const err = e instanceof StorageError
        ? e
        : isQuotaError(e)
          ? new StorageError('QUOTA', `Quota de stockage atteint lors de la sauvegarde de « ${name} ». Exportez puis supprimez d'anciennes runs.`, { cause: String(e) })
          : new StorageError('WRITE_FAILED', `Échec de la sauvegarde de « ${name} » : ${/** @type {Error} */ (e).message}`, { cause: String(e) });
      this.lastError = err;
      throw err;
    } finally {
      this.writing = false;
    }
  }

  /**
   * Écriture simple (sans sauvegarde ni relecture) pour les brouillons volumineux.
   * @param {string} name
   * @param {string} text
   */
  writeRaw(name, text) {
    try {
      this.storage.setItem(this.key(name), text);
    } catch (e) {
      const err = isQuotaError(e)
        ? new StorageError('QUOTA', 'Quota de stockage atteint pendant l\'enregistrement.', { cause: String(e) })
        : new StorageError('WRITE_FAILED', `Écriture impossible : ${/** @type {Error} */ (e).message}`);
      this.lastError = err;
      throw err;
    }
  }

  /** @param {string} name */
  remove(name) {
    const key = this.key(name);
    safeRemove(this.storage, key);
    safeRemove(this.storage, `${key}.bak`);
    safeRemove(this.storage, `${key}.tmp`);
  }

  /**
   * @param {string} prefix nom logique sans l'espace de noms
   * @returns {string[]} noms logiques (hors .bak/.tmp)
   */
  list(prefix) {
    const full = this.key(prefix);
    const strip = `${NAMESPACE}:`.length;
    return this.storage
      .keys()
      .filter((k) => k.startsWith(full) && !k.endsWith('.bak') && !k.endsWith('.tmp'))
      .map((k) => k.slice(strip))
      .sort();
  }

  /** Nettoie les temporaires orphelins laissés par une interruption. @returns {number} */
  cleanupTemporaries() {
    let n = 0;
    for (const k of this.storage.keys()) {
      if (k.startsWith(`${NAMESPACE}:`) && k.endsWith('.tmp')) {
        safeRemove(this.storage, k);
        n++;
      }
    }
    return n;
  }

  /** Estimation de l'espace navigateur (si l'API existe). */
  async estimateQuota() {
    const nav = /** @type {any} */ (globalThis).navigator;
    if (nav?.storage?.estimate) {
      try {
        const { usage, quota } = await nav.storage.estimate();
        return { usage, quota, supported: true };
      } catch {
        /* API présente mais refusée : on retombe sur le budget local */
      }
    }
    return { usage: this.usageChars() * 2, quota: this.budgetChars * 2, supported: false };
  }
}

/**
 * @param {import('./StorageAdapter.js').KeyValueStorage} storage
 * @param {string} key
 */
function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    /* suppression best-effort */
  }
}

/** @param {number} chars */
export function formatChars(chars) {
  const bytes = chars * 2;
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`;
}
