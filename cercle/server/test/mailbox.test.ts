import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestEnv, history, incoming, quietAll, send, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeEach(async () => {
  env = await createTestEnv();
  quietAll(env);
});
afterEach(async () => env.close());

interface Entry {
  id: string;
  messageId: string;
  conversationId: string;
  characterId: string;
  read: boolean;
  folder: string;
  direction: string;
  content: string;
}

const list = async (view: string, extra = '') =>
  (await env.agent.get(`/api/mailbox?view=${view}${extra}`).expect(200)).body as { items: Entry[]; counts: Record<string, number> };

describe('Test 9 — boîte mail', () => {
  it('un message entrant apparaît une seule fois, cohérent avec la conversation', async () => {
    await incoming(env, 'Emma');
    const [msg] = await history(env, env.convOf('Emma'));
    const inbox = await list('inbox');
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]).toMatchObject({
      messageId: msg!.id,
      conversationId: env.convOf('Emma'),
      characterId: env.charOf('Emma'),
      content: msg!.content,
      read: false,
      direction: 'in',
    });
    // Insertion répétée du même message : la contrainte d'unicité empêche le doublon.
    const conv = env.ctx.conversations.getRow(env.convOf('Emma'))!;
    env.ctx.mailbox.recordMessage(env.userId, conv, env.ctx.messages.getRow(msg!.id)!);
    expect((await list('inbox')).items).toHaveLength(1);
  });

  it('les changements de lecture persistent et sont partagés avec la conversation', async () => {
    await incoming(env, 'Emma');
    const entry = (await list('unread')).items[0]!;
    await env.agent.post(`/api/mailbox/${entry.id}/actions`).send({ action: 'mark_read' }).expect(200);
    expect((await list('unread')).items).toHaveLength(0);
    expect((await list('read')).items).toHaveLength(1);
    const summary = (await env.agent.get(`/api/conversations/${env.convOf('Emma')}`).expect(200)).body.conversation;
    expect(summary.unreadCount).toBe(0);
    await env.agent.post(`/api/mailbox/${entry.id}/actions`).send({ action: 'mark_unread' }).expect(200);
    expect((await env.agent.get(`/api/conversations/${env.convOf('Emma')}`).expect(200)).body.conversation.unreadCount).toBe(1);
    // Lire la conversation met à jour la boîte mail.
    await env.agent.post(`/api/conversations/${env.convOf('Emma')}/read`).send({}).expect(200);
    expect((await env.agent.get(`/api/mailbox/${entry.id}`).expect(200)).body.entry.read).toBe(true);
  });

  it('archiver retire de la boîte de réception mais garde l’élément dans les archives', async () => {
    await incoming(env, 'Emma');
    const entry = (await list('inbox')).items[0]!;
    await env.agent.post(`/api/mailbox/${entry.id}/actions`).send({ action: 'archive' }).expect(200);
    expect((await list('inbox')).items).toHaveLength(0);
    expect((await list('archive')).items.map((e) => e.id)).toEqual([entry.id]);
    await env.agent.post(`/api/mailbox/${entry.id}/actions`).send({ action: 'unarchive' }).expect(200);
    expect((await list('inbox')).items).toHaveLength(1);
  });

  it('supprimer de la boîte mail ne supprime pas le message de la conversation', async () => {
    await incoming(env, 'Emma');
    const entry = (await list('inbox')).items[0]!;
    await env.agent.delete(`/api/mailbox/${entry.id}`).expect(409); // corbeille d'abord
    await env.agent.post(`/api/mailbox/${entry.id}/actions`).send({ action: 'trash' }).expect(200);
    expect((await list('trash')).items).toHaveLength(1);
    await env.agent.delete(`/api/mailbox/${entry.id}`).expect(200);
    expect((await list('trash')).items).toHaveLength(0);
    const h = await history(env, env.convOf('Emma'));
    expect(h).toHaveLength(1);
    expect(h[0]!.id).toBe(entry.messageId);
  });

  it('les messages envoyés apparaissent dans « Envoyés »', async () => {
    await send(env, env.convOf('Lucas'), 'Message envoyé à Lucas').expect(201);
    const sent = await list('sent');
    expect(sent.items).toHaveLength(1);
    expect(sent.items[0]).toMatchObject({ direction: 'out', read: true, characterId: env.charOf('Lucas') });
  });

  it('recherche par contenu, par expéditeur et par date', async () => {
    const conv = (n: string) => env.ctx.conversations.getRow(env.convOf(n))!;
    env.ctx.db.transaction(() => env.ctx.messages.insertFromCharacter(env.userId, conv('Emma'), 'On va au cinéma samedi ?', 'simulation', 'srch-1'));
    env.clock.advance(3600_000);
    const cut = env.clock.now();
    env.ctx.db.transaction(() => env.ctx.messages.insertFromCharacter(env.userId, conv('Lucas'), 'Partie de foot ce soir', 'simulation', 'srch-2'));
    expect((await list('inbox', '&q=cinema')).items.map((e) => e.content)).toEqual(['On va au cinéma samedi ?']);
    expect((await list('inbox', '&q=Lucas')).items.map((e) => e.characterId)).toEqual([env.charOf('Lucas')]);
    expect((await list('inbox', `&characterId=${env.charOf('Emma')}`)).items).toHaveLength(1);
    expect((await list('inbox', `&from=${cut}`)).items.map((e) => e.content)).toEqual(['Partie de foot ce soir']);
  });
});
