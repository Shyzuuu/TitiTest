import type { Database } from '../db/database.js';
import type { Clock } from '../lib/clock.js';

export interface RealtimeEvent {
  /** Numéro de séquence global ; null pour les événements éphémères (frappe en cours). */
  seq: number | null;
  type: string;
  payload: unknown;
  createdAt: number;
}

export type EventSink = (userId: string, event: RealtimeEvent) => void;

const EVENT_RETENTION = 5000;

/**
 * Journal d'événements persistant (outbox). L'écriture se fait dans la transaction
 * métier ; la diffusion n'a lieu qu'après validation, ce qui garantit qu'un client ne
 * reçoit jamais un événement annulé. Les clients rattrapent les trous via `since()`.
 */
export class EventBus {
  private sinks = new Set<EventSink>();
  private publishedCount = 0;

  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  subscribe(sink: EventSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }

  publish(userId: string, type: string, payload: unknown): void {
    const createdAt = this.clock.now();
    const { lastInsertRowid } = this.db.run(
      'INSERT INTO events (user_id, type, payload_json, created_at) VALUES ($u, $t, $p, $c)',
      { u: userId, t: type, p: JSON.stringify(payload), c: createdAt },
    );
    const event: RealtimeEvent = { seq: lastInsertRowid, type, payload, createdAt };
    this.db.afterCommit(() => this.dispatch(userId, event));
    if (++this.publishedCount % 500 === 0) {
      this.db.run('DELETE FROM events WHERE seq <= $limit', { limit: lastInsertRowid - EVENT_RETENTION });
    }
  }

  ephemeral(userId: string, type: string, payload: unknown): void {
    this.dispatch(userId, { seq: null, type, payload, createdAt: this.clock.now() });
  }

  lastSeq(userId: string): number {
    return this.db.get<{ s: number | null }>('SELECT MAX(seq) AS s FROM events WHERE user_id = $u', { u: userId })?.s ?? 0;
  }

  /** Événements postérieurs à `after`. `reset` indique que l'historique est incomplet (purgé). */
  since(userId: string, after: number, limit = 500): { events: RealtimeEvent[]; reset: boolean; lastSeq: number } {
    const oldest = this.db.get<{ s: number | null }>('SELECT MIN(seq) AS s FROM events WHERE user_id = $u', { u: userId })?.s;
    const lastSeq = this.lastSeq(userId);
    if (after > lastSeq) return { events: [], reset: true, lastSeq };
    if (oldest != null && after < oldest - 1) return { events: [], reset: true, lastSeq };
    const rows = this.db.all<{ seq: number; type: string; payload_json: string; created_at: number }>(
      'SELECT seq, type, payload_json, created_at FROM events WHERE user_id = $u AND seq > $a ORDER BY seq LIMIT $l',
      { u: userId, a: after, l: limit + 1 },
    );
    if (rows.length > limit) return { events: [], reset: true, lastSeq };
    return {
      events: rows.map((r) => ({ seq: r.seq, type: r.type, payload: JSON.parse(r.payload_json), createdAt: r.created_at })),
      reset: false,
      lastSeq,
    };
  }

  private dispatch(userId: string, event: RealtimeEvent): void {
    for (const sink of this.sinks) {
      try {
        sink(userId, event);
      } catch (err) {
        console.error('[events] diffusion en échec', err);
      }
    }
  }
}
