import { z } from 'zod';
import type { AppContext } from '../../context.js';
import type { ConversationRow, MessageRow } from '../../domain.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { preview } from '../../lib/text.js';

export const MAILBOX_VIEWS = ['inbox', 'unread', 'read', 'sent', 'archive', 'trash'] as const;
export type MailboxView = (typeof MAILBOX_VIEWS)[number];

export const mailboxQuerySchema = z.object({
  view: z.enum(MAILBOX_VIEWS).default('inbox'),
  q: z.string().trim().max(200).optional(),
  characterId: z.string().max(64).optional(),
  from: z.coerce.number().int().nonnegative().optional(),
  to: z.coerce.number().int().nonnegative().optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const mailboxActionSchema = z
  .object({
    action: z.enum(['mark_read', 'mark_unread', 'archive', 'unarchive', 'trash', 'restore']),
  })
  .strict();

export interface MailboxEntryDto {
  id: string;
  messageId: string;
  conversationId: string;
  characterId: string;
  direction: 'in' | 'out';
  folder: 'inbox' | 'sent' | 'archive' | 'trash';
  subject: string;
  preview: string;
  content: string;
  messageDeleted: boolean;
  read: boolean;
  createdAt: number;
}

interface EntryJoinRow {
  id: string;
  message_id: string;
  conversation_id: string;
  character_id: string;
  direction: 'in' | 'out';
  folder: 'inbox' | 'sent' | 'archive' | 'trash';
  subject: string;
  created_at: number;
  content: string;
  status: 'sent' | 'deleted';
  read_at: number | null;
  author_type: 'user' | 'character';
}

const toDto = (r: EntryJoinRow): MailboxEntryDto => ({
  id: r.id,
  messageId: r.message_id,
  conversationId: r.conversation_id,
  characterId: r.character_id,
  direction: r.direction,
  folder: r.folder,
  subject: r.subject,
  preview: r.status === 'deleted' ? '' : preview(r.content, 160),
  content: r.status === 'deleted' ? '' : r.content,
  messageDeleted: r.status === 'deleted',
  // L'état de lecture est celui du message : une seule source de vérité avec la conversation.
  read: r.direction === 'out' || r.read_at !== null,
  createdAt: r.created_at,
});

const SELECT_JOIN = `SELECT e.*, m.content, m.status, m.read_at, m.author_type FROM mailbox_entries e
  JOIN messages m ON m.id = e.message_id`;

/**
 * Boîte mail virtuelle : une vue sur les messages (une entrée par message, contrainte
 * UNIQUE), avec son propre classement (dossier). Supprimer une entrée ne touche jamais
 * au message de la conversation.
 */
export class MailboxService {
  constructor(private readonly ctx: AppContext) {}

  recordMessage(userId: string, conv: ConversationRow, message: MessageRow): void {
    const now = this.ctx.clock.now();
    const direction = message.author_type === 'character' ? 'in' : 'out';
    this.ctx.db.run(
      `INSERT INTO mailbox_entries (id, user_id, message_id, conversation_id, character_id, direction, folder, subject, created_at, updated_at)
       VALUES ($id, $u, $m, $c, $ch, $dir, $folder, $subject, $at, $now)
       ON CONFLICT(message_id) DO NOTHING`,
      {
        id: newId('mbx'),
        u: userId,
        m: message.id,
        c: conv.id,
        ch: conv.character_id,
        dir: direction,
        folder: direction === 'in' ? 'inbox' : 'sent',
        subject: preview(message.content.split('\n')[0] ?? '', 70) || '(sans objet)',
        at: message.created_at,
        now,
      },
    );
    this.ctx.bus.publish(userId, 'mailbox.changed', { reason: 'new', messageId: message.id, counts: this.counts(userId) });
  }

  counts(userId: string): Record<MailboxView, number> & { unreadInbox: number } {
    const rows = this.ctx.db.all<{ folder: string; total: number; unread: number }>(
      `SELECT e.folder, COUNT(*) AS total,
         SUM(CASE WHEN e.direction = 'in' AND m.read_at IS NULL THEN 1 ELSE 0 END) AS unread
       FROM mailbox_entries e JOIN messages m ON m.id = e.message_id
       WHERE e.user_id = $u GROUP BY e.folder`,
      { u: userId },
    );
    const by = new Map(rows.map((r) => [r.folder, r]));
    const inbox = by.get('inbox');
    return {
      inbox: inbox?.total ?? 0,
      unread: inbox?.unread ?? 0,
      read: (inbox?.total ?? 0) - (inbox?.unread ?? 0),
      sent: by.get('sent')?.total ?? 0,
      archive: by.get('archive')?.total ?? 0,
      trash: by.get('trash')?.total ?? 0,
      unreadInbox: inbox?.unread ?? 0,
    };
  }

  list(userId: string, rawQuery: unknown): { items: MailboxEntryDto[]; hasMore: boolean; counts: ReturnType<MailboxService['counts']> } {
    const parsed = mailboxQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw badRequest('Filtre de boîte mail invalide.', parsed.error.flatten());
    const q = parsed.data;
    const folder = q.view === 'unread' || q.view === 'read' ? 'inbox' : q.view;
    const readFilter = q.view === 'unread' ? 1 : q.view === 'read' ? 2 : 0;
    const terms = (q.q ?? '')
      .normalize('NFKC')
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .slice(0, 8);
    const ftsMatch = terms.length ? terms.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' ') : null;
    // Recherche par contenu (FTS) OU par nom d'expéditeur.
    const nameLike = q.q ? `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : null;
    const rows = this.ctx.db.all<EntryJoinRow>(
      `${SELECT_JOIN}
       JOIN characters ch ON ch.id = e.character_id
       WHERE e.user_id = $u AND e.folder = $folder
         AND ($read = 0 OR ($read = 1 AND m.read_at IS NULL) OR ($read = 2 AND m.read_at IS NOT NULL))
         AND ($character IS NULL OR e.character_id = $character)
         AND ($from IS NULL OR e.created_at >= $from)
         AND ($to IS NULL OR e.created_at <= $to)
         AND ($before IS NULL OR e.created_at < $before)
         AND ($fts IS NULL
              OR m.rowid IN (SELECT rowid FROM messages_fts WHERE messages_fts MATCH $fts)
              OR (ch.first_name || ' ' || ch.last_name) LIKE $name ESCAPE '\\')
       ORDER BY e.created_at DESC LIMIT $l`,
      {
        u: userId,
        folder,
        read: readFilter,
        character: q.characterId ?? null,
        from: q.from ?? null,
        to: q.to ?? null,
        before: q.before ?? null,
        fts: ftsMatch,
        name: nameLike,
        l: q.limit + 1,
      },
    );
    return {
      items: rows.slice(0, q.limit).map(toDto),
      hasMore: rows.length > q.limit,
      counts: this.counts(userId),
    };
  }

  get(userId: string, id: string): MailboxEntryDto {
    const row = this.ctx.db.get<EntryJoinRow>(`${SELECT_JOIN} WHERE e.id = $id AND e.user_id = $u`, { id, u: userId });
    if (!row) throw notFound('Élément de boîte mail introuvable.');
    return toDto(row);
  }

  apply(userId: string, id: string, body: unknown): MailboxEntryDto {
    const parsed = mailboxActionSchema.safeParse(body);
    if (!parsed.success) throw badRequest('Action invalide.', parsed.error.flatten());
    const entry = this.get(userId, id);
    const now = this.ctx.clock.now();
    const db = this.ctx.db;
    db.transaction(() => {
      const setFolder = (folder: MailboxEntryDto['folder']) =>
        db.run('UPDATE mailbox_entries SET folder = $f, updated_at = $now WHERE id = $id', { f: folder, now, id });
      switch (parsed.data.action) {
        case 'mark_read':
        case 'mark_unread': {
          if (entry.direction !== 'in') throw conflict('Seuls les messages reçus ont un état de lecture.');
          const readAt = parsed.data.action === 'mark_read' ? now : null;
          db.run('UPDATE messages SET read_at = $r WHERE id = $m', { r: readAt, m: entry.messageId });
          if (readAt) this.ctx.notifications.markConversationRead(userId, entry.conversationId);
          this.ctx.bus.publish(userId, 'messages.read', {
            conversationId: entry.conversationId,
            messageIds: [entry.messageId],
            readAt,
          });
          this.ctx.conversations.publishSummary(userId, entry.conversationId);
          break;
        }
        case 'archive':
          setFolder('archive');
          break;
        case 'unarchive':
        case 'restore':
          setFolder(entry.direction === 'in' ? 'inbox' : 'sent');
          break;
        case 'trash':
          setFolder('trash');
          break;
      }
      this.ctx.bus.publish(userId, 'mailbox.changed', { reason: parsed.data.action, entryId: id, counts: this.counts(userId) });
    });
    return this.get(userId, id);
  }

  /** Suppression définitive depuis la corbeille : le message de la conversation est conservé. */
  purge(userId: string, id: string): void {
    const entry = this.get(userId, id);
    if (entry.folder !== 'trash') throw conflict('Placez d’abord l’élément dans la corbeille.');
    this.ctx.db.transaction(() => {
      this.ctx.db.run('DELETE FROM mailbox_entries WHERE id = $id AND user_id = $u', { id, u: userId });
      this.ctx.bus.publish(userId, 'mailbox.changed', { reason: 'purge', entryId: id, counts: this.counts(userId) });
    });
  }

  markAllRead(userId: string): number {
    return this.ctx.db.transaction(() => {
      const convs = this.ctx.db
        .all<{ conversation_id: string }>(
          `SELECT DISTINCT e.conversation_id FROM mailbox_entries e JOIN messages m ON m.id = e.message_id
           WHERE e.user_id = $u AND e.folder = 'inbox' AND e.direction = 'in' AND m.read_at IS NULL`,
          { u: userId },
        )
        .map((r) => r.conversation_id);
      let total = 0;
      for (const c of convs) total += this.ctx.conversations.markRead(userId, c).updated;
      this.ctx.bus.publish(userId, 'mailbox.changed', { reason: 'mark_all_read', counts: this.counts(userId) });
      return total;
    });
  }
}
