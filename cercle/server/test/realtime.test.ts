import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RealtimeEvent } from '../src/realtime/eventBus.js';
import { createTestEnv, history, incoming, quietAll, send, waitFor, type TestEnv } from './helpers.js';

let env: TestEnv;
let socket: Socket | null = null;
let baseUrl = '';
let cookie = '';

beforeEach(async () => {
  env = await createTestEnv({ login: false });
  quietAll(env);
  await new Promise<void>((resolve) => env.app.server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(env.app.server.address() as AddressInfo).port}`;
  const login = await env.agent.post('/api/auth/login').send({ username: 'moi', password: 'secret-test' }).expect(200);
  cookie = String(login.headers['set-cookie']).split(';')[0]!;
});
afterEach(async () => {
  socket?.disconnect();
  socket = null;
  await env.close();
});

function openSocket(withCookie = true): Promise<{ socket: Socket; received: RealtimeEvent[] }> {
  const received: RealtimeEvent[] = [];
  const s = connect(baseUrl, {
    path: '/socket.io',
    transports: ['websocket'],
    extraHeaders: withCookie ? { cookie } : {},
    reconnection: false,
  });
  s.on('event', (e: RealtimeEvent) => received.push(e));
  return new Promise((resolve, reject) => {
    s.on('connect', () => resolve({ socket: s, received }));
    s.on('connect_error', (err) => reject(err));
  });
}

describe('Test 2 — réception en arrière-plan', () => {
  it('un message d’Emma pendant que je parle à Lucas est enregistré, notifié et diffusé avec le bon identifiant', async () => {
    const opened = await openSocket();
    socket = opened.socket;
    const lucas = env.convOf('Lucas');
    const emma = env.convOf('Emma');
    await send(env, lucas, 'Tu as vu le nouveau jeu ?').expect(201);
    await incoming(env, 'Emma');
    await send(env, lucas, 'Je continue avec toi Lucas').expect(201);

    await waitFor(() => opened.received.some((e) => e.type === 'notification.upserted'));
    const emmaMsg = opened.received.find(
      (e) => e.type === 'message.created' && (e.payload as { message: { authorType: string } }).message.authorType === 'character',
    );
    expect((emmaMsg!.payload as { message: { conversationId: string } }).message.conversationId).toBe(emma);
    const summaries = opened.received
      .filter((e) => e.type === 'conversation.updated')
      .map((e) => (e.payload as { conversation: { id: string; unreadCount: number } }).conversation);
    expect(summaries.filter((s) => s.id === emma).at(-1)!.unreadCount).toBe(1);
    // Lucas n'est pas affecté : aucun non-lu, historique intact.
    expect(summaries.filter((s) => s.id === lucas).every((s) => s.unreadCount === 0)).toBe(true);
    expect((await history(env, lucas)).map((m) => m.content)).toEqual(['Tu as vu le nouveau jeu ?', 'Je continue avec toi Lucas']);
    const notif = opened.received.find((e) => e.type === 'notification.upserted')!.payload as {
      notification: { conversationId: string; type: string };
    };
    expect(notif.notification).toMatchObject({ conversationId: emma, type: 'new_message' });
  });

  it('plusieurs messages d’une même personne regroupent la notification (compteur) sans en créer d’autres', async () => {
    await incoming(env, 'Emma');
    await send(env, env.convOf('Emma'), 'ok').expect(201); // lit la conversation
    await incoming(env, 'Emma');
    await incoming(env, 'Emma');
    const items = (await env.agent.get('/api/notifications?unread=1').expect(200)).body.items as Array<{ count: number; conversationId: string }>;
    expect(items).toHaveLength(1);
    expect(items[0]!.conversationId).toBe(env.convOf('Emma'));
  });

  it('refuse une connexion temps réel sans session', async () => {
    await expect(openSocket(false)).rejects.toThrow(/unauthorized/);
  });
});

describe('Reconnexion — rattrapage des événements manqués', () => {
  it('rejoue les événements postérieurs au dernier numéro connu, dans l’ordre', async () => {
    const before = (await env.agent.get('/api/bootstrap').expect(200)).body.lastEventSeq as number;
    await incoming(env, 'Sarah');
    await send(env, env.convOf('Lucas'), 'hors ligne').expect(201);
    const res = await env.agent.get(`/api/events?after=${before}`).expect(200);
    expect(res.body.reset).toBe(false);
    const seqs = (res.body.events as RealtimeEvent[]).map((e) => e.seq!);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    const created = (res.body.events as RealtimeEvent[]).filter((e) => e.type === 'message.created');
    expect(created.map((e) => (e.payload as { message: { conversationId: string } }).message.conversationId)).toEqual([
      env.convOf('Sarah'),
      env.convOf('Lucas'),
    ]);
  });

  it('demande une resynchronisation complète si le client est en avance (base réinitialisée)', async () => {
    const res = await env.agent.get('/api/events?after=999999').expect(200);
    expect(res.body.reset).toBe(true);
  });
});
