import { create } from 'zustand';
import { ApiError, del, errorText, get, post, put } from '../lib/api';
import { newClientId } from '../lib/ids';
import { readJson, writeJson } from '../lib/storage';
import type { BootstrapData, Draft, Message, OutgoingMessage, RealtimeEvent } from '../lib/types';
import { applyMessage, emptyConv, initialData, reduceEvent, upsertMessages, type DataState } from './reducer';

const DRAFTS_KEY = 'cercle:drafts';
const DRAFT_SAVE_DELAY = 600;

export interface Toast {
  id: string;
  kind: 'message' | 'info' | 'error' | 'success';
  title: string;
  body?: string;
  conversationId?: string;
  messageId?: string;
  characterId?: string;
}

export type Connection = 'connecting' | 'online' | 'offline' | 'resyncing';

interface UiState {
  status: 'loading' | 'anonymous' | 'ready' | 'error';
  bootError: string | null;
  connection: Connection;
  activeConversationId: string | null;
  infoPanelOpen: boolean;
  /** Surimpression du panneau sur écrans étroits : jamais ouverte automatiquement. */
  infoOverlayOpen: boolean;
  toasts: Toast[];
}

interface Actions {
  bootstrap(): Promise<void>;
  setAnonymous(): void;
  applyEvents(events: RealtimeEvent[]): void;
  setConnection(c: Connection): void;
  setActiveConversation(id: string | null): void;
  toggleInfoPanel(open?: boolean): void;
  closeInfo(): void;
  loadMessages(conversationId: string, older?: boolean): Promise<void>;
  sendMessage(conversationId: string, content: string, replyToMessageId: string | null): Promise<void>;
  retryMessage(clientId: string): Promise<void>;
  discardFailed(clientId: string): void;
  deleteMessage(messageId: string): Promise<void>;
  setDraft(conversationId: string, patch: Partial<Pick<Draft, 'content' | 'replyToMessageId'>>): void;
  markRead(conversationId: string): Promise<void>;
  sendSuggestion(conversationId: string, content?: string): Promise<void>;
  discardSuggestion(conversationId: string): Promise<void>;
  pushToast(t: Omit<Toast, 'id'>): void;
  dismissToast(id: string): void;
}

export type AppState = DataState & UiState & Actions;

const draftTimers = new Map<string, ReturnType<typeof setTimeout>>();
const readTimers = new Map<string, ReturnType<typeof setTimeout>>();

function persistDraftsLocally(drafts: Record<string, Draft>) {
  writeJson(DRAFTS_KEY, drafts);
}

/** Fusion serveur/local : pour chaque conversation, le brouillon le plus récent gagne. */
export function mergeDrafts(server: Draft[], local: Record<string, Draft>, knownConversations: Set<string>): Record<string, Draft> {
  const merged: Record<string, Draft> = {};
  for (const d of server) merged[d.conversationId] = d;
  for (const [id, d] of Object.entries(local)) {
    if (!knownConversations.has(id) || !d || typeof d.content !== 'string') continue;
    const s = merged[id];
    if (!s || d.updatedAt > s.updatedAt) merged[id] = d;
  }
  for (const [id, d] of Object.entries(merged)) if (!d.content && !d.replyToMessageId) delete merged[id];
  return merged;
}

