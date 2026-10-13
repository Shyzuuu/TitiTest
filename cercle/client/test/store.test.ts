import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationSummary, Message, RealtimeEvent } from '../src/lib/types';
import { __test } from '../src/store/realtime';
import { initialData } from '../src/store/reducer';
import { mergeDrafts, useStore } from '../src/store/store';

const conv = (id: string, characterId: string): ConversationSummary => ({
  id,
  characterId,
  version: 0,
  lastMessage: null,
  lastMessageAt: null,
  unreadCount: 0,
  pendingAiReply: null,
  pendingCharacterReply: null,
  pendingSuggestions: 0,
  autoChain: 0,
  createdAt: 1,
});

let seq = 1000;
const msg = (conversationId: string, n: number, authorType: 'user' | 'character' = 'character', extra: Partial<Message> = {}): Message => ({
  id: `m-${conversationId}-${n}`,
  conversationId,
  seq: n,
  authorType,
  authorId: authorType === 'user' ? 'me' : `chr-${conversationId}`,
  content: `message ${n} de ${conversationId}`,
  origin: authorType === 'user' ? 'manual' : 'simulation',
  status: 'sent',
  replyToMessageId: null,
  replyTo: null,
  clientId: null,
  createdAt: Date.now(),
  readAt: null,
  deletedAt: null,
  ...extra,
});
const created = (m: Message): RealtimeEvent => ({ seq: ++seq, type: 'message.created', payload: { message: m }, createdAt: Date.now() });

function reset() {
  seq = 1000;
  localStorage.clear();
  useStore.setState({
    ...initialData,
    status: 'ready',
    lastEventSeq: 1000,
    activeConversationId: null,
    toasts: [],
    characters: {
      'chr-emma': { id: 'chr-emma', firstName: 'Emma', fullName: 'Emma Laurent' } as never,
      'chr-lucas': { id: 'chr-lucas', firstName: 'Lucas', fullName: 'Lucas Martin' } as never,
    },
    conversations: { emma: conv('emma', 'chr-emma'), lucas: conv('lucas', 'chr-lucas'), sarah: conv('sarah', 'chr-sarah') },
    messages: {
      emma: { ids: [], byId: {}, hasMore: false, loaded: true, loading: false },
      lucas: { ids: [], byId: {}, hasMore: false, loaded: true, loading: false },
    },
  });
}

beforeEach(reset);
afterEach(() => vi.unstubAllGlobals());

describe('Changement de personne et événements entrants', () => {
  it('un message d’Emma reçu pendant que Lucas est affiché ne touche ni Lucas ni la conversation active', () => {
    useStore.getState().setActiveConversation('lucas');
    useStore.getState().applyEvents([created(msg('lucas', 1, 'user'))]);
    __test.handle([created(msg('emma', 1))]);
    const s = useStore.getState();
    expect(s.activeConversationId).toBe('lucas');
    expect(s.messages.emma!.ids).toEqual(['m-emma-1']);
    expect(s.messages.lucas!.ids).toEqual(['m-lucas-1']);
    // Notification cliquable vers Emma, sans navigation automatique.
    expect(s.toasts).toHaveLength(1);
    expect(s.toasts[0]).toMatchObject({ conversationId: 'emma', kind: 'message' });
  });

  it('trois messages quasi simultanés vont chacun dans leur conversation', () => {
    __test.handle([created(msg('emma', 1)), created(msg('lucas', 1)), created(msg('sarah', 1))]);
    const s = useStore.getState();
    expect(s.messages.emma!.ids).toEqual(['m-emma-1']);
    expect(s.messages.lucas!.ids).toEqual(['m-lucas-1']);
    // Conversation jamais ouverte : pas d'historique partiel, il sera chargé à l'ouverture.
    expect(s.messages.sarah).toBeUndefined();
    expect(Object.keys(s.flash).sort()).toEqual(['emma', 'lucas', 'sarah']);
    expect(s.toasts.map((t) => t.conversationId)).toEqual(['emma', 'lucas', 'sarah']);
  });

  it('les événements rejoués (reconnexion) sont ignorés : aucun doublon', () => {
    const e = created(msg('emma', 1));
    useStore.getState().applyEvents([e]);
    useStore.getState().applyEvents([e, e]);
    expect(useStore.getState().messages.emma!.ids).toEqual(['m-emma-1']);
  });

  it('conserve l’ordre par séquence même si les messages arrivent dans le désordre', () => {
    useStore.getState().applyEvents([created(msg('emma', 3)), created(msg('emma', 1)), created(msg('emma', 2))]);
    expect(useStore.getState().messages.emma!.ids).toEqual(['m-emma-1', 'm-emma-2', 'm-emma-3']);
  });
});

