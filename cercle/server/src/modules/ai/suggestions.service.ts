import { z } from 'zod';
import type { AppContext } from '../../context.js';
import type { MessageDto } from '../../domain.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';

export interface SuggestionDto {
  id: string;
  conversationId: string;
  content: string;
  reason: string | null;
  status: 'pending' | 'sent' | 'discarded' | 'stale';
  createdAt: number;
}

interface SuggestionRow {
  id: string;
  conversation_id: string;
  task_id: string | null;
  content: string;
  anchor_user_seq: number;
  reason: string | null;
  status: SuggestionDto['status'];
  created_at: number;
  updated_at: number;
}

const toDto = (r: SuggestionRow): SuggestionDto => ({
  id: r.id,
  conversationId: r.conversation_id,
  content: r.content,
  reason: r.reason,
  status: r.status,
  createdAt: r.created_at,
});

export const sendSuggestionSchema = z.object({ content: z.string().max(8000).optional() }).strict();

/** Réponses préparées par l'IA, en attente de validation de l'utilisateur. */
export class SuggestionService {
  constructor(private readonly ctx: AppContext) {}

  listPending(userId: string): SuggestionDto[] {
    return this.ctx.db
      .all<SuggestionRow>(
        `SELECT s.* FROM ai_suggestions s JOIN conversations c ON c.id = s.conversation_id
         WHERE c.user_id = $u AND s.status = 'pending' ORDER BY s.created_at`,
        { u: userId },
      )
      .map(toDto);
  }

  create(userId: string, input: { conversationId: string; taskId: string; content: string; anchorUserSeq: number; reason: string | null }): SuggestionDto {
    const now = this.ctx.clock.now();
    // Une seule suggestion active par conversation : la nouvelle remplace l'ancienne.
    this.markStale(userId, input.conversationId);
    const row: SuggestionRow = {
      id: newId('sug'),
      conversation_id: input.conversationId,
      task_id: input.taskId,
      content: input.content,
      anchor_user_seq: input.anchorUserSeq,
      reason: input.reason,
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    this.ctx.db.run(
      `INSERT INTO ai_suggestions (id, conversation_id, task_id, content, anchor_user_seq, reason, status, created_at, updated_at)
       VALUES ($id, $conversation_id, $task_id, $content, $anchor_user_seq, $reason, $status, $created_at, $updated_at)`,
      { ...row },
    );
    const dto = toDto(row);
    this.ctx.bus.publish(userId, 'suggestion.upserted', { suggestion: dto });
    this.ctx.conversations.publishSummary(userId, input.conversationId);
    return dto;
  }

  markStale(userId: string, conversationId: string): void {
    const ids = this.ctx.db
      .all<{ id: string }>(`SELECT id FROM ai_suggestions WHERE conversation_id = $c AND status = 'pending'`, { c: conversationId })
      .map((r) => r.id);
    if (ids.length === 0) return;
    this.ctx.db.run(`UPDATE ai_suggestions SET status = 'stale', updated_at = $now WHERE conversation_id = $c AND status = 'pending'`, {
      c: conversationId,
      now: this.ctx.clock.now(),
    });
    for (const id of ids) this.ctx.bus.publish(userId, 'suggestion.removed', { id, conversationId, status: 'stale' });
  }

  private owned(userId: string, id: string): SuggestionRow {
    const row = this.ctx.db.get<SuggestionRow>(
      `SELECT s.* FROM ai_suggestions s JOIN conversations c ON c.id = s.conversation_id WHERE s.id = $id AND c.user_id = $u`,
      { id, u: userId },
    );
    if (!row) throw notFound('Suggestion introuvable.');
    return row;
  }

  /** Validation par l'utilisateur : le message envoyé est un message humain (priorité manuelle). */
  send(userId: string, id: string, body: unknown): MessageDto {
    const parsed = sendSuggestionSchema.safeParse(body ?? {});
    if (!parsed.success) throw badRequest('Suggestion invalide.', parsed.error.flatten());
    const row = this.owned(userId, id);
    if (row.status === 'sent') {
      const existing = this.ctx.db.get<{ id: string }>('SELECT id FROM messages WHERE conversation_id = $c AND client_id = $k', {
        c: row.conversation_id,
        k: `sug:${id}`,
      });
      if (existing) return this.ctx.messages.toDtos([this.ctx.messages.getRow(existing.id)!])[0]!;
    }
    if (row.status !== 'pending') throw conflict('Cette suggestion n’est plus d’actualité.');
    return this.ctx.db.transaction(() => {
      this.ctx.db.run(`UPDATE ai_suggestions SET status = 'sent', updated_at = $now WHERE id = $id`, {
        id,
        now: this.ctx.clock.now(),
      });
      this.ctx.bus.publish(userId, 'suggestion.removed', { id, conversationId: row.conversation_id, status: 'sent' });
      const { message } = this.ctx.messages.sendFromUser(
        userId,
        row.conversation_id,
        { content: parsed.data.content ?? row.content, clientId: `sug:${id}` },
        'ai_suggestion',
      );
      return message;
    });
  }

  discard(userId: string, id: string): void {
    const row = this.owned(userId, id);
    if (row.status !== 'pending') return;
    this.ctx.db.transaction(() => {
      this.ctx.db.run(`UPDATE ai_suggestions SET status = 'discarded', updated_at = $now WHERE id = $id`, {
        id,
        now: this.ctx.clock.now(),
      });
      this.ctx.bus.publish(userId, 'suggestion.removed', { id, conversationId: row.conversation_id, status: 'discarded' });
      this.ctx.conversations.publishSummary(userId, row.conversation_id);
    });
  }
}
