import type { AppContext } from '../../context.js';
import type { TaskRow, TaskType } from '../../domain.js';
import { errorMessage, TaskError } from '../../lib/errors.js';
import { AiProviderError } from '../ai/types.js';
import { createHandlers, LostOwnership, type TaskHandler, type TaskOutcome } from './handlers.js';

const LEASE_MS = 5 * 60_000;
const BATCH_SIZE = 20;
const PRUNE_EVERY_MS = 60 * 60_000;
const KEEP_FINISHED_MS = 7 * 24 * 3600_000;

export interface SchedulerStatus {
  running: boolean;
  paused: boolean;
  lastTickAt: number | null;
  inFlight: number;
  processed: number;
  failures: number;
}

/**
 * Boucle de traitement de la file persistante. Les tâches survivent au redémarrage et
 * à la fermeture du navigateur : seul le serveur les exécute.
 */
export class Scheduler {
  private timer: NodeJS.Timeout | null = null;
  private readonly handlers: Record<TaskType, TaskHandler>;
  private readonly inFlight = new Set<Promise<void>>();
  private ticking: Promise<number> | null = null;
  private lastTickAt: number | null = null;
  private lastPruneAt = 0;
  private processed = 0;
  private failures = 0;

  constructor(private readonly ctx: AppContext) {
    this.handlers = createHandlers(ctx);
  }

  /** Démarrage : les exécutions interrompues par un arrêt brutal sont réconciliées. */
  start(): void {
    if (this.timer) return;
    const recovered = this.ctx.db.transaction(() => this.ctx.tasks.recoverOrphans(this.ctx.clock.now(), false));
    if (recovered.length) {
      this.ctx.logger.warn('scheduler', `${recovered.length} tâche(s) interrompue(s) réconciliée(s) au démarrage`, {
        ids: recovered.map((t) => t.id),
      });
    }
    this.timer = setInterval(() => void this.tick(), this.ctx.config.schedulerIntervalMs);
    this.timer.unref?.();
    this.ctx.logger.info('scheduler', 'Planificateur démarré');
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.drain();
  }

  async drain(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.allSettled([...this.inFlight]);
  }

  status(): SchedulerStatus {
    return {
      running: this.timer !== null,
      paused: this.ctx.settings.get().automationPaused,
      lastTickAt: this.lastTickAt,
      inFlight: this.inFlight.size,
      processed: this.processed,
      failures: this.failures,
    };
  }

  /** Un passage : réserve les tâches échues et attend leur exécution. Sans chevauchement. */
  tick(): Promise<number> {
    if (this.ticking) return this.ticking;
    this.ticking = this.runTick().finally(() => {
      this.ticking = null;
    });
    return this.ticking;
  }

  private async runTick(): Promise<number> {
    const now = this.ctx.clock.now();
    this.lastTickAt = now;
    if (now - this.lastPruneAt > PRUNE_EVERY_MS) {
      this.lastPruneAt = now;
      this.ctx.tasks.pruneFinished(now - KEEP_FINISHED_MS);
    }
    const expired = this.ctx.db.transaction(() => this.ctx.tasks.recoverOrphans(now, true));
    if (expired.length) this.ctx.logger.warn('scheduler', `${expired.length} tâche(s) au bail expiré remise(s) en file`);
    if (this.ctx.settings.get().automationPaused) return 0;
    const tasks = this.ctx.tasks.claimDue(now, BATCH_SIZE, LEASE_MS);
    if (tasks.length === 0) return 0;
    for (const t of tasks) if (t.conversation_id) this.ctx.conversations.publishSummary(t.user_id, t.conversation_id);
    const runs = tasks.map((t) => this.track(this.execute(t)));
    await Promise.allSettled(runs);
    return tasks.length;
  }

  /** Exécute immédiatement les tâches échues jusqu'à épuisement (utile aux tests et démonstrations). */
  async runUntilIdle(maxRounds = 50): Promise<number> {
    let total = 0;
    for (let i = 0; i < maxRounds; i++) {
      const n = await this.tick();
      total += n;
      if (n === 0) break;
    }
    return total;
  }

  private track(p: Promise<void>): Promise<void> {
    this.inFlight.add(p);
    return p.finally(() => this.inFlight.delete(p));
  }

  private async execute(task: TaskRow): Promise<void> {
    const handler = this.handlers[task.type];
    let outcome: TaskOutcome | null = null;
    try {
      if (!handler) throw new TaskError(`Type de tâche inconnu : ${task.type}`, false);
      outcome = await handler(task);
      if (!this.ctx.tasks.finish(task, outcome.status, outcome.result ?? {})) {
        this.ctx.logger.warn('scheduler', `Clôture ignorée : la tâche ${task.id} ne nous appartient plus`);
      }
      this.processed++;
    } catch (err) {
      if (err instanceof LostOwnership) {
        this.ctx.logger.warn('scheduler', err.message);
        return;
      }
      this.handleFailure(task, err);
    } finally {
      this.afterSettled(task, outcome);
    }
  }

  private handleFailure(task: TaskRow, err: unknown): void {
    const message = errorMessage(err);
    const retryable =
      err instanceof TaskError ? err.retryable : err instanceof AiProviderError ? err.retryable : true;
    if (retryable && task.attempts < task.max_attempts) {
      const backoff = this.ctx.settings.scaleMs(10_000 * 2 ** (task.attempts - 1));
      this.ctx.tasks.retry(task, this.ctx.clock.now() + backoff, message);
      this.ctx.logger.warn('scheduler', `Tâche ${task.type} en échec, nouvel essai prévu`, { id: task.id, error: message });
      return;
    }
    this.failures++;
    this.ctx.db.transaction(() => {
      this.ctx.tasks.finish(task, 'failed', { error: message }, message);
      this.ctx.logger.error('scheduler', `Tâche ${task.type} définitivement en échec`, { id: task.id, error: message });
      if (task.type === 'ai_reply' || task.type === 'character_reply') {
        const character = task.character_id ? this.ctx.characters.findById(task.character_id) : null;
        this.ctx.notifications.create(task.user_id, {
          type: task.type === 'ai_reply' ? 'ai_error' : 'task_failed',
          conversationId: task.conversation_id,
          title:
            task.type === 'ai_reply'
              ? `Échec de la réponse IA pour ${character?.fullName ?? 'un contact'}`
              : `${character?.fullName ?? 'Un contact'} n'a pas pu répondre`,
          body: message,
        });
      }
    });
  }

  private afterSettled(task: TaskRow, outcome: TaskOutcome | null): void {
    try {
      if (task.type === 'character_initiate' && task.character_id) {
        const cancelled = outcome?.status === 'cancelled';
        const stillRunning = this.ctx.tasks.get(task.id)?.status === 'pending'; // réessai programmé
        if (!cancelled && !stillRunning) this.ctx.automation.scheduleNextInitiation(task.user_id, task.character_id, false);
      }
      if (task.conversation_id && this.ctx.conversations.getRow(task.conversation_id)) {
        this.ctx.conversations.publishSummary(task.user_id, task.conversation_id);
      }
    } catch (err) {
      this.ctx.logger.error('scheduler', 'Post-traitement de tâche en échec', { id: task.id, error: errorMessage(err) });
    }
  }
}