describe('Test 5 — brouillons indépendants', () => {
  it('chaque conversation garde son brouillon et sa citation', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"draft":null}', { status: 200 })));
    const { setDraft } = useStore.getState();
    setDraft('emma', { content: 'Je voulais justement te demander si...' });
    setDraft('lucas', { content: 'Tu as vu le nouveau jeu ?', replyToMessageId: 'm-lucas-1' });
    setDraft('emma', { content: 'Je voulais justement te demander si... tu viens' });
    const d = useStore.getState().drafts;
    expect(d.emma).toMatchObject({ content: 'Je voulais justement te demander si... tu viens', replyToMessageId: null });
    expect(d.lucas).toMatchObject({ content: 'Tu as vu le nouveau jeu ?', replyToMessageId: 'm-lucas-1' });
    // Persistance locale immédiate (fermeture de l'onglet avant la sauvegarde serveur).
    const local = JSON.parse(localStorage.getItem('cercle:drafts')!);
    expect(Object.keys(local).sort()).toEqual(['emma', 'lucas']);
  });

  it('la fusion serveur/local garde le brouillon le plus récent par conversation', () => {
    const merged = mergeDrafts(
      [
        { conversationId: 'emma', content: 'serveur récent', replyToMessageId: null, updatedAt: 200 },
        { conversationId: 'lucas', content: 'serveur ancien', replyToMessageId: null, updatedAt: 100 },
      ],
      {
        emma: { conversationId: 'emma', content: 'local ancien', replyToMessageId: null, updatedAt: 150 },
        lucas: { conversationId: 'lucas', content: 'local récent', replyToMessageId: null, updatedAt: 300 },
        ghost: { conversationId: 'ghost', content: 'conversation supprimée', replyToMessageId: null, updatedAt: 999 },
      },
      new Set(['emma', 'lucas']),
    );
    expect(merged.emma!.content).toBe('serveur récent');
    expect(merged.lucas!.content).toBe('local récent');
    expect(merged.ghost).toBeUndefined();
  });
});

describe('Envoi idempotent et changement de conversation pendant l’envoi', () => {
  it('le message reste attribué à Emma même si l’on passe sur Lucas avant la réponse du serveur', async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal('fetch', fetchMock);
    useStore.getState().setActiveConversation('emma');
    const sending = useStore.getState().sendMessage('emma', 'Salut Emma', null);
    useStore.getState().setActiveConversation('lucas');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toContain('/api/conversations/emma/messages');
    const body = JSON.parse(String(init.body));
    resolve(new Response(JSON.stringify({ message: msg('emma', 1, 'user', { clientId: body.clientId, content: 'Salut Emma' }) }), { status: 201 }));
    await sending;
    const s = useStore.getState();
    expect(s.messages.emma!.ids).toEqual(['m-emma-1']);
    expect(s.messages.lucas!.ids).toEqual([]);
    expect(Object.keys(s.outbox)).toHaveLength(0);
  });

  it('coupure réseau : échec visible, puis réessai avec la même clé d’idempotence', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    await useStore.getState().sendMessage('emma', 'Message important', null);
    const [failed] = Object.values(useStore.getState().outbox);
    expect(failed).toMatchObject({ status: 'failed', conversationId: 'emma' });
    fetchMock.mockImplementationOnce(async (_url: URL, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ message: msg('emma', 1, 'user', { clientId: b.clientId }) }), { status: 201 });
    });
    await useStore.getState().retryMessage(failed!.clientId);
    const second = JSON.parse(String((fetchMock.mock.calls[1] as unknown as [URL, RequestInit])[1].body));
    const first = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [URL, RequestInit])[1].body));
    expect(second.clientId).toBe(first.clientId);
    expect(useStore.getState().outbox).toEqual({});
    expect(useStore.getState().messages.emma!.ids).toEqual(['m-emma-1']);
  });

  it('plusieurs messages successifs sont tous envoyés, sans attendre de réponse', async () => {
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: URL, init: RequestInit) => {
        const b = JSON.parse(String(init.body));
        n++;
        return new Response(JSON.stringify({ message: msg('emma', n, 'user', { clientId: b.clientId, content: b.content }) }), { status: 201 });
      }),
    );
    await Promise.all(['Un', 'Deux', 'Trois', 'Quatre', 'Cinq'].map((t) => useStore.getState().sendMessage('emma', t, null)));
    expect(useStore.getState().messages.emma!.ids).toHaveLength(5);
  });
});
