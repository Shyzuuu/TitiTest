import type { AppContext } from '../../context.js';
import type { ConversationRow, MessageRow } from '../../domain.js';
import { notFound } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { preview } from '../../lib/text.js';

export type NotificationType =
  | 'new_message'
  | 'ai_suggestion'
  | 'ai_confirmation'
  | 'ai_auto_sent'
  | 'ai_error'
  | 'task_failed';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  conversationId: string | null;
  messageId: string | null;
  title: string;
  body: string;
  count: number;
  readAt: number | null;
  createdAt: number;
  updatedAt: number;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  conversation_id: string | null;
  message_id: string | null;
  title: string;
  body: string;
  count: number;
  read_at: number | null;
  created_at: number;
  updated_at: number;
}

const toDto = (r: NotificationRow): NotificationDto => ({
  id: r.id,
  type: r.type,
  conversationId: r.conversation_id,
  messageId: r.message_id,
  title: r.title,
  body: r.body,
  count: r.count,
  readAt: r.read_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export class NotificationService {
  constructor(private readonly ctx: AppContext) {}

  list(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}): { items: NotificationDto[]; unread: number } {
    const rows = this.ctx.db.all<NotificationRow>(
      `SELECT * FROM notifications WHERE user_id = $u AND ($unread = 0 OR read_at IS NULL)
       ORDER BY updated_at DESC LIMIT $l`,
      { u: userId, unread: opts.unreadOnly ? 1 : 0, l: Math.min(opts.limit ?? 100, 500) },
    );
    return { items: rows.map(toDto), unread: this.unreadCount(userId) };
  }

  unreadCount(userId: string): number {
    return (
      this.ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM notifications WHERE user_id = $u AND read_at IS NULL', {
        u: userId,
      })?.n ?? 0
    );
  }

  create(
    userId: string,
    input: { type: NotificationType; conversationId?: string | null; messageId?: string | null; title: string; body?: string },
  ): NotificationDto {
    const now = this.ctx.clock.now();
    const row: NotificationRow = {
      id: newId('ntf'),
      user_id: userId,
      type: input.type,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId ?? null,
      title: input.title.slice(0, 200),
      body: preview(input.body ?? '', 280),
      count: 1,
      read_at: null,
      created_at: now,
      updated_at: now,
    };
    this.ctx.db.run(
      `INSERT INTO notifications (id, user_id, type, conversation_id, message_id, title, body, count, read_at, created_at, updated_at)
       VALUES ($id, $user_id, $type, $conversation_id, $message_id, $title, $body, $count, $read_at, $created_at, $updated_at)`,
      { ...row },
    );
    const dto = toDto(row);
    this.ctx.bus.publish(userId, 'notification.upserted', { notification: dto, unread: this.unreadCount(userId) });
    return dto;
  }

  /**
   * Nouveau message entrant : une notification non lue par conversation est enrichie
   * (compteur + dernier message) plutôt que dupliquée. Chaque conversation garde la sienne.
   */
  onIncomingMessage(userId: string, conv: ConversationRow, message: MessageRow): void {
    const character = this.ctx.characters.findById(conv.character_id);
    const name = character?.fullName ?? 'Contact';
    const existing = this.ctx.db.get<NotificationRow>(
      `SELECT * FROM notifications WHERE user_id = $u AND conversation_id = $c AND type = 'new_message' AND read_at IS NULL`,
      { u: userId, c: conv.id },
    );
    if (!existing) {
      this.create(userId, {
        type: 'new_message',
        conversationId: conv.id,
        messageId: message.id,
        title: `Nouveau message de ${name}`,
        body: message.content,
      });
      return;
    }
    const count = existing.count + 1;
    const now = this.ctx.clock.now();
    this.ctx.db.run(
      `UPDATE notifications SET count = $count, message_id = $m, title = $title, body = $body, updated_at = $now WHERE id = $id`,
      {
        id: existing.id,
        count,
        m: message.id,
        title: `${count} nouveaux messages de ${name}`,
        body: preview(message.content, 280),
        now,
      },
    );
    const updated = this.ctx.db.get<NotificationRow>('SELECT * FROM notifications WHERE id = $id', { id: existing.id })!;
    this.ctx.bus.publish(userId, 'notification.upserted', { notification: toDto(updated), unread: this.unreadCount(userId) });
  }

  markConversationRead(userId: string, conversationId: string): void {
    const now = this.ctx.clock.now();
    const ids = this.ctx.db
      .all<{ id: string }>(
        `SELECT id FROM notifications WHERE user_id = $u AND conversation_id = $c AND read_at IS NULL AND type = 'new_message'`,
        { u: userId, c: conversationId },
      )
      .map((r) => r.id);
    if (ids.length === 0) return;
    this.ctx.db.run(
      `UPDATE notifications SET read_at = $now WHERE user_id = $u AND conversation_id = $c AND read_at IS NULL AND type = 'new_message'`,
      { now, u: userId, c: conversationId },
    );
    this.ctx.bus.publish(userId, 'notifications.read', { ids, readAt: now, unread: this.unreadCount(userId) });
  }

  markRead(userId: string, id: string): void {
    const now = this.ctx.clock.now();
    this.ctx.db.transaction(() => {
      const r = this.ctx.db.run('UPDATE notifications SET read_at = COALESCE(read_at, $now) WHERE id = $id AND user_id = $u', {
        now,
        id,
        u: userId,
      });
      if (r.changes === 0) throw notFound('Notification introuvable.');
      this.ctx.bus.publish(userId, 'notifications.read', { ids: [id], readAt: now, unread: this.unreadCount(userId) });
    });
  }

  markAllRead(userId: string): void {
    const now = this.ctx.clock.now();
    this.ctx.db.transaction(() => {
      const ids = this.ctx.db
        .all<{ id: string }>('SELECT id FROM notifications WHERE user_id = $u AND read_at IS NULL', { u: userId })
        .map((r) => r.id);
      this.ctx.db.run('UPDATE notifications SET read_at = $now WHERE user_id = $u AND read_at IS NULL', { now, u: userId });
      this.ctx.bus.publish(userId, 'notifications.read', { ids, readAt: now, unread: 0 });
    });
  }

  remove(userId: string, id: string): void {
    this.ctx.db.transaction(() => {
      const r = this.ctx.db.run('DELETE FROM notifications WHERE id = $id AND user_id = $u', { id, u: userId });
      if (r.changes === 0) throw notFound('Notification introuvable.');
      this.ctx.bus.publish(userId, 'notification.deleted', { id, unread: this.unreadCount(userId) });
    });
  }
}
