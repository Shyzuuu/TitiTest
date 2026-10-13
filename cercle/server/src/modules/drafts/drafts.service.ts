import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest } from '../../lib/errors.js';
import { sanitizeUserText } from '../../lib/text.js';

export interface DraftDto {
  conversationId: string;
  content: string;
  replyToMessageId: string | null;
  updatedAt: number;
}

export const draftSchema = z
  .object({
    content: z.string().max(8000),
    replyToMessageId: z.string().max(64).nullable().optional(),
    /** Horodatage client : une sauvegarde plus ancienne ne peut pas écraser une plus récente. */
    clientUpdatedAt: z.number().int().positive().optional(),
  })
  .strict();

/** Brouillons persistés par conversation : jamais partagés entre deux conversations. */
export class DraftService {
  constructor(private readonly ctx: AppContext) {}

  list(userId: string): DraftDto[] {
    return this.ctx.db
      .all<{ conversation_id: string; content: string; reply_to_message_id: string | null; updated_at: number }>(
        `SELECT d.* FROM drafts d JOIN conversations c ON c.id = d.conversation_id WHERE c.user_id = $u`,
        { u: userId },
      )
      .map((r) => ({
        conversationId: r.conversation_id,
        content: r.content,
        replyToMessageId: r.reply_to_message_id,
        updatedAt: r.updated_at,
      }));
  }

  save(userId: string, conversationId: string, body: unknown): DraftDto | null {
    const parsed = draftSchema.safeParse(body);
    if (!parsed.success) throw badRequest('Brouillon invalide.', parsed.error.flatten());
    this.ctx.conversations.getOwned(userId, conversationId);
    const content = parsed.data.content.replace(/\r\n?/g, '\n');
    const replyTo = parsed.data.replyToMessageId ?? null;
    const updatedAt = parsed.data.clientUpdatedAt ?? this.ctx.clock.now();
    return this.ctx.db.transaction(() => {
      const current = this.ctx.db.get<{ updated_at: number }>('SELECT updated_at FROM drafts WHERE conversation_id = $c', {
        c: conversationId,
      });
      if (current && current.updated_at > updatedAt) return null;
      if (replyTo) {
        const ok = this.ctx.db.get('SELECT 1 FROM messages WHERE id = $id AND conversation_id = $c', {
          id: replyTo,
          c: conversationId,
        });
        if (!ok) throw badRequest('Le message cité n’appartient pas à cette conversation.');
      }
      if (!sanitizeUserText(content) && !replyTo) {
        this.ctx.db.run('DELETE FROM drafts WHERE conversation_id = $c', { c: conversationId });
        return null;
      }
      this.ctx.db.run(
        `INSERT INTO drafts (conversation_id, content, reply_to_message_id, updated_at) VALUES ($c, $content, $r, $t)
         ON CONFLICT(conversation_id) DO UPDATE SET content = excluded.content,
           reply_to_message_id = excluded.reply_to_message_id, updated_at = excluded.updated_at`,
        { c: conversationId, content, r: replyTo, t: updatedAt },
      );
      return { conversationId, content, replyToMessageId: replyTo, updatedAt };
    });
  }

  /** Après envoi, le brouillon correspondant au texte envoyé n'a plus lieu d'être. */
  clearIfMatches(_userId: string, conversationId: string, sentContent: string): void {
    const draft = this.ctx.db.get<{ content: string }>('SELECT content FROM drafts WHERE conversation_id = $c', {
      c: conversationId,
    });
    if (draft && sanitizeUserText(draft.content) === sentContent) {
      this.ctx.db.run('DELETE FROM drafts WHERE conversation_id = $c', { c: conversationId });
    }
  }
}
