import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestEnv, history, incoming, quietAll, send, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeEach(async () => {
  env = await createTestEnv();
  quietAll(env);
});
afterEach(async () => env.close());

describe('Test 1 — changement de personne', () => {
  it('chaque conversation conserve son historique et son état quand on passe Emma → Lucas → Sarah → Emma', async () => {
    const emma = env.convOf('Emma');
    const lucas = env.convOf('Lucas');
    const sarah = env.convOf('Sarah');
    await send(env, emma, 'Salut Emma').expect(201);
    await send(env, lucas, 'Yo Lucas').expect(201);
    await send(env, sarah, 'Bonjour Sarah').expect(201);
    await send(env, emma, 'Je reviens vers toi Emma').expect(201);

    const [h1, h2, h3] = await Promise.all([history(env, emma), history(env, lucas), history(env, sarah)]);
    expect(h1.map((m) => m.content)).toEqual(['Salut Emma', 'Je reviens vers toi Emma']);
    expect(h2.map((m) => m.content)).toEqual(['Yo Lucas']);
    expect(h3.map((m) => m.content)).toEqual(['Bonjour Sarah']);
    for (const [conv, h] of [[emma, h1], [lucas, h2], [sarah, h3]] as const) {
      expect(h.every((m) => m.conversationId === conv)).toBe(true);
    }
    const list = (await env.agent.get('/api/conversations').expect(200)).body.conversations as Array<{ id: string; lastMessage: { preview: string } | null }>;
    expect(list.find((c) => c.id === emma)!.lastMessage!.preview).toBe('Je reviens vers toi Emma');
    expect(list.find((c) => c.id === lucas)!.lastMessage!.preview).toBe('Yo Lucas');
  });
});

describe('Test 3 — plusieurs messages personnels successifs', () => {
  it('accepte cinq messages de suite, chacun avec son identifiant, dans le bon ordre', async () => {
    const emma = env.convOf('Emma');
    const texts = ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq'];
    for (const t of texts) await send(env, emma, t).expect(201);
    const h = await history(env, emma);
    expect(h.map((m) => m.content)).toEqual(texts);
    expect(new Set(h.map((m) => m.id)).size).toBe(5);
    expect(h.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(h.every((m) => m.authorType === 'user' && m.origin === 'manual')).toBe(true);
  });

  it('accepte des envois simultanés sans perte ni doublon', async () => {
    const emma = env.convOf('Emma');
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => send(env, emma, `Message ${i}`)));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const h = await history(env, emma);
    expect(h).toHaveLength(10);
    expect(new Set(h.map((m) => m.content)).size).toBe(10);
  });

  it('est idempotent : un renvoi avec la même clé ne crée pas de doublon', async () => {
    const emma = env.convOf('Emma');
    const first = await send(env, emma, 'Coupure réseau ?', undefined, 'retry-key-0001').expect(201);
    const retry = await send(env, emma, 'Coupure réseau ?', undefined, 'retry-key-0001').expect(200);
    expect(retry.body.created).toBe(false);
    expect(retry.body.message.id).toBe(first.body.message.id);
    expect(await history(env, emma)).toHaveLength(1);
  });
});

