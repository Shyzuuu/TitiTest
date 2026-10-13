import { z } from 'zod';

export const AI_MODES = ['off', 'suggest', 'auto', 'auto_with_exceptions'] as const;
export type AiMode = (typeof AI_MODES)[number];

export const CHARACTER_STATUSES = ['online', 'away', 'busy', 'offline'] as const;
export type CharacterStatus = (typeof CHARACTER_STATUSES)[number];

export const MESSAGE_ORIGINS = ['manual', 'ai_auto', 'ai_suggestion', 'simulation', 'character_reply'] as const;
export type MessageOrigin = (typeof MESSAGE_ORIGINS)[number];

export const MEMORY_KINDS = ['fact', 'preference', 'topic', 'project', 'question', 'event', 'pinned'] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export const TASK_TYPES = ['character_reply', 'character_initiate', 'character_part', 'ai_reply'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export const automationSchema = z
  .object({
    incomingEnabled: z.boolean().default(true),
    incomingMinMinutes: z.number().min(0.2).max(10080).default(20),
    incomingMaxMinutes: z.number().min(0.2).max(10080).default(90),
    burstMax: z.number().int().min(1).max(5).default(1),
    followupEnabled: z.boolean().default(false),
    followupAfterMinutes: z.number().min(0.5).max(10080).default(30),
    replyEnabled: z.boolean().default(true),
    replyDelayMinSeconds: z.number().min(0).max(3600).default(4),
    replyDelayMaxSeconds: z.number().min(0).max(3600).default(18),
  })
  .refine((v) => v.incomingMinMinutes <= v.incomingMaxMinutes, {
    message: 'Le délai minimal des messages entrants doit être inférieur au délai maximal.',
    path: ['incomingMinMinutes'],
  })
  .refine((v) => v.replyDelayMinSeconds <= v.replyDelayMaxSeconds, {
    message: 'Le délai minimal de réponse doit être inférieur au délai maximal.',
    path: ['replyDelayMinSeconds'],
  });
export type Automation = z.infer<typeof automationSchema>;

export const aiSettingsSchema = z.object({
  mode: z.enum(AI_MODES).default('off'),
  delaySeconds: z.number().int().min(5).max(7 * 24 * 3600).default(120),
  excludedTopics: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  replyStyle: z.string().max(600).default(''),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;

export const globalSettingsSchema = z.object({
  automationPaused: z.boolean().default(false),
  simulationSpeed: z.enum(['demo', 'normal']).default('normal'),
  /** En mode démo, tous les délais d'automatisation sont divisés par ce facteur. */
  demoDivisor: z.number().min(1).max(600).default(12),
  aiProvider: z.enum(['anthropic', 'local']).nullable().default(null),
  aiDailyCallLimit: z.number().int().min(0).max(100000).default(300),
  maxAutoChain: z.number().int().min(1).max(20).default(3),
  userPersona: z
    .string()
    .max(1000)
    .default("Je réponds de manière naturelle, chaleureuse et plutôt brève. Je tutoie mes amis."),
  aiFallbackToLocal: z.boolean().default(true),
});
export type GlobalSettings = z.infer<typeof globalSettingsSchema>;
export const settingsPatchSchema = globalSettingsSchema.partial().strict();

export interface UserRow {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  password_hash: string;
  is_admin: number;
  created_at: number;
}

export interface CharacterRow {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  avatar_color: string;
  avatar_emoji: string;
  avatar_url: string | null;
  description: string;
  personality: string;
  interests_json: string;
  language_style: string;
  status: CharacterStatus;
  is_active: number;
  automation_json: string;
  ai_json: string;
  created_at: number;
  updated_at: number;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  character_id: string;
  next_seq: number;
  version: number;
  last_message_id: string | null;
  last_message_at: number | null;
  last_user_seq: number;
  last_character_seq: number;
  auto_chain: number;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  seq: number;
  author_type: 'user' | 'character';
  author_id: string;
  content: string;
  origin: MessageOrigin;
  status: 'sent' | 'deleted';
  reply_to_message_id: string | null;
  client_id: string | null;
  meta_json: string;
  created_at: number;
  read_at: number | null;
  deleted_at: number | null;
}

export interface TaskRow {
  id: string;
  type: TaskType;
  user_id: string;
  conversation_id: string | null;
  character_id: string | null;
  dedupe_key: string | null;
  run_at: number;
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'superseded' | 'failed';
  payload_json: string;
  result_json: string | null;
  attempts: number;
  max_attempts: number;
  lease_until: number | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

export interface MemoryRow {
  id: string;
  character_id: string;
  kind: MemoryKind;
  content: string;
  content_norm: string;
  source: 'auto' | 'manual';
  source_message_id: string | null;
  importance: number;
  created_at: number;
  updated_at: number;
}

export interface Character {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  avatarColor: string;
  avatarEmoji: string;
  avatarUrl: string | null;
  description: string;
  personality: string;
  interests: string[];
  languageStyle: string;
  status: CharacterStatus;
  isActive: boolean;
  automation: Automation;
  ai: AiSettings;
  createdAt: number;
  updatedAt: number;
}

export interface QuotedMessage {
  id: string;
  authorType: 'user' | 'character';
  content: string;
  deleted: boolean;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  seq: number;
  authorType: 'user' | 'character';
  authorId: string;
  content: string;
  origin: MessageOrigin;
  status: 'sent' | 'deleted';
  replyToMessageId: string | null;
  /** Aperçu du message cité ; `missing` si l'original a été purgé de la base. */
  replyTo: QuotedMessage | { id: string; missing: true } | null;
  clientId: string | null;
  createdAt: number;
  readAt: number | null;
  deletedAt: number | null;
}
