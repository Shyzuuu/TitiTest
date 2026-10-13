export type AiMode = 'off' | 'suggest' | 'auto' | 'auto_with_exceptions';
export type CharacterStatus = 'online' | 'away' | 'busy' | 'offline';

export interface Automation {
  incomingEnabled: boolean;
  incomingMinMinutes: number;
  incomingMaxMinutes: number;
  burstMax: number;
  followupEnabled: boolean;
  followupAfterMinutes: number;
  replyEnabled: boolean;
  replyDelayMinSeconds: number;
  replyDelayMaxSeconds: number;
}

export interface AiSettings {
  mode: AiMode;
  delaySeconds: number;
  excludedTopics: string[];
  replyStyle: string;
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

export interface PendingTaskRef {
  taskId: string;
  runAt: number;
  status: 'pending' | 'running';
}

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
  pendingAiReply: PendingTaskRef | null;
  pendingCharacterReply: PendingTaskRef | null;
  pendingSuggestions: number;
  autoChain: number;
  createdAt: number;
}

export type MessageOrigin = 'manual' | 'ai_auto' | 'ai_suggestion' | 'simulation' | 'character_reply';

export interface QuotedMessage {
  id: string;
  authorType?: 'user' | 'character';
  content?: string;
  deleted?: boolean;
  missing?: true;
}

export interface Message {
  id: string;
  conversationId: string;
  seq: number;
  authorType: 'user' | 'character';
  authorId: string;
  content: string;
  origin: MessageOrigin;
  status: 'sent' | 'deleted';
  replyToMessageId: string | null;
  replyTo: QuotedMessage | null;
  clientId: string | null;
  createdAt: number;
  readAt: number | null;
  deletedAt: number | null;
}

/** Message en cours d'envoi (optimiste) ou en échec, identifié par sa clé d'idempotence. */
export interface OutgoingMessage {
  clientId: string;
  conversationId: string;
  content: string;
  replyToMessageId: string | null;
  status: 'sending' | 'failed';
  error?: string;
  createdAt: number;
}

export interface Draft {
  conversationId: string;
  content: string;
  replyToMessageId: string | null;
  updatedAt: number;
}

export interface Suggestion {
  id: string;
  conversationId: string;
  content: string;
  reason: string | null;
  status: string;
  createdAt: number;
}

export type NotificationType = 'new_message' | 'ai_suggestion' | 'ai_confirmation' | 'ai_auto_sent' | 'ai_error' | 'task_failed';

export interface AppNotification {
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

export interface GlobalSettings {
  automationPaused: boolean;
  simulationSpeed: 'demo' | 'normal';
  demoDivisor: number;
  aiProvider: 'anthropic' | 'local' | null;
  aiDailyCallLimit: number;
  maxAutoChain: number;
  userPersona: string;
  aiFallbackToLocal: boolean;
}

export interface AiStatus {
  provider: 'anthropic' | 'local';
  state: 'unverified' | 'ok' | 'error';
  checkedAt: number | null;
  latencyMs: number | null;
  model: string | null;
  error: string | null;
}

export interface ProviderInfo {
  id: string;
  label: string;
  isReal: boolean;
  configured: boolean;
  model: string | null;
}

export interface Me {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  isAdmin: boolean;
  createdAt: number;
}

export type MailboxView = 'inbox' | 'unread' | 'read' | 'sent' | 'archive' | 'trash';

export interface MailboxCounts {
  inbox: number;
  unread: number;
  read: number;
  sent: number;
  archive: number;
  trash: number;
  unreadInbox: number;
}

export interface MailboxEntry {
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

export interface Memory {
  id: string;
  characterId: string;
  kind: 'fact' | 'preference' | 'topic' | 'project' | 'question' | 'event' | 'pinned';
  content: string;
  source: 'auto' | 'manual';
  sourceMessageId: string | null;
  importance: number;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  type: 'character_reply' | 'character_initiate' | 'character_part' | 'ai_reply';
  conversationId: string | null;
  characterId: string | null;
  runAt: number;
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'superseded' | 'failed';
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export interface RealtimeEvent {
  seq: number | null;
  type: string;
  payload: unknown;
  createdAt: number;
}

export interface BootstrapData {
  me: Me;
  lastEventSeq: number;
  settings: GlobalSettings;
  aiStatus: AiStatus;
  providers: ProviderInfo[];
  characters: Character[];
  conversations: ConversationSummary[];
  drafts: Draft[];
  suggestions: Suggestion[];
  notifications: { items: AppNotification[]; unread: number };
  mailboxCounts: MailboxCounts;
  serverTime: number;
}
