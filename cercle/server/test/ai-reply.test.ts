import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ControlledProvider,
  createTestEnv,
  history,
  incoming,
  pendingTasks,
  quietAll,
  send,
  setAi,
  waitFor,
  type TestEnv,
} from './helpers.js';

let env: TestEnv;
let provider: ControlledProvider;

beforeEach(async () => {
  provider = new ControlledProvider();
  env = await createTestEnv({ anthropicProvider: provider });
  quietAll(env);
});
afterEach(async () => env.close());

const TWO_MINUTES = 120_000;

describe('Test 6 — réponse IA différée', () => {
  it('n’envoie rien avant le délai, puis répond à Emma si les conditions sont toujours valides', async () => {
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 120 });
    const emma = env.convOf('Emma');
    await incoming(env, 'Emma'); // « Tu es disponible ce soir ? » côté personnage
    const task = pendingTasks(env, 'ai_reply')[0]!;
    expect(task.conversationId).toBe(emma);
    expect(task.runAt).toBe(env.clock.now() + TWO_MINUTES);

    env.clock.advance(TWO_MINUTES - 1000);
    await env.ctx.scheduler.runUntilIdle();
    expect((await history(env, emma)).filter((m) => m.authorType === 'user')).toHaveLength(0);

    env.clock.advance(1000);
    await env.ctx.scheduler.runUntilIdle();
    const h = await history(env, emma);
    const ai = h.filter((m) => m.origin === 'ai_auto');
    expect(ai).toHaveLength(1);
    expect(ai[0]!.authorType).toBe('user');
    expect(env.ctx.tasks.get(task.id)!.status).toBe('done');
    const notifs = (await env.agent.get('/api/notifications').expect(200)).body.items as Array<{ type: string; conversationId: string }>;
    expect(notifs.some((n) => n.type === 'ai_auto_sent' && n.conversationId === emma)).toBe(true);
    // Le contexte transmis à l'IA ne contient que la conversation d'Emma.
    const call = provider.calls.find((c) => c.purpose === 'user_proxy')!;
    expect(call.character.firstName).toBe('Emma');
  });

  it('mode désactivé : aucune tâche IA n’est programmée', async () => {
    setAi(env, 'Emma', { mode: 'off' });
    await incoming(env, 'Emma');
    expect(pendingTasks(env, 'ai_reply')).toHaveLength(0);
  });

  it('mode suggestion : la réponse est proposée, pas envoyée, et peut être modifiée puis envoyée', async () => {
    setAi(env, 'Emma', { mode: 'suggest', delaySeconds: 30 });
    const emma = env.convOf('Emma');
    await incoming(env, 'Emma');
    env.clock.advance(30_000);
    await env.ctx.scheduler.runUntilIdle();
    expect((await history(env, emma)).some((m) => m.authorType === 'user')).toBe(false);
    const suggestions = (await env.agent.get('/api/suggestions').expect(200)).body.suggestions as Array<{ id: string; content: string }>;
    expect(suggestions).toHaveLength(1);
    const sent = await env.agent.post(`/api/suggestions/${suggestions[0]!.id}/send`).send({ content: 'Version modifiée' }).expect(201);
    expect(sent.body.message).toMatchObject({ content: 'Version modifiée', origin: 'ai_suggestion', authorType: 'user' });
    expect((await env.agent.get('/api/suggestions').expect(200)).body.suggestions).toHaveLength(0);
  });

  it('mode automatique avec exceptions : un message sensible exige une confirmation', async () => {
    setAi(env, 'Emma', { mode: 'auto_with_exceptions', delaySeconds: 10, excludedTopics: ['politique'] });
    const emma = env.convOf('Emma');
    const conv = env.ctx.conversations.getRow(emma)!;
    env.ctx.db.transaction(() => env.ctx.messages.insertFromCharacter(env.userId, conv, 'Tu peux me prêter 200 euros ?', 'simulation', 'manual-sensitive-1'));
    env.clock.advance(10_000);
    await env.ctx.scheduler.runUntilIdle();
    expect((await history(env, emma)).some((m) => m.origin === 'ai_auto')).toBe(false);
    const suggestions = (await env.agent.get('/api/suggestions').expect(200)).body.suggestions as Array<{ reason: string }>;
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.reason).toMatch(/argent/);
    const notifs = (await env.agent.get('/api/notifications').expect(200)).body.items as Array<{ type: string }>;
    expect(notifs.some((n) => n.type === 'ai_confirmation')).toBe(true);
  });

  it('mode automatique avec exceptions : un message ordinaire reçoit une réponse automatique', async () => {
    setAi(env, 'Emma', { mode: 'auto_with_exceptions', delaySeconds: 10 });
    const emma = env.convOf('Emma');
    const conv = env.ctx.conversations.getRow(emma)!;
    env.ctx.db.transaction(() => env.ctx.messages.insertFromCharacter(env.userId, conv, 'Tu as passé une bonne journée ?', 'simulation', 'manual-ordinary-1'));
    env.clock.advance(10_000);
    await env.ctx.scheduler.runUntilIdle();
    expect((await history(env, emma)).filter((m) => m.origin === 'ai_auto')).toHaveLength(1);
  });

  it('regroupe une rafale de messages du personnage en une seule réponse IA', async () => {
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 120 });
    const emma = env.convOf('Emma');
    const conv = () => env.ctx.conversations.getRow(emma)!;
    for (let i = 0; i < 3; i++) {
      env.ctx.db.transaction(() => env.ctx.messages.insertFromCharacter(env.userId, conv(), `Message ${i}`, 'simulation', `burst-${i}`));
      env.clock.advance(5000);
    }
    expect(pendingTasks(env, 'ai_reply')).toHaveLength(1);
    env.clock.advance(TWO_MINUTES);
    await env.ctx.scheduler.runUntilIdle();
    expect((await history(env, emma)).filter((m) => m.origin === 'ai_auto')).toHaveLength(1);
  });

  it('limite la chaîne de réponses automatiques (pas de boucle IA ↔ personnage)', async () => {
    env.ctx.settings.update(env.userId, { maxAutoChain: 2 });
    env.ctx.characters.update(env.userId, env.charOf('Emma'), {
      automation: { replyEnabled: true, replyDelayMinSeconds: 1, replyDelayMaxSeconds: 1 },
      ai: { mode: 'auto', delaySeconds: 5 },
    });
    const emma = env.convOf('Emma');
    await incoming(env, 'Emma');
    for (let i = 0; i < 20; i++) {
      env.clock.advance(10_000);
      await env.ctx.scheduler.runUntilIdle();
    }
    expect((await history(env, emma)).filter((m) => m.origin === 'ai_auto')).toHaveLength(2);
    expect(pendingTasks(env, 'ai_reply')).toHaveLength(0);
  });
});

