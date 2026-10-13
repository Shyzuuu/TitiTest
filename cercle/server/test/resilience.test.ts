import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import supertest from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createAppServer } from '../src/app.js';
import { createContext, disposeContext } from '../src/bootstrap.js';
import type { AppContext } from '../src/context.js';
import { ManualClock } from '../src/lib/clock.js';
import { seededRandom } from '../src/lib/random.js';
import { AiProviderError } from '../src/modules/ai/types.js';
import { ControlledProvider, createTestEnv, history, incoming, pendingTasks, quietAll, send, setAi, testConfig, type TestEnv } from './helpers.js';

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

function tempDbFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cercle-test-'));
  cleanups.push(() => fs.rmSync(dir, { recursive: true, force: true }));
  return path.join(dir, 'cercle.db');
}

function boot(file: string, clock: ManualClock, provider: ControlledProvider | null = null): AppContext {
  return createContext({
    config: testConfig({ databaseFile: file }),
    clock,
    rng: seededRandom(7),
    silentLogs: true,
    anthropicProvider: provider,
  });
}

describe('Test 10 — redémarrage', () => {
  it('une tâche IA en attente est récupérée après redémarrage et exécutée une seule fois', async () => {
    const file = tempDbFile();
    const clock = new ManualClock();
    let ctx = boot(file, clock);
    const userId = ctx.auth.primaryUser().id;
    const emmaId = ctx.characters.list(userId).find((c) => c.firstName === 'Emma')!.id;
    for (const c of ctx.characters.list(userId)) ctx.characters.update(userId, c.id, { automation: { incomingEnabled: false, replyEnabled: false } });
    ctx.characters.update(userId, emmaId, { ai: { mode: 'auto', delaySeconds: 120 } });
    ctx.automation.triggerIncomingNow(userId, emmaId);
    await ctx.scheduler.runUntilIdle();
    expect(ctx.tasks.list({ status: 'pending', type: 'ai_reply' })).toHaveLength(1);
    await disposeContext(ctx); // arrêt du serveur

    clock.advance(10 * 60_000); // le serveur était éteint au moment de l'échéance
    ctx = boot(file, clock);
    cleanups.push(() => disposeContext(ctx));
    ctx.scheduler.start();
    await ctx.scheduler.runUntilIdle();
    const convId = ctx.conversations.idForCharacter(userId, emmaId)!;
    const msgs = ctx.messages.list(userId, convId, {}).messages;
    expect(msgs.filter((m) => m.origin === 'ai_auto')).toHaveLength(1);
    await ctx.scheduler.runUntilIdle();
    expect(ctx.messages.list(userId, convId, {}).messages.filter((m) => m.origin === 'ai_auto')).toHaveLength(1);
  });

  it('une tâche interrompue en pleine exécution (crash) est réconciliée sans doublon', async () => {
    const file = tempDbFile();
    const clock = new ManualClock();
    let ctx = boot(file, clock);
    const userId = ctx.auth.primaryUser().id;
    const emmaId = ctx.characters.list(userId).find((c) => c.firstName === 'Emma')!.id;
    for (const c of ctx.characters.list(userId)) ctx.characters.update(userId, c.id, { automation: { incomingEnabled: false, replyEnabled: false } });
    ctx.characters.update(userId, emmaId, { ai: { mode: 'auto', delaySeconds: 60 } });
    ctx.automation.triggerIncomingNow(userId, emmaId);
    await ctx.scheduler.runUntilIdle();
    const task = ctx.tasks.list({ status: 'pending', type: 'ai_reply' })[0]!;
    const convId = task.conversationId!;
    // Simulation du crash : la tâche est réservée et son message écrit, mais la clôture n'a jamais eu lieu.
    clock.advance(60_000);
    const [claimed] = ctx.tasks.claimDue(clock.now(), 1, 300_000);
    expect(claimed!.id).toBe(task.id);
    ctx.db.transaction(() =>
      ctx.messages.insertAiAuto(userId, ctx.conversations.getRow(convId)!, 'écrit avant le crash', `task:${task.id}`),
    );
    ctx.db.close(); // arrêt brutal, sans drain

    ctx = boot(file, clock);
    cleanups.push(() => disposeContext(ctx));
    ctx.scheduler.start(); // réconciliation des tâches « running » orphelines
    await ctx.scheduler.runUntilIdle();
    const aiMsgs = ctx.messages.list(userId, convId, {}).messages.filter((m) => m.origin === 'ai_auto');
    expect(aiMsgs).toHaveLength(1);
    expect(aiMsgs[0]!.content).toBe('écrit avant le crash');
    expect(['superseded', 'done']).toContain(ctx.tasks.get(task.id)!.status);
  });
});

