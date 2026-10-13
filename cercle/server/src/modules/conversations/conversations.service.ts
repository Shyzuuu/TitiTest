import type { AppContext } from '../../context.js';
import type { ConversationRow, MessageRow } from '../../domain.js';
import { notFound } from '../../lib/errors.js';
import { preview } from '../../lib/text.js';

export interface ConversationSummary {
  id: string;
  characterId: string;
  version: number;
  lastMessage: {
    id: string;
    seq: number;
    authorType: 'user' | 'character';
    preview: string;
    origin: string;
    deleted: boolean;
    createdAt: number;
  } | null;
  lastMessageAt: number | null;
  unreadCount: number;
  /** Prochaine réponse IA programmée à ma place (si présente). */
  pendingAiReply: { taskId: string; runAt: number; status: 'pending' | 'running' } | null;
  /** Prochaine réponse programmée du personnage (si présente). */
  pendingCharacterReply: { taskId: string; runAt: number; status: 'pending' | 'running' } | null;
  pendingSuggestions: number;
  autoChain: number;
  createdAt: number;
}

export class ConversationService {
  constructor(private readonly ctx: AppContext) {}

  getRow(id: string): ConversationRow | undefined {
    return this.ctx.db.get<ConversationRow>('SELECT * FROM conversations WHERE id = $id', { id });
  }

  /** Vérifie l'appartenance : toute route qui manipule une conversation passe par ici. */
  getOwned(userId: string, id: string): ConversationRow {
    const row = this.ctx.db.get<ConversationRow>('SELECT * FROM conversations WHERE id = $id AND user_id = $u', {
      id,
      u: userId,
    });
    if (!row) throw notFound('Conversation introuvable.');
    return row;
  }

  idForCharacter(userId: string, characterId: string): string | null {
    return (
      this.ctx.db.get<{ id: string }>('SELECT id FROM conversations WHERE user_id = $u AND character_id = $c', {
        u: userId,
        c: characterId,
      })?.id ?? null
    );
  }

  summary(id: string): ConversationSummary {
    const conv = this.getRow(id);
    if (!conv) throw notFound('Conversation introuvable.');
    const db = this.ctx.db;
    const last = conv.last_message_id
      ? db.get<MessageRow>('SELECT * FROM messages WHERE id = $id', { id: conv.last_message_id })
      : undefined;
    const unread =
      db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM messages
         WHERE conversation_id = $id AND author_type = 'character' AND read_at IS NULL AND status = 'sent'`,
        { id },
      )?.n ?? 0;
    const pending = db.all<{ id: string; type: string; run_at: number; status: 'pending' | 'running' }>(
      `SELECT id, type, run_at, status FROM scheduled_tasks
       WHERE conversation_id = $id AND status IN ('pending','running') AND type IN ('ai_reply','character_reply')
       ORDER BY run_at`,
      { id },
    );
    const ai = pending.find((t) => t.type === 'ai_reply');
    const reply = pending.find((t) => t.type === 'character_reply');
    const suggestions =
      db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ai_suggestions WHERE conversation_id = $id AND status = 'pending'`, {
        id,
      })?.n ?? 0;
    return {
      id: conv.id,
      characterId: conv.character_id,
      version: conv.version,
      lastMessage: last
        ? {
            id: last.id,
            seq: last.seq,
            authorType: last.author_type,
            preview: last.status === 'deleted' ? '' : preview(last.content, 90),
            origin: last.origin,
            deleted: last.status === 'deleted',
            createdAt: last.created_at,
          }
        : null,
      lastMessageAt: conv.last_message_at,
      unreadCount: unread,
      pendingAiReply: ai ? { taskId: ai.id, runAt: ai.run_at, status: ai.status } : null,
      pendingCharacterReply: reply ? { taskId: reply.id, runAt: reply.run_at, status: reply.status } : null,
      pendingSuggestions: suggestions,
      autoChain: conv.auto_chain,
      createdAt: conv.created_at,
    };
  }

  list(userId: string): ConversationSummary[] {
    const ids = this.ctx.db.all<{ id: string }>(
      'SELECT id FROM conversations WHERE user_id = $u ORDER BY COALESCE(last_message_at, created_at) DESC',
      { u: userId },
    );
    return ids.map((r) => this.summary(r.id));
  }

  publishSummary(userId: string, conversationId: string): void {
    this.ctx.bus.publish(userId, 'conversation.updated', { conversation: this.summary(conversationId) });
  }

  /**
   * Marque comme lus les messages du personnage jusqu'à `upToSeq` inclus.
   * La lecture est une donnée du message : boîte mail et compteurs restent cohérents.
   */
  markRead(userId: string, conversationId: string, upToSeq?: number): { updated: number } {
    const conv = this.getOwned(userId, conversationId);
    const limit = upToSeq ?? conv.next_seq;
    const now = this.ctx.clock.now();
    return this.ctx.db.transaction(() => {
      const ids = this.ctx.db
        .all<{ id: string }>(
          `SELECT id FROM messages WHERE conversation_id = $c AND author_type = 'character'
           AND read_at IS NULL AND seq <= $s`,
          { c: conversationId, s: limit },
        )
        .map((r) => r.id);
      if (ids.length === 0) return { updated: 0 };
      this.ctx.db.run(
        `UPDATE messages SET read_at = $now WHERE conversation_id = $c AND author_type = 'character'
         AND read_at IS NULL AND seq <= $s`,
        { now, c: conversationId, s: limit },
      );
      this.ctx.notifications.markConversationRead(userId, conversationId);
      this.ctx.bus.publish(userId, 'messages.read', { conversationId, messageIds: ids, readAt: now });
      // La lecture est partagée avec la boîte mail : ses compteurs changent aussi.
      this.ctx.bus.publish(userId, 'mailbox.changed', { reason: 'read', counts: this.ctx.mailbox.counts(userId) });
      this.publishSummary(userId, conversationId);
      return { updated: ids.length };
    });
  }
}
