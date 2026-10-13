import { z } from 'zod';
import type { AppContext } from '../../context.js';
import type { ConversationRow, MessageDto, MessageOrigin, MessageRow } from '../../domain.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { safeJsonParse, sanitizeUserText } from '../../lib/text.js';

export const MAX_MESSAGE_LENGTH = 4000;

export const sendMessageSchema = z
  .object({
    content: z.string().max(MAX_MESSAGE_LENGTH * 2),
    replyToMessageId: z.string().max(64).nullable().optional(),
    /** Clé d'idempotence générée par le client : un renvoi après coupure réseau ne duplique pas. */
    clientId: z
      .string()
      .min(8)
      .max(80)
      .regex(/^[A-Za-z0-9_\-:.]+$/),
  })
  .strict();

interface InsertInput {
  conversationId: string;
  authorType: 'user' | 'character';
  authorId: string;
  content: string;
  origin: MessageOrigin;
  replyToMessageId?: string | null;
  clientId?: string | null;
  meta?: Record<string, unknown>;
}

export class MessageService {
  constructor(private readonly ctx: AppContext) {}

  getRow(id: string): MessageRow | undefined {
    return this.ctx.db.get<MessageRow>('SELECT * FROM messages WHERE id = $id', { id });
  }

  /**
   * Insertion bas niveau, à appeler dans une transaction. Aucune règle sur l'auteur
   * précédent : plusieurs messages consécutifs du même auteur sont légitimes, et l'on
   * peut citer n'importe quel message de la même conversation, y compris les siens.
   */
  insert(input: InsertInput): { message: MessageRow; created: boolean } {
    const db = this.ctx.db;
    if (!db.inTransaction) throw new Error('MessageService.insert doit être appelé dans une transaction');
    if (input.clientId) {
      const existing = db.get<MessageRow>('SELECT * FROM messages WHERE conversation_id = $c AND client_id = $k', {
        c: input.conversationId,
        k: input.clientId,
      });
      if (existing) return { message: existing, created: false };
    }
    const conv = db.get<ConversationRow>('SELECT * FROM conversations WHERE id = $id', { id: input.conversationId });
    if (!conv) throw notFound('Conversation introuvable.');
    let replyTo: MessageRow | undefined;
    if (input.replyToMessageId) {
      replyTo = this.getRow(input.replyToMessageId);
      if (!replyTo || replyTo.conversation_id !== conv.id) {
        throw badRequest('Le message cité n’appartient pas à cette conversation.');
      }
    }
    const now = this.ctx.clock.now();
    const seq = conv.next_seq;
    const row: MessageRow = {
      id: newId('msg'),
      conversation_id: conv.id,
      seq,
      author_type: input.authorType,
      author_id: input.authorId,
      content: input.content,
      origin: input.origin,
      status: 'sent',
      reply_to_message_id: replyTo?.id ?? null,
      client_id: input.clientId ?? null,
      // L'identifiant cité est dupliqué dans meta : si l'original est purgé, la citation reste signalée.
      meta_json: JSON.stringify({ ...(input.meta ?? {}), ...(replyTo ? { replyToId: replyTo.id } : {}) }),
      created_at: now,
      // Ses propres messages sont lus par définition.
      read_at: input.authorType === 'user' ? now : null,
      deleted_at: null,
    };
    db.run(
      `INSERT INTO messages (id, conversation_id, seq, author_type, author_id, content, origin, status,
         reply_to_message_id, client_id, meta_json, created_at, read_at, deleted_at)
       VALUES ($id, $conversation_id, $seq, $author_type, $author_id, $content, $origin, $status,
         $reply_to_message_id, $client_id, $meta_json, $created_at, $read_at, $deleted_at)`,
      { ...row },
    );
    db.run(
      `UPDATE conversations SET next_seq = $next, version = version + 1, last_message_id = $mid, last_message_at = $now,
         last_user_seq = CASE WHEN $author = 'user' THEN $seq ELSE last_user_seq END,
         last_character_seq = CASE WHEN $author = 'character' THEN $seq ELSE last_character_seq END,
         updated_at = $now
       WHERE id = $id`,
      { next: seq + 1, mid: row.id, now, author: input.authorType, seq, id: conv.id },
    );
    return { message: row, created: true };
  }

