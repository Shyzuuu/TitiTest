/**
 * Boutique du prototype : personnages originaux, améliorations de bonus,
 * hoverboards, bonus de départ, boîtes mystère et multiplicateur de score.
 * Toutes les dépenses passent par ResourceTestManager (modes normal / illimité / personnalisé).
 */

import { LabError, ValidationError } from '../core/errors.js';
import { CHARACTERS, CHARACTER_IDS, characterById } from '../game/characters.js';
import { MAX_HOVERBOARDS, MAX_SCORE_MULTIPLIER, MAX_UPGRADE_LEVEL, POWERUP_KINDS } from '../game/constants.js';
import { defaultRunConfig } from '../game/runConfig.js';

const PROFILE_NAME = 'profile';
export const PROFILE_VERSION = 2;
export const MAX_START_BONUSES = 99;
export const MAX_SHOP_MULTIPLIER = 10;

/**
 * @typedef {{ version: number, upgrades: Record<'MAGNET'|'DOUBLE'|'SNEAKERS'|'JETPACK', number>, startMagnets: number,
 *   hoverboards: number, scoreMultiplier: number, characters: string[], equippedCharacter: string }} Profile
 * @typedef {'character'|'upgrade'|'item'|'multiplier'} ItemCategory
 * @typedef {{ id: string, label: string, detail: string, category: ItemCategory,
 *   cost: (p: Profile) => { coins: number, keys: number } | null }} CatalogItem
 * Un coût `null` signifie « indisponible » (déjà possédé, niveau ou stock maximum).
 */

const UPGRADE_LABELS = { MAGNET: 'Aimant', DOUBLE: 'Score ×2', SNEAKERS: 'Super-baskets', JETPACK: 'Jetpack' };

/** @param {number} level */
export const upgradeCost = (level) => 500 * 2 ** level;

/** @type {readonly CatalogItem[]} */
export const CATALOG = Object.freeze([
  ...CHARACTERS.filter((c) => c.id !== 'DEFAULT').map((c) => ({
    id: `CHAR_${c.id}`,
    label: c.name,
    detail: 'Personnage',
    category: /** @type {const} */ ('character'),
    cost: (/** @type {Profile} */ p) => (p.characters.includes(c.id) ? null : { ...c.cost }),
  })),
  ...POWERUP_KINDS.map((k) => ({
    id: `UPGRADE_${k}`,
    label: UPGRADE_LABELS[/** @type {'MAGNET'} */ (k)],
    detail: 'Durée +2 s par niveau',
    category: /** @type {const} */ ('upgrade'),
    cost: (/** @type {Profile} */ p) => {
      const lvl = p.upgrades[/** @type {'MAGNET'} */ (k)];
      return lvl >= MAX_UPGRADE_LEVEL ? null : { coins: upgradeCost(lvl), keys: 0 };
    },
  })),
  { id: 'HOVERBOARD_1', label: 'Hoverboard ×1', detail: 'Protège d\'un crash pendant 30 s', category: 'item', cost: (p) => (p.hoverboards >= MAX_HOVERBOARDS ? null : { coins: 300, keys: 0 }) },
  { id: 'HOVERBOARD_5', label: 'Hoverboards ×5', detail: 'Lot avantageux', category: 'item', cost: (p) => (p.hoverboards + 5 > MAX_HOVERBOARDS ? null : { coins: 1200, keys: 0 }) },
  { id: 'START_MAGNET', label: 'Aimant de départ', detail: 'Actif dès le début de la prochaine run', category: 'item', cost: (p) => (p.startMagnets >= MAX_START_BONUSES ? null : { coins: 300, keys: 0 }) },
  { id: 'MYSTERY_BOX', label: 'Boîte mystère', detail: 'Pièces, clés ou hoverboard', category: 'item', cost: () => ({ coins: 500, keys: 0 }) },
  {
    id: 'MULTIPLIER',
    label: 'Multiplicateur de score +1',
    detail: 'Multiplie tous les points',
    category: 'multiplier',
    cost: (p) => (p.scoreMultiplier >= MAX_SHOP_MULTIPLIER ? null : { coins: 0, keys: 3 * p.scoreMultiplier }),
  },
]);

/** @returns {Profile} */
export function defaultProfile() {
  return {
    version: PROFILE_VERSION,
    upgrades: { MAGNET: 0, DOUBLE: 0, SNEAKERS: 0, JETPACK: 0 },
    startMagnets: 0,
    hoverboards: 0,
    scoreMultiplier: 1,
    characters: ['DEFAULT'],
    equippedCharacter: 'DEFAULT',
  };
}

/**
 * Validation stricte + migration v1 (skins/equippedSkin, pas de jetpack ni de planches).
 * @param {unknown} raw
 * @returns {Profile}
 */
