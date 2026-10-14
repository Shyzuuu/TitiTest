/**
 * Boutique fictive du prototype : améliorations, bonus de départ, apparences
 * et résurrection. Sert à éprouver le système de ressources de test.
 */

import { LabError, ValidationError } from '../core/errors.js';
import { MAX_UPGRADE_LEVEL, POWERUP_KINDS, SKINS } from '../game/constants.js';
import { defaultRunConfig } from '../game/runConfig.js';

const PROFILE_NAME = 'profile';
export const PROFILE_VERSION = 1;
export const MAX_START_BONUSES = 99;

/**
 * @typedef {{ version: number, upgrades: Record<'MAGNET'|'DOUBLE'|'SNEAKERS', number>, startMagnets: number,
 *   skins: string[], equippedSkin: string }} Profile
 */

/**
 * @typedef {{ id: string, label: string, kind: 'upgrade'|'consumable'|'cosmetic', cost: (p: Profile) => { coins: number, keys: number } | null }} CatalogItem
 * Un coût `null` signifie « indisponible » (niveau maximum, déjà possédé…).
 */

/** @type {readonly CatalogItem[]} */
export const CATALOG = Object.freeze([
  ...POWERUP_KINDS.map((k) => ({
    id: `UPGRADE_${k}`,
    label: { MAGNET: 'Amélioration aimant', DOUBLE: 'Amélioration score ×2', SNEAKERS: 'Amélioration super-baskets' }[k] ?? k,
    kind: /** @type {const} */ ('upgrade'),
    cost: (/** @type {Profile} */ p) => (p.upgrades[/** @type {'MAGNET'} */ (k)] >= MAX_UPGRADE_LEVEL ? null : { coins: 500 * (p.upgrades[/** @type {'MAGNET'} */ (k)] + 1), keys: 0 }),
  })),
  { id: 'START_MAGNET', label: 'Bonus de départ : aimant', kind: 'consumable', cost: (p) => (p.startMagnets >= MAX_START_BONUSES ? null : { coins: 300, keys: 0 }) },
  { id: 'SKIN_NEON', label: 'Tenue « Néon » (fictive)', kind: 'cosmetic', cost: (p) => (p.skins.includes('NEON') ? null : { coins: 1500, keys: 0 }) },
  { id: 'SKIN_GOLD', label: 'Tenue « Or » (fictive)', kind: 'cosmetic', cost: (p) => (p.skins.includes('GOLD') ? null : { coins: 5000, keys: 5 }) },
]);

/** @returns {Profile} */
export function defaultProfile() {
  return { version: PROFILE_VERSION, upgrades: { MAGNET: 0, DOUBLE: 0, SNEAKERS: 0 }, startMagnets: 0, skins: ['DEFAULT'], equippedSkin: 'DEFAULT' };
}

/**
 * @param {unknown} raw
 * @returns {Profile}
 */
export function parseProfile(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('objet attendu');
  const r = /** @type {Record<string, any>} */ (raw);
  if (r.version !== PROFILE_VERSION) throw new Error(`version ${String(r.version)} non prise en charge`);
  const p = defaultProfile();
  for (const k of POWERUP_KINDS) {
    const v = r.upgrades?.[k];
    if (!Number.isInteger(v) || v < 0 || v > MAX_UPGRADE_LEVEL) throw new Error(`niveau ${k} invalide`);
    p.upgrades[/** @type {'MAGNET'} */ (k)] = v;
  }
  if (!Number.isInteger(r.startMagnets) || r.startMagnets < 0 || r.startMagnets > MAX_START_BONUSES) throw new Error('bonus de départ invalide');
  p.startMagnets = r.startMagnets;
  if (!Array.isArray(r.skins) || !r.skins.every((s) => SKINS.includes(s))) throw new Error('tenues invalides');
  p.skins = [...new Set(['DEFAULT', ...r.skins])];
  if (!p.skins.includes(r.equippedSkin)) throw new Error('tenue équipée invalide');
  p.equippedSkin = r.equippedSkin;
  return p;
}

