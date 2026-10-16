/**
 * Validation, empreinte et migration des fichiers de run.
 * Un fichier de run est une DONNÉE : rien n'y est jamais évalué ni exécuté.
 */

import { fnv1a, toHex32 } from '../core/hash.js';
import { PHYSICS_VERSION } from '../game/constants.js';
import { parseRunConfig } from '../game/runConfig.js';
import { isValidSeed } from '../simulation/RandomProvider.js';
import {
  MAX_EVENTS, MAX_NAME_LENGTH, RUN_FORMAT, RUN_FORMAT_VERSION, RUN_ID_PATTERN, fromVerboseEvent, validateEventTuple,
} from './EventSchema.js';

const MAX_REPORTED_ERRORS = 20;

/**
 * @typedef {{ format: string, version: number, id: string, name: string, createdAt: string, updatedAt: string,
 *   meta: { endTick: number, realDurationMs: number, simDurationS: number, eventCount: number, score: number,
 *     distance: number, coins: number, keys: number, recovered: boolean },
 *   setup: { seed: number, config: import('../game/runConfig.js').RunConfig, physicsVersion: number, initialSpeed: number, initialHash: string },
 *   events: import('./EventSchema.js').EventTuple[], checksum: string }} RunRecord
 */

/**
 * @param {Pick<RunRecord, 'setup' | 'meta' | 'events'>} run
 * @returns {string}
 */
export function computeChecksum(run) {
  // Le nom et l'identifiant sont exclus : renommer ou dupliquer ne casse pas l'intégrité.
  return `fnv1a:${toHex32(fnv1a(JSON.stringify([run.setup, run.meta.endTick, run.events])))}`;
}

/**
 * Migrations successives vers la version courante. v0 : événements verbeux,
 * pas de version de physique (implicitement 1), pas d'empreinte initiale.
 * @type {Record<number, (run: Record<string, any>) => Record<string, any>>}
 */
const MIGRATIONS = {
  0: (run) => {
    const events = Array.isArray(run.events) ? run.events.map(fromVerboseEvent) : run.events;
    const setup = { ...run.setup, physicsVersion: run.setup?.physicsVersion ?? 1, initialHash: run.setup?.initialHash ?? '00000000' };
    const migrated = { ...run, version: 1, events, setup };
    migrated.checksum = computeChecksum(/** @type {any} */ (migrated));
    return migrated;
  },
};

/**
 * @param {Record<string, any>} run
 * @returns {Record<string, any>}
 */
export function migrateRun(run) {
  let current = run;
  while (current.version < RUN_FORMAT_VERSION) {
    const step = MIGRATIONS[current.version];
    if (!step) throw new RangeError(`Aucune migration depuis la version ${current.version}.`);
    current = step(current);
  }
  return current;
}

/**
 * @param {unknown} raw
 * @param {{ verifyChecksum?: boolean }} [options]
 * @returns {{ ok: boolean, errors: string[], warnings: string[], run: RunRecord | null, migratedFrom: number | null }}
 */