describe('Test 7 — priorité absolue à la réponse manuelle', () => {
  it('réponse manuelle à 14 h 01 min 59 s : l’IA de 14 h 02 n’envoie aucun doublon', async () => {
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 120 });
    const emma = env.convOf('Emma');
    await incoming(env, 'Emma'); // 14 h 00
    const task = pendingTasks(env, 'ai_reply')[0]!;
    env.clock.advance(TWO_MINUTES - 1000); // 14 h 01 min 59 s
    await send(env, emma, 'Oui, je suis dispo !').expect(201);
    expect(env.ctx.tasks.get(task.id)!.status).toBe('cancelled');
    env.clock.advance(1000); // 14 h 02
    await env.ctx.scheduler.runUntilIdle();
    const users = (await history(env, emma)).filter((m) => m.authorType === 'user');
    expect(users.map((m) => m.origin)).toEqual(['manual']);
    expect(provider.calls.filter((c) => c.purpose === 'user_proxy')).toHaveLength(0);
  });

  it('réponse manuelle PENDANT la génération : la vérification finale abandonne la réponse IA', async () => {
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 120 });
    const emma = env.convOf('Emma');
    await incoming(env, 'Emma');
    const task = pendingTasks(env, 'ai_reply')[0]!;
    provider.mode = 'manual';
    env.clock.advance(TWO_MINUTES);
    const tick = env.ctx.scheduler.tick(); // la génération démarre et reste bloquée
    await waitFor(() => provider.pending === 1);
    await send(env, emma, 'Réponse humaine juste à temps').expect(201);
    provider.releaseAll();
    await tick;
    const users = (await history(env, emma)).filter((m) => m.authorType === 'user');
    expect(users).toHaveLength(1);
    expect(users[0]!.origin).toBe('manual');
    expect(env.ctx.tasks.get(task.id)!.status).toBe('superseded');
  });

  it('la clé d’idempotence de la tâche empêche tout doublon même si elle est rejouée', async () => {
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 5 });
    const emma = env.convOf('Emma');
    await incoming(env, 'Emma');
    const task = pendingTasks(env, 'ai_reply')[0]!;
    env.clock.advance(5000);
    await env.ctx.scheduler.runUntilIdle();
    const conv = env.ctx.conversations.getRow(emma)!;
    const replay = env.ctx.db.transaction(() => env.ctx.messages.insertAiAuto(env.userId, conv, 'doublon', `task:${task.id}`));
    expect(replay).toBeNull();
    expect((await history(env, emma)).filter((m) => m.origin === 'ai_auto')).toHaveLength(1);
  });
});

