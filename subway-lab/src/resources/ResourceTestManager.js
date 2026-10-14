/**
 * Ressources de TEST (pièces, clés) du prototype, isolées de toute
 * progression réelle. Chaque ressource a son propre mode :
 *  - NORMAL    : portefeuille alimenté par les runs ;
 *  - UNLIMITED : solde infini, les achats ne le modifient jamais ;
 *  - CUSTOM    : solde fixé par l'utilisateur, consommé par les achats.
 */

import { ValidationError } from '../core/errors.js';

export const RESOURCE_SETTINGS_VERSION = 2;
export const MAX_RESOURCE = 999_999_999;
export const RESOURCES = /** @type {const} */ (['coins', 'keys']);
export const MODES = /** @type {const} */ (['NORMAL', 'UNLIMITED', 'CUSTOM']);
const STORAGE_NAME = 'resources';

/** @typedef {'coins'|'keys'} ResourceName */
/** @typedef {'NORMAL'|'UNLIMITED'|'CUSTOM'} ResourceMode */
/**
 * @typedef {{ version: number, updatedAt: string,
 *   coins: { mode: ResourceMode, previousMode: 'NORMAL'|'CUSTOM', custom: number },
 *   keys: { mode: ResourceMode, previousMode: 'NORMAL'|'CUSTOM', custom: number },
 *   wallet: { coins: number, keys: number } }} ResourceSettings
 */

/**
 * Valide une quantité saisie (nombre ou texte).
 * @param {unknown} input
 * @returns {number}
 */
export function parseAmount(input) {
  let n = input;
  if (typeof input === 'string') {
    const t = input.trim().replace(/[\s_]/g, '');
    if (!/^\d+$/.test(t)) throw new ValidationError(`Quantité invalide « ${input} » : entier positif attendu.`);
    n = Number(t);
  }
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ValidationError('Quantité non numérique.');
  if (!Number.isInteger(n)) throw new ValidationError('La quantité doit être un entier.');
  if (n < 0) throw new ValidationError('La quantité ne peut pas être négative.');
  if (n > MAX_RESOURCE) throw new ValidationError(`Quantité trop grande (maximum ${MAX_RESOURCE.toLocaleString('fr-FR')}).`);
  return n;
}

/** @returns {ResourceSettings} */
export function defaultResourceSettings() {
  return {
    version: RESOURCE_SETTINGS_VERSION,
    updatedAt: new Date(0).toISOString(),
    coins: { mode: 'NORMAL', previousMode: 'NORMAL', custom: 0 },
    keys: { mode: 'NORMAL', previousMode: 'NORMAL', custom: 0 },
    wallet: { coins: 0, keys: 0 },
  };
}

/**
 * Migration + validation stricte : aucune valeur invalide ne survit au chargement.
 * v1 : { version:1, mode, customCoins, customKeys, coins, keys } (mode commun aux deux ressources).
 * @param {unknown} raw
 * @returns {ResourceSettings}
 */
export function parseResourceSettings(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('objet attendu');
  let r = /** @type {Record<string, any>} */ (raw);
  if (r.version === 1) {
    const mode = String(r.mode ?? 'normal').toUpperCase();
    r = {
      version: 2,
      updatedAt: r.updatedAt ?? new Date(0).toISOString(),
      coins: { mode, previousMode: 'NORMAL', custom: r.customCoins ?? 0 },
      keys: { mode, previousMode: 'NORMAL', custom: r.customKeys ?? 0 },
      wallet: { coins: r.coins ?? 0, keys: r.keys ?? 0 },
    };
  }
  if (r.version !== RESOURCE_SETTINGS_VERSION) throw new Error(`version ${String(r.version)} non prise en charge`);
  const out = defaultResourceSettings();
  out.updatedAt = typeof r.updatedAt === 'string' && !Number.isNaN(Date.parse(r.updatedAt)) ? r.updatedAt : out.updatedAt;
  for (const res of RESOURCES) {
    const s = r[res];
    if (!s || typeof s !== 'object') throw new Error(`${res} absent`);
    if (!MODES.includes(s.mode)) throw new Error(`${res}.mode invalide`);
    out[res].mode = s.mode;
    out[res].previousMode = s.previousMode === 'CUSTOM' ? 'CUSTOM' : 'NORMAL';
    out[res].custom = parseAmount(s.custom);
    out.wallet[res] = parseAmount(r.wallet?.[res] ?? 0);
  }
  return out;
}

export class ResourceTestManager {
  /** @param {import('../storage/SaveManager.js').SaveManager | null} saveManager */
  constructor(saveManager) {
    this.saveManager = saveManager;
    this.settings = defaultResourceSettings();
    /** @type {string | null} */
    this.loadWarning = null;
    this.operations = 0;
  }

  load() {
    if (!this.saveManager) return this.settings;
    const res = this.saveManager.read(STORAGE_NAME, parseResourceSettings);
    this.loadWarning = res.error;
    this.settings = res.value ?? defaultResourceSettings();
    return this.settings;
  }

  save() {
    this.settings.updatedAt = new Date().toISOString();
    if (!this.saveManager) return;
    this.saveManager.writeAtomic(STORAGE_NAME, this.settings, { validate: (v) => void parseResourceSettings(v) });
  }

  /** @param {ResourceName} res */
  assertResource(res) {
    if (!RESOURCES.includes(res)) throw new ValidationError(`Ressource inconnue : ${String(res)}.`);
  }

