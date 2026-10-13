import { z } from 'zod';
import type { AppContext } from '../../context.js';
import {
  aiSettingsSchema,
  automationSchema,
  CHARACTER_STATUSES,
  type Character,
  type CharacterRow,
} from '../../domain.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { newId } from '../../lib/ids.js';
import { safeJsonParse } from '../../lib/text.js';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale attendue (#RRGGBB).');
const avatarUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https:\/\//i.test(v) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(v), {
    message: "L'avatar doit être une URL https ou une image encodée.",
  });

const automationBase = automationSchema.innerType().innerType();

export const characterInputSchema = z
  .object({
    firstName: z.string().trim().min(1).max(40),
    lastName: z.string().trim().max(40).default(''),
    avatarColor: hexColor.default('#6366f1'),
    avatarEmoji: z.string().trim().max(8).default(''),
    avatarUrl: avatarUrl.nullable().default(null),
    description: z.string().trim().max(1000).default(''),
    personality: z.string().trim().max(1500).default(''),
    interests: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    languageStyle: z.string().trim().max(600).default(''),
    status: z.enum(CHARACTER_STATUSES).default('online'),
    isActive: z.boolean().default(true),
    automation: automationBase.partial().default({}),
    ai: aiSettingsSchema.partial().default({}),
  })
  .strict();

export const characterPatchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(40),
    lastName: z.string().trim().max(40),
    avatarColor: hexColor,
    avatarEmoji: z.string().trim().max(8),
    avatarUrl: avatarUrl.nullable(),
    description: z.string().trim().max(1000),
    personality: z.string().trim().max(1500),
    interests: z.array(z.string().trim().min(1).max(40)).max(20),
    languageStyle: z.string().trim().max(600),
    status: z.enum(CHARACTER_STATUSES),
    isActive: z.boolean(),
    automation: automationBase.partial(),
    ai: aiSettingsSchema.partial(),
  })
  .partial()
  .strict();

export type CharacterInput = z.input<typeof characterInputSchema>;