export function validateRun(raw, { verifyChecksum = true } = {}) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];
  const fail = () => ({ ok: false, errors: errors.slice(0, MAX_REPORTED_ERRORS), warnings, run: null, migratedFrom: null });
  /** @param {string} m */
  const err = (m) => {
    errors.push(m);
  };

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    err('Le fichier ne contient pas un objet de run.');
    return fail();
  }
  let run = /** @type {Record<string, any>} */ (raw);
  if (run.format !== RUN_FORMAT) {
    err(`Format inconnu « ${String(run.format)} » (attendu « ${RUN_FORMAT} »).`);
    return fail();
  }
  if (!Number.isInteger(run.version) || run.version < 0) {
    err('Version du format absente ou invalide.');
    return fail();
  }
  if (run.version > RUN_FORMAT_VERSION) {
    err(`Version ${run.version} inconnue : ce laboratoire lit jusqu'à la version ${RUN_FORMAT_VERSION}. Mettez l'application à jour.`);
    return fail();
  }
  /** @type {number | null} */
  let migratedFrom = null;
  if (run.version < RUN_FORMAT_VERSION) {
    migratedFrom = run.version;
    try {
      run = migrateRun(run);
      warnings.push(`Fichier migré de la version ${migratedFrom} vers ${RUN_FORMAT_VERSION}.`);
    } catch (e) {
      err(`Migration impossible : ${/** @type {Error} */ (e).message}`);
      return fail();
    }
  }

  if (typeof run.id !== 'string' || !RUN_ID_PATTERN.test(run.id)) err('Identifiant de run invalide.');
  if (typeof run.name !== 'string' || run.name.trim().length === 0 || run.name.length > MAX_NAME_LENGTH) err(`Nom invalide (1 à ${MAX_NAME_LENGTH} caractères).`);
  if (typeof run.createdAt !== 'string' || Number.isNaN(Date.parse(run.createdAt))) err('Date de création invalide.');

  const setup = run.setup;
  if (!setup || typeof setup !== 'object') err('Section « setup » absente.');
  else {
    if (!isValidSeed(setup.seed)) err('Graine aléatoire invalide.');
    const cfg = parseRunConfig(setup.config);
    if (!cfg.ok) errors.push(...cfg.errors);
    if (!Number.isInteger(setup.physicsVersion) || setup.physicsVersion < 1) err('Version de physique invalide.');
    else if (setup.physicsVersion !== PHYSICS_VERSION) {
      warnings.push(`Run enregistrée avec la physique v${setup.physicsVersion} (actuelle v${PHYSICS_VERSION}) : le rejeu risque de diverger.`);
    }
    if (typeof setup.initialSpeed !== 'number' || setup.initialSpeed < 0.1 || setup.initialSpeed > 1) err('Vitesse initiale invalide.');
    if (typeof setup.initialHash !== 'string' || !/^[0-9a-f]{8}$/.test(setup.initialHash)) err('Empreinte de l\'état initial invalide.');
  }

  const meta = run.meta;
  if (!meta || typeof meta !== 'object') err('Section « meta » absente.');
  else {
    for (const k of ['endTick', 'eventCount', 'score', 'coins', 'keys']) {
      if (!Number.isInteger(meta[k]) || meta[k] < 0) err(`meta.${k} invalide.`);
    }
    for (const k of ['realDurationMs', 'simDurationS', 'distance']) {
      if (typeof meta[k] !== 'number' || !Number.isFinite(meta[k]) || meta[k] < 0) err(`meta.${k} invalide.`);
    }
    if (typeof meta.recovered !== 'boolean') err('meta.recovered invalide.');
  }

  const events = run.events;
  if (!Array.isArray(events)) {
    err('Liste d\'événements absente.');
    return fail();
  }
  if (events.length > MAX_EVENTS) {
    err(`Trop d'événements (${events.length} > ${MAX_EVENTS}).`);
    return fail();
  }
  if (events.length < 2) err('Run tronquée : au moins RUN_START et RUN_END sont requis.');
  if (errors.length) return fail();

  let prevTick = 0;
  let prevReal = 0;
  for (let i = 0; i < events.length; i++) {
    const msg = validateEventTuple(events[i], i);
    if (msg) {
      err(msg);
      if (errors.length >= MAX_REPORTED_ERRORS) break;
      continue;
    }
    const [seq, tick, real, type] = events[i];
    if (seq !== i) err(`événement #${i} : séquence ${seq} hors ordre (attendu ${i}).`);
    if (tick < prevTick) err(`événement #${i} : tick ${tick} antérieur au précédent (${prevTick}).`);
    if (real < prevReal) err(`événement #${i} : temps réel décroissant.`);
    if (type === 'RUN_START' && i !== 0) err(`événement #${i} : RUN_START en double.`);
    if (type === 'RUN_END' && i !== events.length - 1) err(`événement #${i} : RUN_END avant la fin du fichier.`);
    prevTick = tick;
    prevReal = real;
    if (errors.length >= MAX_REPORTED_ERRORS) break;
  }
  if (errors.length) return fail();

  const first = events[0];
  const last = events[events.length - 1];
  if (first[3] !== 'RUN_START' || first[1] !== 0) err('Le premier événement doit être RUN_START au tick 0.');
  else if (first[4].seed !== setup.seed) err('La graine de RUN_START ne correspond pas à setup.seed.');
  if (last[3] !== 'RUN_END') err('Run tronquée : RUN_END absent.');
  else if (last[1] !== meta.endTick) err('meta.endTick ne correspond pas au tick de RUN_END.');
  if (meta.eventCount !== events.length) err(`meta.eventCount (${meta.eventCount}) ≠ nombre réel d'événements (${events.length}).`);

  if (verifyChecksum && !errors.length) {
    const expected = computeChecksum(/** @type {any} */ (run));
    if (run.checksum !== expected) err('Empreinte d\'intégrité incorrecte : fichier modifié ou corrompu.');
  }
  if (errors.length) return fail();
  return { ok: true, errors, warnings, run: /** @type {RunRecord} */ (run), migratedFrom };
}