  /** @param {ResourceName} res @returns {ResourceMode} */
  mode(res) {
    this.assertResource(res);
    return this.settings[res].mode;
  }

  /**
   * @param {ResourceName} res
   * @returns {number} solde utilisable (Infinity en mode illimité)
   */
  balance(res) {
    this.assertResource(res);
    const s = this.settings[res];
    if (s.mode === 'UNLIMITED') return Infinity;
    if (s.mode === 'CUSTOM') return s.custom;
    return this.settings.wallet[res];
  }

  /**
   * @param {ResourceName} res
   * @param {ResourceMode} mode
   */
  setMode(res, mode) {
    this.assertResource(res);
    if (!MODES.includes(mode)) throw new ValidationError(`Mode inconnu : ${String(mode)}.`);
    const s = this.settings[res];
    if (mode === 'UNLIMITED' && s.mode !== 'UNLIMITED') s.previousMode = s.mode === 'CUSTOM' ? 'CUSTOM' : 'NORMAL';
    s.mode = mode;
    this.save();
  }

  /**
   * Définit une quantité personnalisée et active le mode CUSTOM pour cette ressource.
   * @param {ResourceName} res
   * @param {unknown} amount
   */
  setCustom(res, amount) {
    this.assertResource(res);
    const n = parseAmount(amount);
    this.settings[res].custom = n;
    this.settings[res].mode = 'CUSTOM';
    this.save();
    return n;
  }

  /** @param {'coins'|'keys'|'both'} which */
  enableUnlimited(which) {
    for (const res of which === 'both' ? RESOURCES : [which]) {
      this.assertResource(/** @type {ResourceName} */ (res));
      const s = this.settings[res];
      if (s.mode !== 'UNLIMITED') s.previousMode = s.mode === 'CUSTOM' ? 'CUSTOM' : 'NORMAL';
      s.mode = 'UNLIMITED';
    }
    this.save();
  }

  /** Désactive l'illimité en revenant au mode précédent (NORMAL ou CUSTOM). @param {'coins'|'keys'|'both'} [which] */
  disableUnlimited(which = 'both') {
    for (const res of which === 'both' ? RESOURCES : [which]) {
      this.assertResource(/** @type {ResourceName} */ (res));
      const s = this.settings[res];
      if (s.mode === 'UNLIMITED') s.mode = s.previousMode;
    }
    this.save();
  }

  /** Retour complet au mode normal, soldes conservés. */
  returnToNormal() {
    for (const res of RESOURCES) {
      this.settings[res].mode = 'NORMAL';
      this.settings[res].previousMode = 'NORMAL';
    }
    this.save();
  }

  /** Remet portefeuille et quantités personnalisées à zéro, modes conservés. */
  resetResources() {
    for (const res of RESOURCES) {
      this.settings.wallet[res] = 0;
      this.settings[res].custom = 0;
    }
    this.save();
  }

  /**
   * @param {{ coins?: number, keys?: number }} cost
   * @returns {boolean}
   */
  canAfford(cost) {
    return RESOURCES.every((res) => (cost[res] ?? 0) <= this.balance(res));
  }

  /**
   * Débit atomique : soit toutes les ressources sont débitées, soit aucune.
   * Le mode illimité n'est jamais modifié par un achat.
   * @param {{ coins?: number, keys?: number }} cost
   * @param {{ persist?: boolean }} [options]
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  spend(cost, { persist = true } = {}) {
    for (const res of RESOURCES) {
      const amount = cost[res] ?? 0;
      if (!Number.isInteger(amount) || amount < 0) return { ok: false, reason: `Coût invalide pour ${res}.` };
      if (amount > this.balance(res)) {
        return { ok: false, reason: res === 'coins' ? 'Pièces insuffisantes.' : 'Clés insuffisantes.' };
      }
    }
    for (const res of RESOURCES) {
      const amount = cost[res] ?? 0;
      if (amount === 0) continue;
      const s = this.settings[res];
      if (s.mode === 'UNLIMITED') continue;
      if (s.mode === 'CUSTOM') s.custom -= amount;
      else this.settings.wallet[res] -= amount;
    }
    this.operations++;
    if (persist) this.save();
    return { ok: true };
  }

  /**
   * Crédite les gains d'une run (mode NORMAL : portefeuille ; CUSTOM : quantité personnalisée).
   * @param {{ coins?: number, keys?: number }} gain
   */
  earn(gain) {
    for (const res of RESOURCES) {
      const amount = gain[res] ?? 0;
      if (!Number.isInteger(amount) || amount <= 0) continue;
      const s = this.settings[res];
      if (s.mode === 'CUSTOM') s.custom = Math.min(MAX_RESOURCE, s.custom + amount);
      else this.settings.wallet[res] = Math.min(MAX_RESOURCE, this.settings.wallet[res] + amount);
    }
    this.save();
  }

  snapshot() {
    return {
      coins: { mode: this.settings.coins.mode, balance: this.balance('coins'), custom: this.settings.coins.custom, wallet: this.settings.wallet.coins },
      keys: { mode: this.settings.keys.mode, balance: this.balance('keys'), custom: this.settings.keys.custom, wallet: this.settings.wallet.keys },
      updatedAt: this.settings.updatedAt,
      version: this.settings.version,
    };
  }
}
