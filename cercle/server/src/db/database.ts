import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';

export type Params = Record<string, SQLInputValue | boolean | undefined>;
type Row = Record<string, unknown>;

function bind(params?: Params): Record<string, SQLInputValue> {
  const out: Record<string, SQLInputValue> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    // node:sqlite refuse booléens et undefined : conversion explicite et centralisée.
    if (value === undefined) out[key] = null;
    else if (typeof value === 'boolean') out[key] = value ? 1 : 0;
    else out[key] = value;
  }
  return out;
}

/**
 * Accès SQLite synchrone. Toutes les sections critiques passent par `transaction()` :
 * comme l'exécution JS est mono-thread et que l'API est synchrone, aucune autre
 * opération du processus ne peut s'intercaler pendant une transaction.
 */
export class Database {
  readonly raw: DatabaseSync;
  readonly file: string;
  private readonly statements = new Map<string, StatementSync>();
  private depth = 0;
  private afterCommitQueue: Array<() => void> = [];
  private closed = false;

  constructor(file: string) {
    this.file = file;
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.raw = new DatabaseSync(file);
    this.raw.exec('PRAGMA foreign_keys = ON;');
    this.raw.exec('PRAGMA busy_timeout = 5000;');
    if (file !== ':memory:') {
      this.raw.exec('PRAGMA journal_mode = WAL;');
      this.raw.exec('PRAGMA synchronous = NORMAL;');
    }
  }

  private stmt(sql: string): StatementSync {
    let s = this.statements.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.statements.set(sql, s);
    }
    return s;
  }

  get<T = Row>(sql: string, params?: Params): T | undefined {
    return this.stmt(sql).get(bind(params)) as T | undefined;
  }

  all<T = Row>(sql: string, params?: Params): T[] {
    return this.stmt(sql).all(bind(params)) as T[];
  }

  run(sql: string, params?: Params): { changes: number; lastInsertRowid: number } {
    const r = this.stmt(sql).run(bind(params));
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
  }

  exec(sql: string): void {
    this.raw.exec(sql);
  }

  get inTransaction(): boolean {
    return this.depth > 0;
  }

  /**
   * Transaction imbriquable (SAVEPOINT). BEGIN IMMEDIATE prend le verrou d'écriture
   * dès le départ : un autre processus ne peut pas écrire entre la lecture et l'écriture.
   */
  transaction<T>(fn: () => T): T {
    const outer = this.depth === 0;
    const savepoint = `sp_${this.depth}`;
    const queueMark = this.afterCommitQueue.length;
    this.raw.exec(outer ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    this.depth++;
    try {
      const result = fn();
      if (result instanceof Promise) {
        throw new Error('transaction() ne doit pas recevoir de fonction asynchrone');
      }
      this.depth--;
      this.raw.exec(outer ? 'COMMIT' : `RELEASE ${savepoint}`);
      if (outer) this.flushAfterCommit();
      return result;
    } catch (err) {
      this.depth--;
      if (outer) {
        this.raw.exec('ROLLBACK');
        this.afterCommitQueue = [];
      } else {
        this.raw.exec(`ROLLBACK TO ${savepoint}`);
        this.raw.exec(`RELEASE ${savepoint}`);
        // Les effets différés du savepoint annulé ne doivent jamais être publiés.
        this.afterCommitQueue.length = queueMark;
      }
      throw err;
    }
  }

  /** Exécute `fn` après validation de la transaction courante (ou immédiatement hors transaction). */
  afterCommit(fn: () => void): void {
    if (this.depth === 0) fn();
    else this.afterCommitQueue.push(fn);
  }

  private flushAfterCommit(): void {
    const queue = this.afterCommitQueue;
    this.afterCommitQueue = [];
    for (const fn of queue) {
      try {
        fn();
      } catch (err) {
        console.error('[db] callback afterCommit en échec', err);
      }
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.statements.clear();
    this.raw.close();
  }
}