describe('Test 8 — changement de conversation pendant l’attente', () => {
  it('parler à Lucas n’annule ni ne décale la tâche d’Emma ; la réponse arrive chez Emma', async () => {
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 120 });
    setAi(env, 'Lucas', { mode: 'auto', delaySeconds: 60 });
    const emma = env.convOf('Emma');
    const lucas = env.convOf('Lucas');
    await incoming(env, 'Emma');
    const emmaTask = pendingTasks(env, 'ai_reply')[0]!;
    await incoming(env, 'Lucas');
    // Je réponds à Lucas : seule la tâche de Lucas est annulée.
    await send(env, lucas, 'Je te réponds Lucas').expect(201);
    await env.agent.post(`/api/conversations/${lucas}/read`).send({}).expect(200);
    const emmaAfter = env.ctx.tasks.get(emmaTask.id)!;
    expect(emmaAfter.status).toBe('pending');
    expect(emmaAfter.run_at).toBe(emmaTask.runAt);
    expect(pendingTasks(env, 'ai_reply').map((t) => t.conversationId)).toEqual([emma]);

    env.clock.advance(TWO_MINUTES);
    await env.ctx.scheduler.runUntilIdle();
    expect((await history(env, emma)).filter((m) => m.origin === 'ai_auto')).toHaveLength(1);
    expect((await history(env, lucas)).filter((m) => m.origin === 'ai_auto')).toHaveLength(0);
  });

  it('répondre à Emma depuis n’importe où annule sa tâche, même si j’étais chez Lucas', async () => {
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 120 });
    setAi(env, 'Sarah', { mode: 'auto', delaySeconds: 120 });
    await incoming(env, 'Emma');
    await incoming(env, 'Sarah');
    await send(env, env.convOf('Lucas'), 'Je parle à Lucas').expect(201);
    await send(env, env.convOf('Emma'), 'Coucou Emma').expect(201);
    const pending = pendingTasks(env, 'ai_reply');
    expect(pending.map((t) => t.conversationId)).toEqual([env.convOf('Sarah')]);
  });

  it('modifier le délai IA recalcule l’échéance de la tâche en attente', async () => {
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 120 });
    await incoming(env, 'Emma');
    const before = pendingTasks(env, 'ai_reply')[0]!;
    setAi(env, 'Emma', { delaySeconds: 30 });
    const after = env.ctx.tasks.get(before.id)!;
    expect(after.run_at).toBe(before.createdAt + 30_000);
  });
});
