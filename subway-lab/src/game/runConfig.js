/**
 * Configuration figée d'une run (améliorations, inventaire, personnage).
 * Elle est capturée au démarrage et stockée dans l'enregistrement : le rejeu
 * n'utilise jamais le profil courant du joueur.
 * Les champs ajoutés en physique v2 sont optionnels à la lecture (anciennes runs).
 */

import { CHARACTER_IDS } from './characters.js';
import { MAX_HOVERBOARDS, MAX_SCORE_MULTIPLIER, MAX_UPGRADE_LEVEL, POWERUP_KINDS } from './constants.js';

/**
 * @typedef {{ upgrades: Record<'MAGNET'|'DOUBLE'|'SNEAKERS'|'JETPACK', number>, startBonus: null | 'MAGNET',
 *   skin: string, hoverboards: number, scoreMultiplier: number }} RunConfig
 */

/** @returns {RunConfig} */
export function defaultRunConfig() {
  return { upgrades: { MAGNET: 0, DOUBLE: 0, SNEAKERS: 0, JETPACK: 0 }, startBonus: null, skin: 'DEFAULT', hoverboards: 0, scoreMultiplier: 1 };
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, value: RunConfig } | { ok: false, errors: string[] }}
 */
export function parseRunConfig(raw) {
  /** @type {string[]} */
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['config : objet attendu.'] };
  const r = /** @type {Record<string, any>} */ (raw);
  const value = defaultRunConfig();
  if (!r.upgrades || typeof r.upgrades !== 'object') errors.push('config.upgrades : objet attendu.');
  else {
    for (const k of POWERUP_KINDS) {
      const lvl = r.upgrades[k] ?? (k === 'JETPACK' ? 0 : undefined);
      if (!Number.isInteger(lvl) || lvl < 0 || lvl > MAX_UPGRADE_LEVEL) errors.push(`config.upgrades.${k} : entier 0..${MAX_UPGRADE_LEVEL} attendu.`);
      else value.upgrades[/** @type {'MAGNET'} */ (k)] = lvl;
    }
  }
  if (r.startBonus !== null && r.startBonus !== 'MAGNET') errors.push('config.startBonus : null ou "MAGNET" attendu.');
  else value.startBonus = r.startBonus;
  if (typeof r.skin !== 'string' || !CHARACTER_IDS.includes(r.skin)) errors.push(`config.skin : une valeur parmi ${CHARACTER_IDS.join(', ')} attendue.`);
  else value.skin = r.skin;
  const boards = r.hoverboards ?? 0;
  if (!Number.isInteger(boards) || boards < 0 || boards > MAX_HOVERBOARDS) errors.push(`config.hoverboards : entier 0..${MAX_HOVERBOARDS} attendu.`);
  else value.hoverboards = boards;
  const mult = r.scoreMultiplier ?? 1;
  if (!Number.isInteger(mult) || mult < 1 || mult > MAX_SCORE_MULTIPLIER) errors.push(`config.scoreMultiplier : entier 1..${MAX_SCORE_MULTIPLIER} attendu.`);
  else value.scoreMultiplier = mult;
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