describe('Test 13 — fournisseur IA indisponible', () => {
  let env: TestEnv;
  afterEach(async () => env?.close());

  it('le site reste utilisable, les messages sont conservés et l’erreur est notifiée', async () => {
    const provider = new ControlledProvider();
    provider.mode = 'fail';
    provider.failure = new AiProviderError('Fournisseur IA indisponible.', true, 'unavailable');
    env = await createTestEnv({ anthropicProvider: provider });
    quietAll(env);
    env.ctx.settings.update(env.userId, { aiFallbackToLocal: false });
    setAi(env, 'Emma', { mode: 'auto', delaySeconds: 10 });
    const emma = env.convOf('Emma');
    const conv = env.ctx.conversations.getRow(emma)!;
    env.ctx.db.transaction(() => env.ctx.messages.insertFromCharacter(env.userId, conv, 'Tu es là ?', 'simulation', 'down-1'));
    for (let i = 0; i < 6; i++) {
      env.clock.advance(60_000);
      await env.ctx.scheduler.runUntilIdle();
    }
    const failed = env.ctx.tasks.list({ status: 'failed', type: 'ai_reply' });
    expect(failed).toHaveLength(1);
    expect(failed[0]!.attempts).toBe(3);
    const notifs = (await env.agent.get('/api/notifications').expect(200)).body.items as Array<{ type: string; conversationId: string }>;
    expect(notifs.some((n) => n.type === 'ai_error' && n.conversationId === emma)).toBe(true);
    // Envoi manuel toujours possible, historique intact.
    await send(env, emma, 'Je réponds moi-même').expect(201);
    expect((await history(env, emma)).map((m) => m.content)).toEqual(['Tu es là ?', 'Je réponds moi-même']);
    // L'état du fournisseur n'est jamais présenté comme « ok » après une panne.
    const status = (await env.agent.post('/api/admin/ai/test').expect(200)).body.status;
    expect(status.state).toBe('error');
    expect((await env.agent.get('/api/settings').expect(200)).body.aiStatus.state).toBe('error');
  });

  it('les personnages basculent sur la simulation locale quand le repli est autorisé', async () => {
    const provider = new ControlledProvider();
    provider.mode = 'fail';
    provider.failure = new AiProviderError('Délai dépassé', true, 'timeout');
    env = await createTestEnv({ anthropicProvider: provider });
    quietAll(env);
    await incoming(env, 'Lucas');
    const h = await history(env, env.convOf('Lucas'));
    expect(h).toHaveLength(1);
    expect(h[0]!.authorType).toBe('character');
  });

  it('l’état « non vérifié » est affiché tant qu’aucun test n’a abouti', async () => {
    env = await createTestEnv({ anthropicProvider: new ControlledProvider() });
    const s = (await env.agent.get('/api/settings').expect(200)).body.aiStatus;
    expect(s).toMatchObject({ provider: 'anthropic', state: 'unverified' });
    const tested = (await env.agent.post('/api/admin/ai/test').expect(200)).body.status;
    expect(tested.state).toBe('ok');
  });

  it('respecte le plafond quotidien d’appels IA', async () => {
    const provider = new ControlledProvider();
    env = await createTestEnv({ anthropicProvider: provider });
    quietAll(env);
    env.ctx.settings.update(env.userId, { aiDailyCallLimit: 1, aiFallbackToLocal: true });
    await incoming(env, 'Emma');
    await incoming(env, 'Sarah');
    expect(provider.calls).toHaveLength(1);
    expect(await history(env, env.convOf('Sarah'))).toHaveLength(1); // servi par la simulation locale
  });
});

