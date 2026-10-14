/**
 * Configuration figée d'une run (améliorations, bonus de départ, apparence).
 * Elle est capturée au démarrage et stockée dans l'enregistrement : le rejeu
 * n'utilise jamais le profil courant du joueur.
 */

import { MAX_UPGRADE_LEVEL, POWERUP_KINDS, SKINS } from './constants.js';

/**
 * @typedef {{ upgrades: Record<'MAGNET'|'DOUBLE'|'SNEAKERS', number>, startBonus: null | 'MAGNET', skin: string }} RunConfig
 */

/** @returns {RunConfig} */
export function defaultRunConfig() {
  return { upgrades: { MAGNET: 0, DOUBLE: 0, SNEAKERS: 0 }, startBonus: null, skin: 'DEFAULT' };
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
      const lvl = r.upgrades[k];
      if (!Number.isInteger(lvl) || lvl < 0 || lvl > MAX_UPGRADE_LEVEL) errors.push(`config.upgrades.${k} : entier 0..${MAX_UPGRADE_LEVEL} attendu.`);
      else value.upgrades[/** @type {'MAGNET'} */ (k)] = lvl;
    }
  }
  if (r.startBonus !== null && r.startBonus !== 'MAGNET') errors.push('config.startBonus : null ou "MAGNET" attendu.');
  else value.startBonus = r.startBonus;
  if (typeof r.skin !== 'string' || !SKINS.includes(r.skin)) errors.push(`config.skin : une valeur parmi ${SKINS.join(', ')} attendue.`);
  else value.skin = r.skin;
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