export const useStore = create<AppState>()((set, getState) => ({
  ...initialData,
  status: 'loading',
  bootError: null,
  connection: 'connecting',
  activeConversationId: null,
  infoPanelOpen: readJson<boolean>('cercle:info-panel', true),
  infoOverlayOpen: false,
  toasts: [],

  async bootstrap() {
    try {
      const data = await get<BootstrapData>('/bootstrap');
      const known = new Set(data.conversations.map((c) => c.id));
      const drafts = mergeDrafts(data.drafts, readJson<Record<string, Draft>>(DRAFTS_KEY, {}), known);
      persistDraftsLocally(drafts);
      const current = getState();
      // Brouillons locaux plus récents que le serveur : on les renvoie.
      for (const d of Object.values(drafts)) {
        const server = data.drafts.find((x) => x.conversationId === d.conversationId);
        if (!server || server.updatedAt < d.updatedAt) scheduleDraftSave(d.conversationId);
      }
      // Les historiques déjà chargés restent en place (resynchronisation après coupure) : on les recharge.
      const reload = Object.entries(current.messages).filter(([id, c]) => c.loaded && known.has(id)).map(([id]) => id);
      set({
        me: data.me,
        settings: data.settings,
        aiStatus: data.aiStatus,
        providers: data.providers,
        characters: Object.fromEntries(data.characters.map((c) => [c.id, c])),
        conversations: Object.fromEntries(data.conversations.map((c) => [c.id, c])),
        messages: Object.fromEntries(Object.entries(current.messages).filter(([id]) => known.has(id))),
        drafts,
        suggestions: Object.fromEntries(data.suggestions.map((s) => [s.conversationId, s])),
        notifications: data.notifications.items,
        unreadNotifications: data.notifications.unread,
        mailboxCounts: data.mailboxCounts,
        mailboxVersion: current.mailboxVersion + 1,
        lastEventSeq: data.lastEventSeq,
        status: 'ready',
        bootError: null,
      });
      await Promise.all(reload.map((id) => getState().loadMessages(id)));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) set({ ...initialData, status: 'anonymous' });
      else set({ status: getState().status === 'ready' ? 'ready' : 'error', bootError: errorText(err) });
    }
  },

  setAnonymous() {
    set({ ...initialData, status: 'anonymous', activeConversationId: null });
  },

  applyEvents(events) {
    let state = getState();
    let changed: Partial<AppState> = {};
    let lastSeq = state.lastEventSeq;
    for (const e of events) {
      if (e.seq !== null) {
        // Rejeu idempotent : un événement déjà appliqué est ignoré.
        if (e.seq <= lastSeq) continue;
        lastSeq = e.seq;
      }
      const patch = reduceEvent(state, e);
      changed = { ...changed, ...patch };
      state = { ...state, ...patch };
    }
    set({ ...changed, lastEventSeq: lastSeq });
  },

  setConnection(connection) {
    set({ connection });
  },

  setActiveConversation(id) {
    set({ activeConversationId: id });
  },

  toggleInfoPanel(open) {
    const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches;
    if (!wide) {
      set({ infoOverlayOpen: open ?? !getState().infoOverlayOpen });
      return;
    }
    const next = open ?? !getState().infoPanelOpen;
    writeJson('cercle:info-panel', next);
    set({ infoPanelOpen: next });
  },

  closeInfo() {
    const wide = typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1280px)').matches;
    if (wide) {
      writeJson('cercle:info-panel', false);
      set({ infoPanelOpen: false });
    } else set({ infoOverlayOpen: false });
  },

  async loadMessages(conversationId, older = false) {
    const conv = getState().messages[conversationId] ?? emptyConv();
    if (conv.loading) return;
    const beforeSeq = older && conv.ids.length ? conv.byId[conv.ids[0]!]!.seq : undefined;
    set((s) => ({ messages: { ...s.messages, [conversationId]: { ...conv, loading: true } } }));
    try {
      const res = await get<{ messages: Message[]; hasMore: boolean }>(`/conversations/${conversationId}/messages`, {
        beforeSeq,
        limit: 50,
      });
      set((s) => {
        const base = older ? s.messages[conversationId] ?? emptyConv() : { ...emptyConv(), ids: [], byId: {} };
        // Les messages arrivés en temps réel pendant le chargement sont conservés.
        const live = !older ? Object.values(s.messages[conversationId]?.byId ?? {}) : [];
        const merged = upsertMessages(upsertMessages(base, res.messages), live);
        let outbox = s.outbox;
        for (const m of res.messages) outbox = applyMessage({ ...s, outbox }, m).outbox ?? outbox;
        return {
          outbox,
          messages: {
            ...s.messages,
            [conversationId]: { ...merged, loaded: true, loading: false, hasMore: res.hasMore },
          },
        };
      });
    } catch (err) {
      set((s) => ({ messages: { ...s.messages, [conversationId]: { ...(s.messages[conversationId] ?? emptyConv()), loading: false } } }));
      getState().pushToast({ kind: 'error', title: 'Chargement impossible', body: errorText(err) });
    }
  },

  async sendMessage(conversationId, content, replyToMessageId) {
    const trimmed = content.trim();
    if (!trimmed) return;
    const clientId = newClientId();
    const outgoing: OutgoingMessage = { clientId, conversationId, content: trimmed, replyToMessageId, status: 'sending', createdAt: Date.now() };
    set((s) => ({ outbox: { ...s.outbox, [clientId]: outgoing } }));
    await deliver(outgoing);
  },

  async retryMessage(clientId) {
    const o = getState().outbox[clientId];
    if (!o) return;
    const retry: OutgoingMessage = { ...o, status: 'sending', error: undefined };
    set((s) => ({ outbox: { ...s.outbox, [clientId]: retry } }));
    await deliver(retry);
  },

  discardFailed(clientId) {
    set((s) => {
      const outbox = { ...s.outbox };
      delete outbox[clientId];
      return { outbox };
    });
  },

  async deleteMessage(messageId) {
    try {
      const { message } = await del<{ message: Message }>(`/messages/${messageId}`);
      set((s) => applyMessage(s, message, 0));
    } catch (err) {
      getState().pushToast({ kind: 'error', title: 'Suppression impossible', body: errorText(err) });
    }
  },

  setDraft(conversationId, patch) {
    set((s) => {
      const prev = s.drafts[conversationId] ?? { conversationId, content: '', replyToMessageId: null, updatedAt: 0 };
      const next: Draft = { ...prev, ...patch, conversationId, updatedAt: Date.now() };
      const drafts = { ...s.drafts };
      if (!next.content && !next.replyToMessageId) delete drafts[conversationId];
      else drafts[conversationId] = next;
      persistDraftsLocally(drafts);
      return { drafts };
    });
    scheduleDraftSave(conversationId);
  },

  async markRead(conversationId) {
    const conv = getState().conversations[conversationId];
    if (!conv || conv.unreadCount === 0) return;
    set((s) => ({ conversations: { ...s.conversations, [conversationId]: { ...conv, unreadCount: 0 } } }));
    try {
      await post(`/conversations/${conversationId}/read`, {});
    } catch {
      /* le résumé serveur suivant rétablira le compteur exact */
    }
  },

  async sendSuggestion(conversationId, content) {
    const s = getState().suggestions[conversationId];
    if (!s) return;
    try {
      const { message } = await post<{ message: Message }>(`/suggestions/${s.id}/send`, content === undefined ? {} : { content });
      set((st) => {
        const suggestions = { ...st.suggestions };
        delete suggestions[conversationId];
        return { ...applyMessage(st, message, 0), suggestions };
      });
    } catch (err) {
      getState().pushToast({ kind: 'error', title: 'Envoi de la suggestion impossible', body: errorText(err) });
    }
  },

  async discardSuggestion(conversationId) {
    const s = getState().suggestions[conversationId];
    if (!s) return;
    set((st) => {
      const suggestions = { ...st.suggestions };
      delete suggestions[conversationId];
      return { suggestions };
    });
    try {
      await post(`/suggestions/${s.id}/discard`);
    } catch (err) {
      getState().pushToast({ kind: 'error', title: 'Action impossible', body: errorText(err) });
    }
  },

  pushToast(t) {
    const id = newClientId();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => getState().dismissToast(id), t.kind === 'error' ? 8000 : 5500);
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

/**
 * Envoi idempotent : la conversation cible est figée dans le message sortant au moment
 * de l'envoi ; changer de conversation pendant la requête ne peut pas la réattribuer.
 */
async function deliver(o: OutgoingMessage): Promise<void> {
  const { setState, getState } = useStore;
  try {
    const { message } = await post<{ message: Message }>(`/conversations/${o.conversationId}/messages`, {
      content: o.content,
      clientId: o.clientId,
      replyToMessageId: o.replyToMessageId,
    });
    setState((s) => applyMessage(s, message, 0));
  } catch (err) {
    const error = err instanceof ApiError && err.isNetwork ? 'Réseau indisponible' : errorText(err);
    setState((s) => (s.outbox[o.clientId] ? { outbox: { ...s.outbox, [o.clientId]: { ...o, status: 'failed', error } } } : {}));
    if (!(err instanceof ApiError && err.isNetwork)) getState().pushToast({ kind: 'error', title: 'Message non envoyé', body: error });
  }
}

function scheduleDraftSave(conversationId: string) {
  clearTimeout(draftTimers.get(conversationId));
  draftTimers.set(
    conversationId,
    setTimeout(async () => {
      draftTimers.delete(conversationId);
      const d = useStore.getState().drafts[conversationId];
      try {
        await put(`/conversations/${conversationId}/draft`, {
          content: d?.content ?? '',
          replyToMessageId: d?.replyToMessageId ?? null,
          clientUpdatedAt: d?.updatedAt ?? Date.now(),
        });
      } catch {
        /* conservé localement ; renvoyé au prochain démarrage */
      }
    }, DRAFT_SAVE_DELAY),
  );
}

/** Marque une conversation comme lue peu après l'arrivée d'un message, si elle est affichée. */
export function scheduleMarkRead(conversationId: string, delay = 400) {
  clearTimeout(readTimers.get(conversationId));
  readTimers.set(
    conversationId,
    setTimeout(() => {
      readTimers.delete(conversationId);
      const s = useStore.getState();
      if (s.activeConversationId === conversationId && document.visibilityState === 'visible') void s.markRead(conversationId);
    }, delay),
  );
}
