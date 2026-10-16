/**
 * Bibliothèque locale des runs : un enregistrement par clé `run:<id>` et un
 * index léger `runs:index` (reconstructible à partir des clés si corrompu).
 */

import { LabError, ValidationError } from '../core/errors.js';
import { MAX_IMPORT_BYTES, MAX_NAME_LENGTH, createRunId } from '../recorder/EventSchema.js';
import { validateRun } from '../recorder/RunValidator.js';

const INDEX = 'runs:index';
const RUN_PREFIX = 'run:';

/**
 * @typedef {{ id: string, name: string, createdAt: string, updatedAt: string, realDurationMs: number,
 *   simDurationS: number, score: number, distance: number, eventCount: number, version: number,
 *   integrity: 'ok' | 'recovered' | 'corrupt', recovered: boolean, chars: number }} RunSummary
 */

/**
 * @param {import('../recorder/RunValidator.js').RunRecord} run
 * @param {number} chars
 * @returns {RunSummary}
 */
function summarize(run, chars) {
  return {
    id: run.id, name: run.name, createdAt: run.createdAt, updatedAt: run.updatedAt ?? run.createdAt,
    realDurationMs: run.meta.realDurationMs, simDurationS: run.meta.simDurationS, score: run.meta.score,
    distance: run.meta.distance, eventCount: run.meta.eventCount, version: run.version,
    integrity: run.meta.recovered ? 'recovered' : 'ok', recovered: run.meta.recovered, chars,
  };
}

/**
 * @param {unknown} name
 * @returns {string}
 */
export function sanitizeRunName(name) {
  if (typeof name !== 'string') throw new ValidationError('Le nom doit être un texte.');
  // Retire les caractères de contrôle : le nom est affiché tel quel dans l'interface.
  const clean = name.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (clean.length === 0) throw new ValidationError('Le nom ne peut pas être vide.');
  if (clean.length > MAX_NAME_LENGTH) throw new ValidationError(`Le nom dépasse ${MAX_NAME_LENGTH} caractères.`);
  return clean;
}

export class RunRepository {
  /** @param {import('./SaveManager.js').SaveManager} saveManager */
  constructor(saveManager) {
    this.saveManager = saveManager;
    /** @type {RunSummary[]} */
    this.index = [];
    /** @type {string[]} */
    this.warnings = [];
  }

  /** Charge l'index ; le reconstruit si absent, corrompu ou incohérent avec les clés. */
  load() {
    this.warnings = [];
    const res = this.saveManager.read(INDEX, (v) => {
      if (!Array.isArray(v)) throw new Error('tableau attendu');
      return /** @type {RunSummary[]} */ (v);
    });
    if (res.error) this.warnings.push(res.error);
    const stored = new Set(this.saveManager.list(RUN_PREFIX).map((n) => n.slice(RUN_PREFIX.length)));
    const indexed = new Set((res.value ?? []).map((s) => s.id));
    const consistent = res.value !== null && stored.size === indexed.size && [...stored].every((id) => indexed.has(id));
    if (consistent) this.index = /** @type {RunSummary[]} */ (res.value);
    else this.rebuildIndex();
    return this.index;
  }

  rebuildIndex() {
    /** @type {RunSummary[]} */
    const out = [];
    for (const name of this.saveManager.list(RUN_PREFIX)) {
      const id = name.slice(RUN_PREFIX.length);
      const raw = this.saveManager.readRaw(name);
      try {
        const v = validateRun(JSON.parse(raw ?? 'null'));
        if (!v.ok || !v.run) throw new Error(v.errors[0]);
        out.push(summarize(v.run, raw?.length ?? 0));
      } catch (e) {
        // Une run corrompue reste listée (jamais supprimée silencieusement) pour que l'utilisateur décide.
        out.push({
          id, name: `${id} (corrompue)`, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
          realDurationMs: 0, simDurationS: 0, score: 0, distance: 0, eventCount: 0, version: 0,
          integrity: 'corrupt', recovered: false, chars: raw?.length ?? 0,
        });
        this.warnings.push(`Run ${id} corrompue : ${/** @type {Error} */ (e).message}`);
      }
    }
    this.index = out;
    this.persistIndex();
  }

  persistIndex() {
    try {
      this.saveManager.writeAtomic(INDEX, this.index);
    } catch (e) {
      this.warnings.push(/** @type {Error} */ (e).message);
    }
  }

  /**
   * @param {{ sort?: 'date'|'duration'|'score'|'name', order?: 'asc'|'desc', search?: string, validOnly?: boolean }} [query]
   * @returns {RunSummary[]}
   */
  list({ sort = 'date', order = 'desc', search = '', validOnly = false } = {}) {
    const needle = search.trim().toLocaleLowerCase('fr');
    const items = this.index.filter((s) => (!validOnly || s.integrity !== 'corrupt') && (!needle || s.name.toLocaleLowerCase('fr').includes(needle)));
    /** @type {(a: RunSummary, b: RunSummary) => number} */
    const cmp = {
      date: (a, b) => a.createdAt.localeCompare(b.createdAt),
      duration: (a, b) => a.simDurationS - b.simDurationS,
      score: (a, b) => a.score - b.score,
      name: (a, b) => a.name.localeCompare(b.name, 'fr'),
    }[sort] ?? ((a, b) => a.createdAt.localeCompare(b.createdAt));
    items.sort((a, b) => (order === 'asc' ? cmp(a, b) : cmp(b, a)) || a.id.localeCompare(b.id));
    return items;
  }