  /**
   * Envoi d'un message par l'utilisateur (saisie manuelle ou suggestion IA validée).
   * La conversation cible est celle de l'URL de la requête, jamais un « état actif » :
   * changer de conversation pendant l'envoi ne peut pas réattribuer le message.
   */
  sendFromUser(
    userId: string,
    conversationId: string,
    body: unknown,
    origin: Extract<MessageOrigin, 'manual' | 'ai_suggestion'> = 'manual',
  ): { message: MessageDto; created: boolean } {
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) throw badRequest('Message invalide.', parsed.error.flatten());
    const content = sanitizeUserText(parsed.data.content);
    if (!content) throw badRequest('Le message est vide.');
    if (content.length > MAX_MESSAGE_LENGTH) throw badRequest(`Le message dépasse ${MAX_MESSAGE_LENGTH} caractères.`);
    const conv = this.ctx.conversations.getOwned(userId, conversationId);

    const result = this.ctx.db.transaction(() => {
      const { message, created } = this.insert({
        conversationId: conv.id,
        authorType: 'user',
        authorId: userId,
        content,
        origin,
        replyToMessageId: parsed.data.replyToMessageId ?? null,
        clientId: parsed.data.clientId,
      });
      if (!created) return { message, created };
      this.afterUserMessage(userId, conv, message);
      return { message, created };
    });
    return { message: this.toDtos([result.message])[0]!, created: result.created };
  }

  /** Effets d'un message humain : priorité absolue sur toute réponse IA en attente. */
  private afterUserMessage(userId: string, conv: ConversationRow, message: MessageRow): void {
    const db = this.ctx.db;
    db.run('UPDATE conversations SET auto_chain = 0 WHERE id = $id', { id: conv.id });
    this.ctx.automation.onManualUserMessage(userId, conv.id, message);
    this.ctx.suggestions.markStale(userId, conv.id);
    // Répondre implique d'avoir lu ce qui précède.
    db.run(
      `UPDATE messages SET read_at = $now WHERE conversation_id = $c AND author_type = 'character'
       AND read_at IS NULL AND seq < $s`,
      { now: message.created_at, c: conv.id, s: message.seq },
    );
    this.ctx.notifications.markConversationRead(userId, conv.id);
    this.ctx.mailbox.recordMessage(userId, conv, message);
    this.ctx.memory.learnFromUserMessage(conv.character_id, message);
    this.publishCreated(userId, message);
    this.ctx.drafts.clearIfMatches(userId, conv.id, message.content);
  }

  /** Message émis automatiquement « en mon nom » par l'IA (mode automatique). */
  insertAiAuto(userId: string, conv: ConversationRow, content: string, clientId: string): MessageRow | null {
    const { message, created } = this.insert({
      conversationId: conv.id,
      authorType: 'user',
      authorId: userId,
      content,
      origin: 'ai_auto',
      clientId,
    });
    if (!created) return null;
    this.ctx.db.run('UPDATE conversations SET auto_chain = auto_chain + 1 WHERE id = $id', { id: conv.id });
    this.ctx.mailbox.recordMessage(userId, conv, message);
    this.publishCreated(userId, message);
    return message;
  }

  /** Message écrit par le personnage (réponse, relance ou message spontané). */
  insertFromCharacter(
    userId: string,
    conv: ConversationRow,
    content: string,
    origin: Extract<MessageOrigin, 'simulation' | 'character_reply'>,
    clientId: string,
    meta?: Record<string, unknown>,
  ): MessageRow | null {
    const { message, created } = this.insert({
      conversationId: conv.id,
      authorType: 'character',
      authorId: conv.character_id,
      content,
      origin,
      clientId,
      meta,
    });
    if (!created) return null;
    this.ctx.mailbox.recordMessage(userId, conv, message);
    this.ctx.notifications.onIncomingMessage(userId, conv, message);
    this.publishCreated(userId, message);
    this.ctx.automation.onCharacterMessage(userId, conv.id, message);
    return message;
  }

  private publishCreated(userId: string, message: MessageRow): void {
    this.ctx.bus.publish(userId, 'message.created', { message: this.toDtos([message])[0] });
    this.ctx.conversations.publishSummary(userId, message.conversation_id);
  }

  list(userId: string, conversationId: string, opts: { beforeSeq?: number; limit?: number }): { messages: MessageDto[]; hasMore: boolean } {
    this.ctx.conversations.getOwned(userId, conversationId);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const rows = this.ctx.db.all<MessageRow>(
      `SELECT * FROM messages WHERE conversation_id = $c AND seq < $before ORDER BY seq DESC LIMIT $l`,
      { c: conversationId, before: opts.beforeSeq ?? Number.MAX_SAFE_INTEGER, l: limit + 1 },
    );
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).reverse();
    return { messages: this.toDtos(page), hasMore };
  }

  /** Suppression logique : la conversation garde la place du message et les citations l'indiquent. */
  remove(userId: string, messageId: string): MessageDto {
    const row = this.getRow(messageId);
    if (!row) throw notFound('Message introuvable.');
    this.ctx.conversations.getOwned(userId, row.conversation_id);
    if (row.status === 'deleted') return this.toDtos([row])[0]!;
    if (row.author_type !== 'user') throw conflict('Seuls vos propres messages peuvent être supprimés de la conversation.');
    const now = this.ctx.clock.now();
    this.ctx.db.transaction(() => {
      this.ctx.db.run(`UPDATE messages SET status = 'deleted', content = '', deleted_at = $now WHERE id = $id`, {
        now,
        id: messageId,
      });
      const updated = this.getRow(messageId)!;
      this.ctx.bus.publish(userId, 'message.updated', { message: this.toDtos([updated])[0] });
      // Les messages qui le citent doivent rafraîchir leur aperçu.
      const quoting = this.ctx.db.all<MessageRow>('SELECT * FROM messages WHERE reply_to_message_id = $id', { id: messageId });
      for (const dto of this.toDtos(quoting)) this.ctx.bus.publish(userId, 'message.updated', { message: dto });
      this.ctx.conversations.publishSummary(userId, row.conversation_id);
    });
    return this.toDtos([this.getRow(messageId)!])[0]!;
  }

  search(userId: string, q: string, characterId?: string, limit = 50): Array<MessageDto & { characterId: string }> {
    const terms = q
      .normalize('NFKC')
      .split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length > 0)
      .slice(0, 8);
    if (terms.length === 0) return [];
    // Chaque terme est cité : aucun opérateur FTS ne peut être injecté par la saisie.
    const match = terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ');
    const rows = this.ctx.db.all<MessageRow & { character_id: string }>(
      `SELECT m.*, c.character_id FROM messages_fts f
       JOIN messages m ON m.rowid = f.rowid
       JOIN conversations c ON c.id = m.conversation_id
       WHERE messages_fts MATCH $match AND c.user_id = $u AND m.status = 'sent'
         AND ($character IS NULL OR c.character_id = $character)
       ORDER BY m.created_at DESC LIMIT $l`,
      { match, u: userId, character: characterId ?? null, l: Math.min(limit, 200) },
    );
    const dtos = this.toDtos(rows);
    return dtos.map((d, i) => ({ ...d, characterId: rows[i]!.character_id }));
  }

  /** Conversion avec résolution groupée des citations (une seule requête, pas de N+1). */
  toDtos(rows: MessageRow[]): MessageDto[] {
    const quotedIds = new Set<string>();
    for (const r of rows) {
      const metaId = safeJsonParse<{ replyToId?: string }>(r.meta_json, {}).replyToId;
      if (r.reply_to_message_id) quotedIds.add(r.reply_to_message_id);
      else if (metaId) quotedIds.add(metaId);
    }
    const quoted = new Map<string, MessageRow>();
    if (quotedIds.size > 0) {
      const found = this.ctx.db.all<MessageRow>('SELECT * FROM messages WHERE id IN (SELECT value FROM json_each($ids))', {
        ids: JSON.stringify([...quotedIds]),
      });
      for (const q of found) quoted.set(q.id, q);
    }
    return rows.map((r) => {
      const refId = r.reply_to_message_id ?? safeJsonParse<{ replyToId?: string }>(r.meta_json, {}).replyToId ?? null;
      const q = refId ? quoted.get(refId) : undefined;
      return {
        id: r.id,
        conversationId: r.conversation_id,
        seq: r.seq,
        authorType: r.author_type,
        authorId: r.author_id,
        content: r.status === 'deleted' ? '' : r.content,
        origin: r.origin,
        status: r.status,
        replyToMessageId: refId,
        replyTo: refId
          ? q
            ? {
                id: q.id,
                authorType: q.author_type,
                content: q.status === 'deleted' ? '' : q.content.slice(0, 280),
                deleted: q.status === 'deleted',
              }
            : { id: refId, missing: true as const }
          : null,
        clientId: r.client_id,
        createdAt: r.created_at,
        readAt: r.read_at,
        deletedAt: r.deleted_at,
      };
    });
  }
}
