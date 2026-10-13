import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { MEMORY_KINDS, type MemoryRow, type MessageRow } from '../../domain.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { normalize } from '../../lib/text.js';
import { extractMemories } from './extractor.js';

export const MAX_MEMORIES_PER_CHARACTER = 120;

export const memoryInputSchema = z
  .object({
    kind: z.enum(MEMORY_KINDS).default('pinned'),
    content: z.string().trim().min(2).max(300),
    importance: z.number().int().min(1).max(5).default(3),
  })
  .strict();

export const memoryPatchSchema = z
  .object({
    kind: z.enum(MEMORY_KINDS),
    content: z.string().trim().min(2).max(300),
    importance: z.number().int().min(1).max(5),
  })
  .partial()
  .strict();

export interface MemoryDto {
  id: string;
  characterId: string;
  kind: MemoryRow['kind'];
  content: string;
  source: 'auto' | 'manual';
  sourceMessageId: string | null;
  importance: number;
  createdAt: number;
  updatedAt: number;
}

const toDto = (r: MemoryRow): MemoryDto => ({
  id: r.id,
  characterId: r.character_id,
  kind: r.kind,
  content: r.content,
  source: r.source,
  sourceMessageId: r.source_message_id,
  importance: r.importance,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/**
 * Mémoire strictement cloisonnée par personnage : chaque requête est filtrée par
 * `character_id`, et l'extraction n'a lieu que dans la conversation de ce personnage.
 */
export class MemoryService {
  constructor(private readonly ctx: AppContext) {}

  list(userId: string, characterId: string): MemoryDto[] {
    this.ctx.characters.getRow(userId, characterId);
    return this.forCharacter(characterId).map(toDto);
  }

  /** Usage interne (génération) : souvenirs triés par importance puis fraîcheur. */
  forCharacter(characterId: string, limit = MAX_MEMORIES_PER_CHARACTER): MemoryRow[] {
    return this.ctx.db.all<MemoryRow>(
      `SELECT * FROM character_memories WHERE character_id = $c ORDER BY importance DESC, updated_at DESC LIMIT $l`,
      { c: characterId, l: limit },
    );
  }

  learnFromUserMessage(characterId: string, message: MessageRow): void {
    const character = this.ctx.characters.findById(characterId);
    if (!character) return;
    const found = extractMemories(message.content, character.interests);
    if (found.length === 0) return;
    const now = this.ctx.clock.now();
    let changed = false;
    for (const m of found) {
      const norm = normalize(m.content);
      const r = this.ctx.db.run(
        `INSERT INTO character_memories (id, character_id, kind, content, content_norm, source, source_message_id, importance, created_at, updated_at)
         VALUES ($id, $c, $kind, $content, $norm, 'auto', $msg, $imp, $now, $now)
         ON CONFLICT(character_id, content_norm) DO UPDATE SET updated_at = excluded.updated_at,
           importance = MAX(character_memories.importance, excluded.importance)`,
        { id: newId('mem'), c: characterId, kind: m.kind, content: m.content, norm, msg: message.id, imp: m.importance, now },
      );
      changed ||= r.changes > 0;
    }
    if (!changed) return;
    this.prune(characterId);
    const conv = this.ctx.conversations.getRow(message.conversation_id);
    if (conv) this.ctx.bus.publish(conv.user_id, 'memory.changed', { characterId });
  }

  /** Les souvenirs automatiques les moins importants et les plus anciens partent en premier. */
  private prune(characterId: string): void {
    this.ctx.db.run(
      `DELETE FROM character_memories WHERE id IN (
         SELECT id FROM character_memories WHERE character_id = $c AND source = 'auto'
         ORDER BY importance DESC, updated_at DESC LIMIT -1 OFFSET $keep)`,
      { c: characterId, keep: MAX_MEMORIES_PER_CHARACTER },
    );
  }

  create(userId: string, characterId: string, body: unknown): MemoryDto {
    this.ctx.characters.getRow(userId, characterId);
    const parsed = memoryInputSchema.safeParse(body);
    if (!parsed.success) throw badRequest('Souvenir invalide.', parsed.error.flatten());
    const now = this.ctx.clock.now();
    const id = newId('mem');
    return this.ctx.db.transaction(() => {
      const norm = normalize(parsed.data.content);
      if (this.ctx.db.get('SELECT 1 FROM character_memories WHERE character_id = $c AND content_norm = $n', { c: characterId, n: norm })) {
        throw conflict('Ce souvenir existe déjà.');
      }
      this.ctx.db.run(
        `INSERT INTO character_memories (id, character_id, kind, content, content_norm, source, importance, created_at, updated_at)
         VALUES ($id, $c, $kind, $content, $norm, 'manual', $imp, $now, $now)`,
        { id, c: characterId, kind: parsed.data.kind, content: parsed.data.content, norm, imp: parsed.data.importance, now },
      );
      this.ctx.bus.publish(userId, 'memory.changed', { characterId });
      return toDto(this.ctx.db.get<MemoryRow>('SELECT * FROM character_memories WHERE id = $id', { id })!);
    });
  }

  private owned(userId: string, id: string): MemoryRow {
    const row = this.ctx.db.get<MemoryRow>(
      `SELECT m.* FROM character_memories m JOIN characters c ON c.id = m.character_id WHERE m.id = $id AND c.user_id = $u`,
      { id, u: userId },
    );
    if (!row) throw notFound('Souvenir introuvable.');
    return row;
  }

  update(userId: string, id: string, body: unknown): MemoryDto {
    const current = this.owned(userId, id);
    const parsed = memoryPatchSchema.safeParse(body);
    if (!parsed.success) throw badRequest('Souvenir invalide.', parsed.error.flatten());
    const content = parsed.data.content ?? current.content;
    return this.ctx.db.transaction(() => {
      const norm = normalize(content);
      const clash = this.ctx.db.get<{ id: string }>(
        'SELECT id FROM character_memories WHERE character_id = $c AND content_norm = $n AND id <> $id',
        { c: current.character_id, n: norm, id },
      );
      if (clash) throw conflict('Un souvenir identique existe déjà.');
      this.ctx.db.run(
        `UPDATE character_memories SET kind = $kind, content = $content, content_norm = $norm, importance = $imp,
           source = 'manual', updated_at = $now WHERE id = $id`,
        {
          id,
          kind: parsed.data.kind ?? current.kind,
          content,
          norm,
          imp: parsed.data.importance ?? current.importance,
          now: this.ctx.clock.now(),
        },
      );
      this.ctx.bus.publish(userId, 'memory.changed', { characterId: current.character_id });
      return toDto(this.ctx.db.get<MemoryRow>('SELECT * FROM character_memories WHERE id = $id', { id })!);
    });
  }

  remove(userId: string, id: string): void {
    const current = this.owned(userId, id);
    this.ctx.db.transaction(() => {
      this.ctx.db.run('DELETE FROM character_memories WHERE id = $id', { id });
      this.ctx.bus.publish(userId, 'memory.changed', { characterId: current.character_id });
    });
  }

  reset(userId: string, characterId: string): number {
    this.ctx.characters.getRow(userId, characterId);
    return this.ctx.db.transaction(() => {
      const r = this.ctx.db.run('DELETE FROM character_memories WHERE character_id = $c', { c: characterId });
      this.ctx.bus.publish(userId, 'memory.changed', { characterId });
      return r.changes;
    });
  }
}
