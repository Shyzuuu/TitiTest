import type {
  AiStatus,
  AppNotification,
  Character,
  ConversationSummary,
  Draft,
  GlobalSettings,
  MailboxCounts,
  Me,
  Message,
  OutgoingMessage,
  ProviderInfo,
  RealtimeEvent,
  Suggestion,
} from '../lib/types';

export interface ConvMessages {
  /** Identifiants triés par numéro de séquence (ordre serveur garanti). */
  ids: string[];
  byId: Record<string, Message>;
  hasMore: boolean;
  loaded: boolean;
  loading: boolean;
}

export interface DataState {
  me: Me | null;
  settings: GlobalSettings | null;
  aiStatus: AiStatus | null;
  providers: ProviderInfo[];
  characters: Record<string, Character>;
  conversations: Record<string, ConversationSummary>;
  messages: Record<string, ConvMessages>;
  outbox: Record<string, OutgoingMessage>;
  drafts: Record<string, Draft>;
  suggestions: Record<string, Suggestion>;
  typing: Record<string, number>;
  notifications: AppNotification[];
  unreadNotifications: number;
  mailboxCounts: MailboxCounts;
  mailboxVersion: number;
  memoryVersion: Record<string, number>;
  /** Horodatage du dernier message entrant par conversation (animation de la liste). */
  flash: Record<string, number>;
  lastEventSeq: number;
}

export const emptyCounts: MailboxCounts = { inbox: 0, unread: 0, read: 0, sent: 0, archive: 0, trash: 0, unreadInbox: 0 };

export const initialData: DataState = {
  me: null,
  settings: null,
  aiStatus: null,
  providers: [],
  characters: {},
  conversations: {},
  messages: {},
  outbox: {},
  drafts: {},
  suggestions: {},
  typing: {},
  notifications: [],
  unreadNotifications: 0,
  mailboxCounts: emptyCounts,
  mailboxVersion: 0,
  memoryVersion: {},
  flash: {},
  lastEventSeq: 0,
};

export const emptyConv = (): ConvMessages => ({ ids: [], byId: {}, hasMore: false, loaded: false, loading: false });

/** Insère ou remplace des messages en conservant l'ordre par séquence, sans doublon. */
export function upsertMessages(conv: ConvMessages, messages: Message[]): ConvMessages {
  if (messages.length === 0) return conv;
  const byId = { ...conv.byId };
  let needsSort = false;
  const ids = [...conv.ids];
  for (const m of messages) {
    if (!byId[m.id]) {
      const last = ids.length ? byId[ids[ids.length - 1]!] : undefined;
      if (last && last.seq > m.seq) needsSort = true;
      ids.push(m.id);
    }
    byId[m.id] = m;
  }
  if (needsSort) ids.sort((a, b) => byId[a]!.seq - byId[b]!.seq);
  return { ...conv, ids, byId };
}

function removeOutboxFor(outbox: Record<string, OutgoingMessage>, message: Message) {
  if (!message.clientId || !outbox[message.clientId]) return outbox;
  // Une clé d'idempotence n'est valable que dans sa conversation d'origine.
  if (outbox[message.clientId]!.conversationId !== message.conversationId) return outbox;
  const next = { ...outbox };
  delete next[message.clientId];
  return next;
}

export function applyMessage(state: DataState, message: Message, now = Date.now()): Partial<DataState> {
  const patch: Partial<DataState> = { outbox: removeOutboxFor(state.outbox, message) };
  const conv = state.messages[message.conversationId];
  // Conversation jamais ouverte : son historique sera chargé à l'ouverture, seul le résumé compte.
  if (conv?.loaded) patch.messages = { ...state.messages, [message.conversationId]: upsertMessages(conv, [message]) };
  if (message.authorType === 'character') {
    const typing = { ...state.typing };
    delete typing[message.conversationId];
    patch.typing = typing;
    patch.flash = { ...state.flash, [message.conversationId]: now };
  }
  return patch;
}

/**
 * Réducteur pur des événements temps réel. Chaque événement porte l'identifiant de sa
 * conversation : il ne peut modifier que celle-ci, et ne touche jamais à la navigation.
 */
export function reduceEvent(state: DataState, event: RealtimeEvent, now = Date.now()): Partial<DataState> {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case 'message.created':
    case 'message.updated':
      return applyMessage(state, p.message as Message, event.type === 'message.created' ? now : 0);
    case 'messages.read': {
      const conversationId = p.conversationId as string;
      const conv = state.messages[conversationId];
      if (!conv?.loaded) return {};
      const ids = new Set(p.messageIds as string[]);
      const byId = { ...conv.byId };
      for (const id of ids) if (byId[id]) byId[id] = { ...byId[id]!, readAt: (p.readAt as number | null) ?? null };
      return { messages: { ...state.messages, [conversationId]: { ...conv, byId } } };
    }
    case 'conversation.updated': {
      const c = p.conversation as ConversationSummary;
      return { conversations: { ...state.conversations, [c.id]: c } };
    }
    case 'character.updated': {
      const c = p.character as Character;
      return { characters: { ...state.characters, [c.id]: c } };
    }
    case 'character.deleted': {
      const characters = { ...state.characters };
      delete characters[p.characterId as string];
      const conversations = { ...state.conversations };
      const messages = { ...state.messages };
      const drafts = { ...state.drafts };
      const convId = p.conversationId as string | null;
      if (convId) {
        delete conversations[convId];
        delete messages[convId];
        delete drafts[convId];
      }
      return { characters, conversations, messages, drafts };
    }
    case 'notification.upserted': {
      const n = p.notification as AppNotification;
      const notifications = [n, ...state.notifications.filter((x) => x.id !== n.id)].sort((a, b) => b.updatedAt - a.updatedAt);
      return { notifications: notifications.slice(0, 200), unreadNotifications: p.unread as number };
    }
    case 'notifications.read': {
      const ids = new Set(p.ids as string[]);
      return {
        notifications: state.notifications.map((n) => (ids.has(n.id) ? { ...n, readAt: n.readAt ?? (p.readAt as number) } : n)),
        unreadNotifications: p.unread as number,
      };
    }
    case 'notification.deleted':
      return {
        notifications: state.notifications.filter((n) => n.id !== p.id),
        unreadNotifications: p.unread as number,
      };
    case 'suggestion.upserted': {
      const s = p.suggestion as Suggestion;
      return { suggestions: { ...state.suggestions, [s.conversationId]: s } };
    }
    case 'suggestion.removed': {
      const convId = p.conversationId as string;
      if (state.suggestions[convId]?.id !== p.id) return {};
      const suggestions = { ...state.suggestions };
      delete suggestions[convId];
      return { suggestions };
    }
    case 'mailbox.changed':
      return { mailboxCounts: p.counts as MailboxCounts, mailboxVersion: state.mailboxVersion + 1 };
    case 'memory.changed': {
      const id = p.characterId as string;
      return { memoryVersion: { ...state.memoryVersion, [id]: (state.memoryVersion[id] ?? 0) + 1 } };
    }
    case 'settings.updated':
      return { settings: p.settings as GlobalSettings };
    case 'me.updated':
      return { me: p.me as Me };
    case 'typing': {
      const convId = p.conversationId as string;
      const typing = { ...state.typing };
      if (p.typing) typing[convId] = now + 10_000;
      else delete typing[convId];
      return { typing };
    }
    default:
      return {};
  }
}
