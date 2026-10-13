import type { AppContext } from '../../context.js';
import type { TaskRow, TaskType } from '../../domain.js';
import { newId } from '../../lib/ids.js';
import { safeJsonParse } from '../../lib/text.js';

export interface TaskDto {
  id: string;
  type: TaskType;
  conversationId: string | null;
  characterId: string | null;
  runAt: number;
  status: TaskRow['status'];
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export const toTaskDto = (r: TaskRow): TaskDto => ({
  id: r.id,
  type: r.type,
  conversationId: r.conversation_id,
  characterId: r.character_id,
  runAt: r.run_at,
  status: r.status,
  attempts: r.attempts,
  maxAttempts: r.max_attempts,
  lastError: r.last_error,
  payload: safeJsonParse(r.payload_json, {}),
  result: r.result_json ? safeJsonParse(r.result_json, {}) : null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface ScheduleInput {
  type: TaskType;
  userId: string;
  conversationId?: string | null;
  characterId?: string | null;
  dedupeKey?: string | null;
  runAt: number;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}

/**
 * File de tâches persistante. Les transitions d'état sont « clôturées » par le compteur
 * de tentatives : une exécution qui a perdu son bail ne peut plus modifier la tâche.
 */
export class TaskRepository {
  constructor(private readonly ctx: AppContext) {}

  get(id: string): TaskRow | undefined {
    return this.ctx.db.get<TaskRow>('SELECT * FROM scheduled_tasks WHERE id = $id', { id });
  }

  findPending(dedupeKey: string): TaskRow | undefined {
    return this.ctx.db.get<TaskRow>(`SELECT * FROM scheduled_tasks WHERE dedupe_key = $k AND status = 'pending'`, { k: dedupeKey });
  }

  insert(input: ScheduleInput): TaskRow {
    const now = this.ctx.clock.now();
    const row: TaskRow = {
      id: newId('tsk'),
      type: input.type,
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      character_id: input.characterId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      run_at: Math.round(input.runAt),
      status: 'pending',
      payload_json: JSON.stringify(input.payload ?? {}),
      result_json: null,
      attempts: 0,
      max_attempts: input.maxAttempts ?? 3,
      lease_until: null,
      last_error: null,
      created_at: now,
      updated_at: now,
    };
    this.ctx.db.run(
      `INSERT INTO scheduled_tasks (id, type, user_id, conversation_id, character_id, dedupe_key, run_at, status,
         payload_json, result_json, attempts, max_attempts, lease_until, last_error, created_at, updated_at)
       VALUES ($id, $type, $user_id, $conversation_id, $character_id, $dedupe_key, $run_at, $status,
         $payload_json, $result_json, $attempts, $max_attempts, $lease_until, $last_error, $created_at, $updated_at)`,
      { ...row },
    );
    return row;
  }

  /**
   * Programme une tâche dédupliquée : si une tâche en attente existe déjà pour la clé,
   * `merge` décide de sa nouvelle échéance et de sa charge utile (regroupement).
   */
  upsert(
    input: ScheduleInput & { dedupeKey: string },
    merge: (existing: TaskRow) => { runAt: number; payload: Record<string, unknown> },
  ): TaskRow {
    return this.ctx.db.transaction(() => {
      const existing = this.findPending(input.dedupeKey);
      if (!existing) return this.insert(input);
      const next = merge(existing);
      this.ctx.db.run(`UPDATE scheduled_tasks SET run_at = $r, payload_json = $p, updated_at = $now WHERE id = $id`, {
        id: existing.id,
        r: Math.round(next.runAt),
        p: JSON.stringify(next.payload),
        now: this.ctx.clock.now(),
      });
      return this.get(existing.id)!;
    });
  }

  reschedule(id: string, runAt: number): void {
    this.ctx.db.run(`UPDATE scheduled_tasks SET run_at = $r, updated_at = $now WHERE id = $id AND status = 'pending'`, {
      id,
      r: Math.round(runAt),
      now: this.ctx.clock.now(),
    });
  }

  cancelPending(filter: { conversationId?: string; characterId?: string; types?: TaskType[] }, reason: string): TaskRow[] {
    const rows = this.ctx.db.all<TaskRow>(
      `SELECT * FROM scheduled_tasks WHERE status = 'pending'
         AND ($conv IS NULL OR conversation_id = $conv)
         AND ($char IS NULL OR character_id = $char)
         AND ($types IS NULL OR type IN (SELECT value FROM json_each($types)))`,
      {
        conv: filter.conversationId ?? null,
        char: filter.characterId ?? null,
        types: filter.types ? JSON.stringify(filter.types) : null,
      },
    );
    const now = this.ctx.clock.now();
    for (const r of rows) {
      this.ctx.db.run(
        `UPDATE scheduled_tasks SET status = 'cancelled', result_json = $res, updated_at = $now WHERE id = $id AND status = 'pending'`,
        { id: r.id, res: JSON.stringify({ reason }), now },
      );
    }
    return rows;
  }

  /** Réserve atomiquement les tâches échues, une seule par conversation à la fois. */
  claimDue(now: number, limit: number, leaseMs: number): TaskRow[] {
    return this.ctx.db.transaction(() => {
      const candidates = this.ctx.db.all<TaskRow>(
        `SELECT * FROM scheduled_tasks t WHERE t.status = 'pending' AND t.run_at <= $now
           AND (t.conversation_id IS NULL OR NOT EXISTS (
             SELECT 1 FROM scheduled_tasks r WHERE r.conversation_id = t.conversation_id AND r.status = 'running'))
         ORDER BY t.run_at, t.created_at LIMIT $l`,
        { now, l: limit * 3 },
      );
      const seenConversations = new Set<string>();
      const claimed: TaskRow[] = [];
      for (const t of candidates) {
        if (claimed.length >= limit) break;
        if (t.conversation_id) {
          if (seenConversations.has(t.conversation_id)) continue;
          seenConversations.add(t.conversation_id);
        }
        const r = this.ctx.db.run(
          `UPDATE scheduled_tasks SET status = 'running', attempts = attempts + 1, lease_until = $lease, updated_at = $now
           WHERE id = $id AND status = 'pending'`,
          { id: t.id, lease: now + leaseMs, now },
        );
        if (r.changes === 1) claimed.push({ ...t, status: 'running', attempts: t.attempts + 1, lease_until: now + leaseMs });
      }
      return claimed;
    });
  }

  /** Vrai si cette exécution (identifiée par son numéro de tentative) détient toujours la tâche. */
  isOwned(task: TaskRow): boolean {
    return !!this.ctx.db.get(`SELECT 1 FROM scheduled_tasks WHERE id = $id AND status = 'running' AND attempts = $a`, {
      id: task.id,
      a: task.attempts,
    });
  }

  finish(task: TaskRow, status: 'done' | 'cancelled' | 'superseded' | 'failed', result?: unknown, error?: string): boolean {
    const r = this.ctx.db.run(
      `UPDATE scheduled_tasks SET status = $s, result_json = $res, last_error = COALESCE($err, last_error),
         lease_until = NULL, updated_at = $now
       WHERE id = $id AND status = 'running' AND attempts = $a`,
      {
        id: task.id,
        a: task.attempts,
        s: status,
        res: result === undefined ? null : JSON.stringify(result),
        err: error ?? null,
        now: this.ctx.clock.now(),
      },
    );
    return r.changes === 1;
  }

  retry(task: TaskRow, runAt: number, error: string): boolean {
    const r = this.ctx.db.run(
      `UPDATE scheduled_tasks SET status = 'pending', run_at = $r, last_error = $err, lease_until = NULL, updated_at = $now
       WHERE id = $id AND status = 'running' AND attempts = $a`,
      { id: task.id, a: task.attempts, r: Math.round(runAt), err: error.slice(0, 1000), now: this.ctx.clock.now() },
    );
    return r.changes === 1;
  }

  /**
   * Après redémarrage (ou bail expiré), les tâches « running » orphelines repassent en
   * attente. Leur ré-exécution est sans risque de doublon : les messages produits portent
   * une clé d'idempotence dérivée de l'identifiant de tâche.
   */
  recoverOrphans(now: number, onlyExpired: boolean): TaskRow[] {
    const rows = this.ctx.db.all<TaskRow>(
      `SELECT * FROM scheduled_tasks WHERE status = 'running' AND ($expired = 0 OR lease_until < $now)`,
      { expired: onlyExpired ? 1 : 0, now },
    );
    for (const r of rows) {
      // Une tâche dédupliquée peut avoir été remplacée entre-temps par une nouvelle tâche en attente.
      const clash = r.dedupe_key ? this.findPending(r.dedupe_key) : undefined;
      this.ctx.db.run(
        `UPDATE scheduled_tasks SET status = $s, lease_until = NULL, last_error = $err, updated_at = $now WHERE id = $id`,
        {
          id: r.id,
          s: clash ? 'superseded' : 'pending',
          err: 'Exécution interrompue (redémarrage ou bail expiré)',
          now,
        },
      );
    }
    return rows;
  }

  list(filter: { status?: string; type?: string; limit?: number }): TaskDto[] {
    return this.ctx.db
      .all<TaskRow>(
        `SELECT * FROM scheduled_tasks WHERE ($s IS NULL OR status = $s) AND ($t IS NULL OR type = $t)
         ORDER BY CASE WHEN status IN ('pending','running') THEN 0 ELSE 1 END, run_at DESC LIMIT $l`,
        { s: filter.status ?? null, t: filter.type ?? null, l: Math.min(filter.limit ?? 200, 1000) },
      )
      .map(toTaskDto);
  }

  counts(): Record<string, number> {
    const rows = this.ctx.db.all<{ status: string; n: number }>('SELECT status, COUNT(*) AS n FROM scheduled_tasks GROUP BY status');
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  }

  pruneFinished(olderThan: number): void {
    this.ctx.db.run(
      `DELETE FROM scheduled_tasks WHERE status IN ('done','cancelled','superseded') AND updated_at < $t`,
      { t: olderThan },
    );
  }
}