describe('Test 14 — persistance', () => {
  it('conversations, brouillons, paramètres et boîte mail survivent à une fermeture/réouverture', async () => {
    const file = tempDbFile();
    const clock = new ManualClock();
    const ctx1 = boot(file, clock);
    const app1 = createAppServer(ctx1);
    const agent1 = supertest.agent(app1.app).set('X-Requested-With', 'cercle');
    await agent1.post('/api/auth/login').send({ username: 'moi', password: 'secret-test' }).expect(200);
    const userId = ctx1.auth.primaryUser().id;
    const emmaId = ctx1.characters.list(userId).find((c) => c.firstName === 'Emma')!.id;
    const lucasId = ctx1.characters.list(userId).find((c) => c.firstName === 'Lucas')!.id;
    const emma = ctx1.conversations.idForCharacter(userId, emmaId)!;
    const lucas = ctx1.conversations.idForCharacter(userId, lucasId)!;
    await agent1.post(`/api/conversations/${emma}/messages`).send({ content: 'Message persistant', clientId: 'persist-0001' }).expect(201);
    await agent1.put(`/api/conversations/${lucas}/draft`).send({ content: 'Brouillon pour Lucas' }).expect(200);
    await agent1.patch('/api/settings').send({ simulationSpeed: 'demo' }).expect(200);
    await agent1.patch(`/api/characters/${emmaId}`).send({ ai: { mode: 'suggest', delaySeconds: 90 } }).expect(200);
    await app1.close();
    await disposeContext(ctx1);

    const ctx2 = boot(file, clock);
    const app2 = createAppServer(ctx2);
    cleanups.push(async () => {
      await app2.close();
      await disposeContext(ctx2);
    });
    const agent2 = supertest.agent(app2.app).set('X-Requested-With', 'cercle');
    await agent2.post('/api/auth/login').send({ username: 'moi', password: 'secret-test' }).expect(200);
    const boot2 = (await agent2.get('/api/bootstrap').expect(200)).body;
    expect(boot2.settings.simulationSpeed).toBe('demo');
    expect(boot2.drafts).toEqual([expect.objectContaining({ conversationId: lucas, content: 'Brouillon pour Lucas' })]);
    expect(boot2.characters.find((c: { id: string }) => c.id === emmaId).ai).toMatchObject({ mode: 'suggest', delaySeconds: 90 });
    const msgs = (await agent2.get(`/api/conversations/${emma}/messages`).expect(200)).body.messages;
    expect(msgs.map((m: { content: string }) => m.content)).toEqual(['Message persistant']);
    expect((await agent2.get('/api/mailbox?view=sent').expect(200)).body.items).toHaveLength(1);
  });
});

describe('Test 5 — brouillons indépendants (côté serveur)', () => {
  let env: TestEnv;
  afterEach(async () => env?.close());

  it('chaque conversation garde son propre brouillon, y compris la citation en cours', async () => {
    env = await createTestEnv();
    quietAll(env);
    const emma = env.convOf('Emma');
    const lucas = env.convOf('Lucas');
    const quoted = (await send(env, emma, 'Je pense jouer ce soir.').expect(201)).body.message;
    await env.agent.put(`/api/conversations/${emma}/draft`).send({ content: 'Je voulais justement te demander si...', replyToMessageId: quoted.id }).expect(200);
    await env.agent.put(`/api/conversations/${lucas}/draft`).send({ content: 'Tu as vu le nouveau jeu ?' }).expect(200);
    const drafts = (await env.agent.get('/api/drafts').expect(200)).body.drafts as Array<{ conversationId: string; content: string; replyToMessageId: string | null }>;
    expect(drafts.find((d) => d.conversationId === emma)).toMatchObject({ content: 'Je voulais justement te demander si...', replyToMessageId: quoted.id });
    expect(drafts.find((d) => d.conversationId === lucas)).toMatchObject({ content: 'Tu as vu le nouveau jeu ?', replyToMessageId: null });
    // Une sauvegarde plus ancienne (arrivée en retard) n'écrase pas la plus récente.
    await env.agent.put(`/api/conversations/${lucas}/draft`).send({ content: 'nouveau', clientUpdatedAt: 2_000_000_000_000 }).expect(200);
    await env.agent.put(`/api/conversations/${lucas}/draft`).send({ content: 'ancien', clientUpdatedAt: 1_000_000_000_000 }).expect(200);
    const after = (await env.agent.get('/api/drafts').expect(200)).body.drafts as Array<{ conversationId: string; content: string }>;
    expect(after.find((d) => d.conversationId === lucas)!.content).toBe('nouveau');
    // Envoyer le contenu du brouillon le supprime ; l'autre conversation est intacte.
    await send(env, emma, 'Je voulais justement te demander si...').expect(201);
    const final = (await env.agent.get('/api/drafts').expect(200)).body.drafts as Array<{ conversationId: string }>;
    expect(final.map((d) => d.conversationId)).toEqual([lucas]);
    expect(pendingTasks(env)).toHaveLength(0);
  });
});
