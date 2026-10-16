/**
 * Schéma versionné des enregistrements de run.
 *
 * Un événement est stocké sous forme de tuple compact :
 *   [sequence, tick, realTimeMs, type, payload]
 * - sequence   : entier, commence à 0, +1 à chaque événement (ordre stable total)
 * - tick       : pas de simulation global (temps de simulation = tick / 60 s)
 * - realTimeMs : temps réel monotone depuis le début de l'enregistrement
 * - type       : une clé de EVENT_TYPES
 * - payload    : objet de données (vide si non nécessaire)
 *
 * `toVerboseEvent` produit la forme documentée { sequence, simulationTime, realTime, type, payload }.
 */

import { TICK_RATE } from '../simulation/FixedStepRunner.js';

export const RUN_FORMAT = 'subway-lab-run';
export const RUN_FORMAT_VERSION = 1;
export const MAX_EVENTS = 1_000_000;
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_NAME_LENGTH = 80;
export const RUN_ID_PATTERN = /^run_[a-z0-9_]{4,64}$/;

/** @typedef {[number, number, number, string, Record<string, unknown>]} EventTuple */

const isInt = (/** @type {unknown} */ v) => Number.isInteger(v);
const isNonNegInt = (/** @type {unknown} */ v) => Number.isInteger(v) && /** @type {number} */ (v) >= 0;
const isFiniteNum = (/** @type {unknown} */ v) => typeof v === 'number' && Number.isFinite(v);
const isBool = (/** @type {unknown} */ v) => typeof v === 'boolean';
const isStr = (/** @type {unknown} */ v) => typeof v === 'string' && v.length <= 200;
const oneOf = (/** @type {readonly unknown[]} */ values) => (/** @type {unknown} */ v) => values.includes(v);
const POWERUPS = ['MAGNET', 'DOUBLE', 'SNEAKERS', 'JETPACK'];
const PLAYER_STATES = ['RUNNING', 'JUMPING', 'SLIDING', 'FLYING', 'CRASHED'];
const speed = (/** @type {unknown} */ v) => isFiniteNum(v) && /** @type {number} */ (v) >= 0.1 && /** @type {number} */ (v) <= 1;

/**
 * @typedef {{ category: 'control'|'action'|'outcome', label: string, fields: Record<string, (v: unknown) => boolean> }} EventTypeSpec
 */

/** @type {Readonly<Record<string, EventTypeSpec>>} */
export const EVENT_TYPES = Object.freeze({
  RUN_START: { category: 'control', label: 'Début de run', fields: { seed: isNonNegInt, speed, physics: isNonNegInt } },
  RUN_END: { category: 'control', label: 'Fin de run', fields: { reason: isStr, s: isNonNegInt, d: isFiniteNum, c: isNonNegInt, k: isNonNegInt } },
  PAUSE: { category: 'control', label: 'Pause', fields: {} },
  RESUME: { category: 'control', label: 'Reprise', fields: {} },
  SPEED_CHANGE: { category: 'control', label: 'Changement de vitesse', fields: { from: speed, to: speed } },
  RESTART: { category: 'action', label: 'Redémarrage', fields: { seed: isNonNegInt } },
  LANE_LEFT: { category: 'action', label: 'Voie gauche', fields: {} },
  LANE_RIGHT: { category: 'action', label: 'Voie droite', fields: {} },
  JUMP: { category: 'action', label: 'Saut', fields: {} },
  SLIDE: { category: 'action', label: 'Glissade', fields: {} },
  HOVERBOARD: { category: 'action', label: 'Hoverboard', fields: {} },
  REVIVE: { category: 'action', label: 'Résurrection', fields: {} },
  COIN: { category: 'outcome', label: 'Pièce', fields: { id: isNonNegInt, n: isNonNegInt } },
  KEY: { category: 'outcome', label: 'Clé', fields: { id: isNonNegInt, n: isNonNegInt } },
  BOX: { category: 'outcome', label: 'Boîte mystère', fields: { id: isNonNegInt, reward: oneOf(['COINS', 'KEY']), amount: isNonNegInt } },
  POWERUP_START: { category: 'outcome', label: 'Début de bonus', fields: { kind: oneOf(POWERUPS), dur: isNonNegInt } },
  POWERUP_END: { category: 'outcome', label: 'Fin de bonus', fields: { kind: oneOf(POWERUPS) } },
  HOVERBOARD_START: { category: 'outcome', label: 'Hoverboard activé', fields: { dur: isNonNegInt, left: isNonNegInt } },
  HOVERBOARD_END: { category: 'outcome', label: 'Fin du hoverboard', fields: { reason: oneOf(['expired', 'crash']) } },
  COLLISION: { category: 'outcome', label: 'Collision', fields: { id: isNonNegInt, kind: oneOf(['LOW', 'HIGH', 'TRAIN']), fatal: isBool, side: isBool } },
  STUMBLE: { category: 'outcome', label: 'Trébuchement', fields: { id: isNonNegInt, kind: oneOf(['LOW', 'HIGH', 'TRAIN']) } },
  SCORE_CHANGE: { category: 'outcome', label: 'Score', fields: { s: isNonNegInt } },
  DISTANCE_MILESTONE: { category: 'outcome', label: 'Distance', fields: { d: isNonNegInt, s: isNonNegInt } },
  PLAYER_STATE: {
    category: 'outcome',
    label: 'État du personnage',
    fields: { from: oneOf(PLAYER_STATES), to: oneOf(PLAYER_STATES) },
  },
  CHECKPOINT: {
    category: 'outcome',
    label: 'Point de contrôle',
    fields: { wt: isNonNegInt, d: isFiniteNum, s: isNonNegInt, x: isFiniteNum, y: isFiniteNum, ln: isInt, c: isNonNegInt, k: isNonNegInt, h: (v) => typeof v === 'string' && /^[0-9a-f]{8}$/.test(v) },
  },
  SIM_ERROR: { category: 'control', label: 'Erreur de simulation', fields: { msg: isStr } },
});

