import { io, type Socket } from 'socket.io-client';
import { get } from '../lib/api';
import type { Message, RealtimeEvent } from '../lib/types';
import { scheduleMarkRead, useStore } from './store';

let socket: Socket | null = null;
let catchingUp: Promise<void> | null = null;
let buffered: RealtimeEvent[] = [];

/**
 * Rattrapage après coupure : rejoue les événements manqués depuis le dernier numéro
 * connu. Si le serveur ne peut pas les fournir (`reset`), resynchronisation complète.
 */
async function catchUp(): Promise<void> {
  if (catchingUp) return catchingUp;
  const store = useStore.getState();
  store.setConnection('resyncing');
  catchingUp = (async () => {
    try {
      for (let i = 0; i < 20; i++) {
        const after = useStore.getState().lastEventSeq;
        const res = await get<{ events: RealtimeEvent[]; reset: boolean; lastSeq: number }>('/events', { after });
        if (res.reset) {
          await useStore.getState().bootstrap();
          break;
        }
        handle(res.events);
        if (res.events.length === 0 || useStore.getState().lastEventSeq >= res.lastSeq) break;
      }
      const pending = buffered;
      buffered = [];
      handle(pending);
      useStore.getState().setConnection(socket?.connected ? 'online' : 'offline');
    } catch {
      useStore.getState().setConnection('offline');
    } finally {
      catchingUp = null;
    }
  })();
  return catchingUp;
}

function handle(events: RealtimeEvent[]) {
  if (events.length === 0) return;
  const store = useStore.getState();
  if (events.some((e) => e.type === 'resync')) {
    void store.bootstrap();
    return;
  }
  const before = store.lastEventSeq;
  store.applyEvents(events);
  // Effets d'interface, uniquement pour les événements nouvellement appliqués.
  for (const e of events) {
    if (e.type !== 'message.created' || (e.seq !== null && e.seq <= before)) continue;
    const message = (e.payload as { message: Message }).message;
    if (message.authorType !== 'character') continue;
    const s = useStore.getState();
    if (s.activeConversationId === message.conversationId && document.visibilityState === 'visible') {
      scheduleMarkRead(message.conversationId);
    } else {
      // Notification non intrusive : jamais de changement automatique de conversation.
      const character = s.characters[s.conversations[message.conversationId]?.characterId ?? ''];
      s.pushToast({
        kind: 'message',
        title: character?.fullName ?? 'Nouveau message',
        body: message.content,
        conversationId: message.conversationId,
        messageId: message.id,
        characterId: character?.id,
      });
    }
  }
}

function onEvent(event: RealtimeEvent) {
  const last = useStore.getState().lastEventSeq;
  if (event.seq === null) {
    useStore.getState().applyEvents([event]);
    return;
  }
  if (catchingUp) {
    buffered.push(event);
    return;
  }
  if (event.seq <= last) return;
  if (event.seq > last + 1) {
    // Trou dans la séquence : les événements intermédiaires sont récupérés avant d'appliquer celui-ci.
    buffered.push(event);
    void catchUp();
    return;
  }
  handle([event]);
}

export function connectRealtime(): void {
  if (socket) return;
  useStore.getState().setConnection('connecting');
  socket = io({ path: '/socket.io', withCredentials: true, reconnectionDelayMax: 8000, transports: ['websocket', 'polling'] });
  socket.on('connect', () => {
    void catchUp();
  });
  socket.on('disconnect', () => useStore.getState().setConnection('offline'));
  socket.on('connect_error', () => useStore.getState().setConnection('offline'));
  socket.on('event', onEvent);
}

export function disconnectRealtime(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  buffered = [];
}

/** Retour d'un onglet en arrière-plan : on vérifie qu'aucun événement n'a été manqué. */
export function resumeRealtime(): void {
  if (socket && !socket.connected) socket.connect();
  else void catchUp();
}

/** Point d'entrée de test : simule la réception d'un événement temps réel. */
export const __test = { onEvent, handle };