describe('Test 4 — répondre à son propre message', () => {
  it('cite un message que j’ai envoyé et l’affiche avec la référence', async () => {
    const emma = env.convOf('Emma');
    const original = (await send(env, emma, 'Je pense jouer ce soir.').expect(201)).body.message;
    const reply = (await send(env, emma, 'Finalement, je vais peut-être faire autre chose.', original.id).expect(201)).body.message;
    expect(reply.replyToMessageId).toBe(original.id);
    expect(reply.replyTo).toMatchObject({ id: original.id, authorType: 'user', content: 'Je pense jouer ce soir.', deleted: false });
    const h = await history(env, emma);
    expect(h.map((m) => m.content)).toEqual(['Je pense jouer ce soir.', 'Finalement, je vais peut-être faire autre chose.']);
    expect(h[1]!.authorType).toBe('user');
  });

  it('scénario de la partie 11 : messages successifs, réponse à soi-même, puis Emma, puis moi', async () => {
    const emma = env.convOf('Emma');
    await send(env, emma, 'Salut !').expect(201);
    await send(env, emma, "J'ai oublié de te dire quelque chose.").expect(201);
    const back = (await send(env, emma, 'Je reviens dans cinq minutes.').expect(201)).body.message;
    await send(env, emma, 'finalement, je suis revenu plus tôt.', back.id).expect(201);
    await incoming(env, 'Emma');
    await send(env, emma, 'Oui !').expect(201);

    const h = await history(env, emma);
    expect(h.map((m) => m.authorType)).toEqual(['user', 'user', 'user', 'user', 'character', 'user']);
    expect(h[3]!.replyTo).toMatchObject({ id: back.id, authorType: 'user' });
    expect(h.map((m) => m.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    // Répondre implique la lecture : aucun non-lu résiduel, aucune réponse IA (mode désactivé).
    const summary = (await env.agent.get(`/api/conversations/${emma}`).expect(200)).body.conversation;
    expect(summary.unreadCount).toBe(0);
    expect(summary.pendingAiReply).toBeNull();
  });

  it('cite un message du personnage, et refuse une citation venant d’une autre conversation', async () => {
    const emma = env.convOf('Emma');
    const lucas = env.convOf('Lucas');
    await incoming(env, 'Emma');
    const fromEmma = (await history(env, emma))[0]!;
    const ok = await send(env, emma, 'Je réponds à ton message', fromEmma.id).expect(201);
    expect(ok.body.message.replyTo).toMatchObject({ id: fromEmma.id, authorType: 'character' });
    const bad = await send(env, lucas, 'Citation croisée', fromEmma.id);
    expect(bad.status).toBe(400);
    expect(await history(env, lucas)).toHaveLength(0);
  });

  it('signale une citation dont l’original a été supprimé', async () => {
    const emma = env.convOf('Emma');
    const original = (await send(env, emma, 'À supprimer').expect(201)).body.message;
    const reply = (await send(env, emma, 'Réponse', original.id).expect(201)).body.message;
    await env.agent.delete(`/api/messages/${original.id}`).expect(200);
    const h = await history(env, emma);
    const quoted = h.find((m) => m.id === reply.id)!;
    expect(quoted.replyTo).toMatchObject({ id: original.id, deleted: true, content: '' });
  });
});

describe('Test 11 — concurrence', () => {
  it('des messages simultanés de plusieurs personnages arrivent chacun dans la bonne conversation', async () => {
    const names = ['Emma', 'Lucas', 'Sarah'];
    for (const n of names) env.ctx.automation.triggerIncomingNow(env.userId, env.charOf(n));
    env.events.length = 0;
    await env.ctx.scheduler.runUntilIdle();
    for (const n of names) {
      const h = await history(env, env.convOf(n));
      expect(h).toHaveLength(1);
      expect(h[0]!.authorType).toBe('character');
      expect(h[0]!.conversationId).toBe(env.convOf(n));
    }
    const created = env.events.filter((e) => e.type === 'message.created');
    expect(created).toHaveLength(3);
    for (const e of created) {
      const msg = (e.payload as { message: { conversationId: string; authorId: string } }).message;
      const character = env.ctx.characters.findById(msg.authorId)!;
      expect(env.convOf(character.firstName)).toBe(msg.conversationId);
    }
    const list = (await env.agent.get('/api/conversations').expect(200)).body.conversations as Array<{ id: string; unreadCount: number }>;
    for (const n of names) expect(list.find((c) => c.id === env.convOf(n))!.unreadCount).toBe(1);
    const notifs = (await env.agent.get('/api/notifications').expect(200)).body.items as Array<{ conversationId: string }>;
    expect(new Set(notifs.map((x) => x.conversationId))).toEqual(new Set(names.map((n) => env.convOf(n))));
  });

  it('les numéros de séquence restent uniques sous envois concurrents mêlés de messages entrants', async () => {
    const emma = env.convOf('Emma');
    env.ctx.automation.triggerIncomingNow(env.userId, env.charOf('Emma'));
    await Promise.all([
      ...Array.from({ length: 6 }, (_, i) => send(env, emma, `m${i}`)),
      env.ctx.scheduler.runUntilIdle(),
    ]);
    const h = await history(env, emma);
    expect(h.length).toBeGreaterThanOrEqual(7);
    expect(new Set(h.map((m) => m.seq)).size).toBe(h.length);
  });
});