export const ACTION_TYPES = Object.freeze(Object.keys(EVENT_TYPES).filter((t) => EVENT_TYPES[t].category === 'action'));

/**
 * @param {unknown} tuple
 * @param {number} index
 * @returns {string | null} message d'erreur ou null
 */
export function validateEventTuple(tuple, index) {
  if (!Array.isArray(tuple) || tuple.length !== 5) return `événement #${index} : tuple de 5 éléments attendu.`;
  const [seq, tick, real, type, payload] = tuple;
  if (!isNonNegInt(seq)) return `événement #${index} : séquence invalide.`;
  if (!isNonNegInt(tick)) return `événement #${index} : tick invalide.`;
  if (!isFiniteNum(real) || real < 0) return `événement #${index} : temps réel invalide.`;
  if (typeof type !== 'string' || !Object.hasOwn(EVENT_TYPES, type)) return `événement #${index} : type inconnu « ${String(type)} ».`;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return `événement #${index} (${type}) : payload objet attendu.`;
  const spec = EVENT_TYPES[type];
  for (const [field, check] of Object.entries(spec.fields)) {
    if (!check(payload[field])) return `événement #${index} (${type}) : champ « ${field} » invalide.`;
  }
  for (const key of Object.keys(payload)) {
    if (!Object.hasOwn(spec.fields, key)) return `événement #${index} (${type}) : champ inattendu « ${key} ».`;
  }
  return null;
}

/**
 * @param {EventTuple} e
 * @returns {{ sequence: number, simulationTime: number, realTime: number, type: string, payload: Record<string, unknown> }}
 */
export function toVerboseEvent(e) {
  return { sequence: e[0], simulationTime: e[1] / TICK_RATE, realTime: e[2] / 1000, type: e[3], payload: e[4] };
}

/**
 * Accepte aussi la forme verbeuse à l'import.
 * @param {unknown} e
 * @returns {unknown}
 */
export function fromVerboseEvent(e) {
  if (Array.isArray(e) || !e || typeof e !== 'object') return e;
  const v = /** @type {Record<string, any>} */ (e);
  if (typeof v.simulationTime !== 'number' || typeof v.realTime !== 'number') return e;
  return [v.sequence, Math.round(v.simulationTime * TICK_RATE), Math.round(v.realTime * 1000), v.type, v.payload ?? {}];
}

/** @returns {string} */
export function createRunId() {
  const rand = Math.floor(Math.random() * 36 ** 6).toString(36).padStart(6, '0');
  return `run_${Date.now().toString(36)}_${rand}`;
}