export function parseProfile(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('objet attendu');
  let r = /** @type {Record<string, any>} */ (raw);
  if (r.version === 1) {
    r = {
      version: 2,
      upgrades: { ...r.upgrades, JETPACK: 0 },
      startMagnets: r.startMagnets,
      hoverboards: 0,
      scoreMultiplier: 1,
      characters: r.skins,
      equippedCharacter: r.equippedSkin,
    };
  }
  if (r.version !== PROFILE_VERSION) throw new Error(`version ${String(r.version)} non prise en charge`);
  const p = defaultProfile();
  for (const k of POWERUP_KINDS) {
    const v = r.upgrades?.[k];
    if (!Number.isInteger(v) || v < 0 || v > MAX_UPGRADE_LEVEL) throw new Error(`niveau ${k} invalide`);
    p.upgrades[/** @type {'MAGNET'} */ (k)] = v;
  }
  if (!Number.isInteger(r.startMagnets) || r.startMagnets < 0 || r.startMagnets > MAX_START_BONUSES) throw new Error('bonus de départ invalide');
  p.startMagnets = r.startMagnets;
  if (!Number.isInteger(r.hoverboards) || r.hoverboards < 0 || r.hoverboards > MAX_HOVERBOARDS) throw new Error('hoverboards invalides');
  p.hoverboards = r.hoverboards;
  if (!Number.isInteger(r.scoreMultiplier) || r.scoreMultiplier < 1 || r.scoreMultiplier > MAX_SCORE_MULTIPLIER) throw new Error('multiplicateur invalide');
  p.scoreMultiplier = r.scoreMultiplier;
  if (!Array.isArray(r.characters) || !r.characters.every((s) => CHARACTER_IDS.includes(s))) throw new Error('personnages invalides');
  p.characters = [...new Set(['DEFAULT', ...r.characters])];
  if (!p.characters.includes(r.equippedCharacter)) throw new Error('personnage équipé invalide');
  p.equippedCharacter = r.equippedCharacter;
  return p;
}

/**
 * Coût de la n-ième résurrection d'une run : 1, 2, 4, 8… clés (plafonné).
 * @param {number} revivesSoFar
 */
export function reviveCost(revivesSoFar) {
  return { coins: 0, keys: Math.min(2 ** Math.max(0, revivesSoFar), 1024) };
}

/**
 * @typedef {{ kind: 'COINS', amount: number } | { kind: 'KEYS', amount: number } | { kind: 'HOVERBOARD', amount: number }} BoxReward
 */

export class PurchaseSimulator {
  /**
   * @param {import('../storage/SaveManager.js').SaveManager | null} saveManager
   * @param {import('./ResourceTestManager.js').ResourceTestManager} resources
   * @param {{ random?: () => number }} [options] tirage des boîtes de la boutique (hors simulation)
   */
  constructor(saveManager, resources, { random = Math.random } = {}) {
    this.saveManager = saveManager;
    this.resources = resources;
    this.random = random;
    this.profile = defaultProfile();
    /** @type {string | null} */
    this.loadWarning = null;
    this.purchases = 0;
    /** @type {BoxReward | null} */
    this.lastBoxReward = null;
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
   * @returns {{ ok: true, item: string, reward?: BoxReward } | { ok: false, reason: string }}
   */
  buy(id, { persist = true } = {}) {
    const it = this.item(id);
    const cost = it.cost(this.profile);
    if (!cost) return { ok: false, reason: 'Article indisponible (déjà possédé ou maximum atteint).' };
    const paid = this.resources.spend(cost, { persist });
    if (!paid.ok) return paid;
    /** @type {BoxReward | undefined} */
    let reward;
    const p = this.profile;
    if (id.startsWith('UPGRADE_')) p.upgrades[/** @type {'MAGNET'} */ (id.slice(8))]++;
    else if (id.startsWith('CHAR_')) p.characters.push(id.slice(5));
    else if (id === 'HOVERBOARD_1') p.hoverboards += 1;
    else if (id === 'HOVERBOARD_5') p.hoverboards += 5;
    else if (id === 'START_MAGNET') p.startMagnets++;
    else if (id === 'MULTIPLIER') p.scoreMultiplier++;
    else if (id === 'MYSTERY_BOX') reward = this.openBox();
    this.purchases++;
    if (persist) this.save();
    return reward ? { ok: true, item: id, reward } : { ok: true, item: id };
  }

  /** @returns {BoxReward} */
  openBox() {
    const r = this.random();
    /** @type {BoxReward} */
    let reward;
    if (r < 0.5) reward = { kind: 'COINS', amount: 100 + Math.floor(this.random() * 10) * 100 };
    else if (r < 0.8 && this.profile.hoverboards < MAX_HOVERBOARDS) {
      this.profile.hoverboards++;
      reward = { kind: 'HOVERBOARD', amount: 1 };
    } else reward = { kind: 'KEYS', amount: 1 + Math.floor(this.random() * 3) };
    if (reward.kind === 'COINS') this.resources.earn({ coins: reward.amount });
    if (reward.kind === 'KEYS') this.resources.earn({ keys: reward.amount });
    this.lastBoxReward = reward;
    return reward;
  }

  /** @param {string} characterId */
  equip(characterId) {
    if (!this.profile.characters.includes(characterId)) throw new LabError('NOT_OWNED', 'Personnage non débloqué.');
    this.profile.equippedCharacter = characterId;
    this.save();
  }

  /** Réinitialise le profil de test (améliorations, personnages, inventaire). */
  resetProfile() {
    this.profile = defaultProfile();
    this.save();
  }

  /**
   * Retire de l'inventaire les planches consommées pendant une run.
   * @param {number} count
   */
  useHoverboards(count) {
    if (!Number.isInteger(count) || count <= 0) return;
    this.profile.hoverboards = Math.max(0, this.profile.hoverboards - count);
    this.save();
  }

  /**
   * Fige la configuration de la prochaine run et consomme un bonus de départ s'il y en a.
   * @returns {import('../game/runConfig.js').RunConfig}
   */
  consumeRunConfig() {
    const p = this.profile;
    const cfg = defaultRunConfig();
    cfg.upgrades = { ...p.upgrades };
    cfg.skin = characterById(p.equippedCharacter).id;
    cfg.hoverboards = p.hoverboards;
    cfg.scoreMultiplier = p.scoreMultiplier;
    if (p.startMagnets > 0) {
      p.startMagnets--;
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
        return { id: c.id, label: c.label, detail: c.detail, category: c.category, cost, affordable: !!cost && this.resources.canAfford(cost) };
      }),
    };
  }
}