/**
 * Coût de la n-ième résurrection d'une run : 1, 2, 4, 8… clés (plafonné).
 * @param {number} revivesSoFar
 */
export function reviveCost(revivesSoFar) {
  return { coins: 0, keys: Math.min(2 ** Math.max(0, revivesSoFar), 1024) };
}

export class PurchaseSimulator {
  /**
   * @param {import('../storage/SaveManager.js').SaveManager | null} saveManager
   * @param {import('./ResourceTestManager.js').ResourceTestManager} resources
   */
  constructor(saveManager, resources) {
    this.saveManager = saveManager;
    this.resources = resources;
    this.profile = defaultProfile();
    /** @type {string | null} */
    this.loadWarning = null;
    this.purchases = 0;
  }

  load() {
    if (!this.saveManager) return this.profile;
    const res = this.saveManager.read(PROFILE_NAME, parseProfile);
    this.loadWarning = res.error;
    this.profile = res.value ?? defaultProfile();
    return this.profile;
  }

  save() {
    if (!this.saveManager) return;
    this.saveManager.writeAtomic(PROFILE_NAME, this.profile, { validate: (v) => void parseProfile(v) });
  }

  /** @param {string} id */
  item(id) {
    const it = CATALOG.find((c) => c.id === id);
    if (!it) throw new ValidationError(`Article inconnu : ${id}.`);
    return it;
  }

  /**
   * @param {string} id
   * @param {{ persist?: boolean }} [options]
   * @returns {{ ok: true, item: string } | { ok: false, reason: string }}
   */
  buy(id, { persist = true } = {}) {
    const it = this.item(id);
    const cost = it.cost(this.profile);
    if (!cost) return { ok: false, reason: 'Article indisponible (déjà possédé ou niveau maximum).' };
    const paid = this.resources.spend(cost, { persist });
    if (!paid.ok) return paid;
    if (id.startsWith('UPGRADE_')) this.profile.upgrades[/** @type {'MAGNET'} */ (id.slice(8))]++;
    else if (id === 'START_MAGNET') this.profile.startMagnets++;
    else if (id.startsWith('SKIN_')) this.profile.skins.push(id.slice(5));
    this.purchases++;
    if (persist) this.save();
    return { ok: true, item: id };
  }

  /** @param {string} skin */
  equip(skin) {
    if (!this.profile.skins.includes(skin)) throw new LabError('NOT_OWNED', 'Tenue non possédée.');
    this.profile.equippedSkin = skin;
    this.save();
  }

  /** Réinitialise le profil de test (améliorations, tenues, bonus). */
  resetProfile() {
    this.profile = defaultProfile();
    this.save();
  }

  /**
   * Fige la configuration de la prochaine run et consomme un bonus de départ s'il y en a.
   * @returns {import('../game/runConfig.js').RunConfig}
   */
  consumeRunConfig() {
    const cfg = defaultRunConfig();
    cfg.upgrades = { ...this.profile.upgrades };
    cfg.skin = this.profile.equippedSkin;
    if (this.profile.startMagnets > 0) {
      this.profile.startMagnets--;
      cfg.startBonus = 'MAGNET';
      try {
        this.save();
      } catch {
        /* le bonus est appliqué même si la persistance échoue ; l'erreur est remontée par SaveManager.lastError */
      }
    }
    return cfg;
  }

  /**
   * @param {number} revivesSoFar
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  buyRevive(revivesSoFar) {
    return this.resources.spend(reviveCost(revivesSoFar));
  }

  snapshot() {
    return {
      profile: structuredClone(this.profile),
      catalog: CATALOG.map((c) => {
        const cost = c.cost(this.profile);
        return { id: c.id, label: c.label, kind: c.kind, cost, affordable: !!cost && this.resources.canAfford(cost) };
      }),
    };
  }
}