  /** @param {string} id */
  summary(id) {
    return this.index.find((s) => s.id === id) ?? null;
  }

  /**
   * @param {string} id
   * @returns {{ run: import('../recorder/RunValidator.js').RunRecord, warnings: string[] }}
   */
  get(id) {
    const raw = this.saveManager.readRaw(`${RUN_PREFIX}${id}`);
    if (raw === null) throw new LabError('NOT_FOUND', `Run « ${id} » introuvable.`);
    /** @type {unknown} */
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return this.fromBackup(id, 'contenu JSON illisible');
    }
    const v = validateRun(parsed);
    if (!v.ok || !v.run) return this.fromBackup(id, v.errors.join(' '));
    return { run: v.run, warnings: v.warnings };
  }

  /**
   * @param {string} id
   * @param {string} reason
   * @returns {{ run: import('../recorder/RunValidator.js').RunRecord, warnings: string[] }}
   */
  fromBackup(id, reason) {
    const bak = this.saveManager.readRaw(`${RUN_PREFIX}${id}.bak`);
    if (bak !== null) {
      try {
        const v = validateRun(JSON.parse(bak));
        if (v.ok && v.run) return { run: v.run, warnings: [`Version principale invalide (${reason}) : sauvegarde précédente utilisée.`, ...v.warnings] };
      } catch {
        /* la sauvegarde est aussi illisible : on signale l'erreur d'origine */
      }
    }
    throw new ValidationError(`Run « ${id} » invalide : ${reason}`, [reason]);
  }

  /**
   * @param {import('../recorder/RunValidator.js').RunRecord} run
   * @returns {RunSummary}
   */
  save(run) {
    const v = validateRun(run);
    if (!v.ok || !v.run) throw new ValidationError(`Run refusée : ${v.errors.join(' ')}`, v.errors);
    const { chars } = this.saveManager.writeAtomic(`${RUN_PREFIX}${run.id}`, v.run, {
      validate: (written) => {
        const check = validateRun(written);
        if (!check.ok) throw new Error(`relecture invalide : ${check.errors[0]}`);
      },
    });
    const summary = summarize(v.run, chars);
    const i = this.index.findIndex((s) => s.id === run.id);
    if (i >= 0) this.index[i] = summary;
    else this.index.push(summary);
    this.persistIndex();
    return summary;
  }

  /**
   * @param {string} id
   * @param {unknown} name
   */
  rename(id, name) {
    const clean = sanitizeRunName(name);
    const { run } = this.get(id);
    run.name = clean;
    run.updatedAt = new Date().toISOString();
    return this.save(run);
  }

  /** @param {string} id */
  duplicate(id) {
    const { run } = this.get(id);
    const copy = structuredClone(run);
    copy.id = createRunId();
    copy.name = `${run.name} (copie)`.slice(0, MAX_NAME_LENGTH);
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    return this.save(copy);
  }

  /** @param {string} id */
  delete(id) {
    const existed = this.index.some((s) => s.id === id) || this.saveManager.readRaw(`${RUN_PREFIX}${id}`) !== null;
    if (!existed) throw new LabError('NOT_FOUND', `Run « ${id} » introuvable.`);
    this.saveManager.remove(`${RUN_PREFIX}${id}`);
    this.index = this.index.filter((s) => s.id !== id);
    this.persistIndex();
  }

  /** @param {string} id @returns {string} */
  exportJson(id) {
    const { run } = this.get(id);
    return JSON.stringify(run);
  }

  /**
   * @param {string} text
   * @returns {{ summary: RunSummary, warnings: string[], renamedId: boolean }}
   */
  importJson(text) {
    if (typeof text !== 'string') throw new ValidationError('Contenu d\'import invalide.');
    if (text.length * 2 > MAX_IMPORT_BYTES) throw new ValidationError(`Fichier trop volumineux (> ${MAX_IMPORT_BYTES / 1024 / 1024} Mo).`);
    /** @type {unknown} */
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      throw new ValidationError(`JSON invalide ou tronqué : ${/** @type {Error} */ (e).message}`);
    }
    const v = validateRun(parsed);
    if (!v.ok || !v.run) throw new ValidationError(`Import refusé : ${v.errors.join(' ')}`, v.errors);
    const run = v.run;
    let renamedId = false;
    if (this.index.some((s) => s.id === run.id)) {
      // Jamais d'écrasement silencieux d'une run existante.
      run.id = createRunId();
      renamedId = true;
    }
    return { summary: this.save(run), warnings: v.warnings, renamedId };
  }
}