export function toCharacter(row: CharacterRow): Character {
  const automation = automationSchema.safeParse(safeJsonParse(row.automation_json, {}));
  const ai = aiSettingsSchema.safeParse(safeJsonParse(row.ai_json, {}));
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: [row.first_name, row.last_name].filter(Boolean).join(' '),
    avatarColor: row.avatar_color,
    avatarEmoji: row.avatar_emoji,
    avatarUrl: row.avatar_url,
    description: row.description,
    personality: row.personality,
    interests: safeJsonParse<string[]>(row.interests_json, []),
    languageStyle: row.language_style,
    status: row.status,
    isActive: row.is_active === 1,
    automation: automation.success ? automation.data : automationSchema.parse({}),
    ai: ai.success ? ai.data : aiSettingsSchema.parse({}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class CharacterService {
  constructor(private readonly ctx: AppContext) {}

  list(userId: string): Character[] {
    return this.ctx.db
      .all<CharacterRow>('SELECT * FROM characters WHERE user_id = $u ORDER BY created_at, first_name', { u: userId })
      .map(toCharacter);
  }

  getRow(userId: string, id: string): CharacterRow {
    const row = this.ctx.db.get<CharacterRow>('SELECT * FROM characters WHERE id = $id AND user_id = $u', { id, u: userId });
    if (!row) throw notFound('Personnage introuvable.');
    return row;
  }

  get(userId: string, id: string): Character {
    return toCharacter(this.getRow(userId, id));
  }

  /** Lecture interne par identifiant (tâches planifiées) : l'appartenance est garantie par la tâche. */
  findById(id: string): Character | null {
    const row = this.ctx.db.get<CharacterRow>('SELECT * FROM characters WHERE id = $id', { id });
    return row ? toCharacter(row) : null;
  }

  create(userId: string, input: unknown): { character: Character; conversationId: string } {
    const parsed = characterInputSchema.safeParse(input);
    if (!parsed.success) throw badRequest('Personnage invalide.', parsed.error.flatten());
    const data = parsed.data;
    const automation = automationSchema.safeParse(data.automation);
    if (!automation.success) throw badRequest('Paramètres de messages entrants invalides.', automation.error.flatten());
    const ai = aiSettingsSchema.parse(data.ai);
    const now = this.ctx.clock.now();
    const id = newId('chr');
    const conversationId = newId('cnv');

    this.ctx.db.transaction(() => {
      this.ctx.db.run(
        `INSERT INTO characters (id, user_id, first_name, last_name, avatar_color, avatar_emoji, avatar_url, description,
           personality, interests_json, language_style, status, is_active, automation_json, ai_json, created_at, updated_at)
         VALUES ($id, $u, $fn, $ln, $color, $emoji, $url, $desc, $pers, $interests, $style, $status, $active, $auto, $ai, $now, $now)`,
        {
          id,
          u: userId,
          fn: data.firstName,
          ln: data.lastName,
          color: data.avatarColor,
          emoji: data.avatarEmoji,
          url: data.avatarUrl,
          desc: data.description,
          pers: data.personality,
          interests: JSON.stringify(data.interests),
          style: data.languageStyle,
          status: data.status,
          active: data.isActive,
          auto: JSON.stringify(automation.data),
          ai: JSON.stringify(ai),
          now,
        },
      );
      this.ctx.db.run(
        `INSERT INTO conversations (id, user_id, character_id, created_at, updated_at) VALUES ($id, $u, $c, $now, $now)`,
        { id: conversationId, u: userId, c: id, now },
      );
      const character = this.get(userId, id);
      this.ctx.bus.publish(userId, 'character.updated', { character });
      this.ctx.bus.publish(userId, 'conversation.updated', { conversation: this.ctx.conversations.summary(conversationId) });
      this.ctx.automation.reconcileCharacter(userId, id);
    });
    this.ctx.logger.info('characters', `Personnage créé : ${data.firstName}`, { id });
    return { character: this.get(userId, id), conversationId };
  }

  update(userId: string, id: string, patch: unknown): Character {
    const parsed = characterPatchSchema.safeParse(patch);
    if (!parsed.success) throw badRequest('Modification invalide.', parsed.error.flatten());
    const current = this.get(userId, id);
    const p = parsed.data;
    const automation = automationSchema.safeParse({ ...current.automation, ...(p.automation ?? {}) });
    if (!automation.success) throw badRequest('Paramètres de messages entrants invalides.', automation.error.flatten());
    const ai = aiSettingsSchema.parse({ ...current.ai, ...(p.ai ?? {}) });

    this.ctx.db.transaction(() => {
      this.ctx.db.run(
        `UPDATE characters SET first_name = $fn, last_name = $ln, avatar_color = $color, avatar_emoji = $emoji,
           avatar_url = $url, description = $desc, personality = $pers, interests_json = $interests,
           language_style = $style, status = $status, is_active = $active, automation_json = $auto, ai_json = $ai,
           updated_at = $now
         WHERE id = $id AND user_id = $u`,
        {
          id,
          u: userId,
          fn: p.firstName ?? current.firstName,
          ln: p.lastName ?? current.lastName,
          color: p.avatarColor ?? current.avatarColor,
          emoji: p.avatarEmoji ?? current.avatarEmoji,
          url: p.avatarUrl === undefined ? current.avatarUrl : p.avatarUrl,
          desc: p.description ?? current.description,
          pers: p.personality ?? current.personality,
          interests: JSON.stringify(p.interests ?? current.interests),
          style: p.languageStyle ?? current.languageStyle,
          status: p.status ?? current.status,
          active: p.isActive ?? current.isActive,
          auto: JSON.stringify(automation.data),
          ai: JSON.stringify(ai),
          now: this.ctx.clock.now(),
        },
      );
      const character = this.get(userId, id);
      this.ctx.bus.publish(userId, 'character.updated', { character });
      this.ctx.automation.reconcileCharacter(userId, id, current);
      const conversationId = this.ctx.conversations.idForCharacter(userId, id);
      if (conversationId) {
        this.ctx.bus.publish(userId, 'conversation.updated', { conversation: this.ctx.conversations.summary(conversationId) });
      }
    });
    return this.get(userId, id);
  }

  remove(userId: string, id: string): void {
    const character = this.get(userId, id);
    const conversationId = this.ctx.conversations.idForCharacter(userId, id);
    this.ctx.db.transaction(() => {
      this.ctx.db.run('DELETE FROM characters WHERE id = $id AND user_id = $u', { id, u: userId });
      this.ctx.bus.publish(userId, 'character.deleted', { characterId: id, conversationId });
    });
    this.ctx.logger.warn('characters', `Personnage supprimé : ${character.fullName}`, { id });
  }
}
