import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest } from '../../lib/errors.js';
import { param, userId } from '../../http/middleware.js';

const pageSchema = z.object({
  beforeSeq: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
const readSchema = z.object({ upToSeq: z.number().int().nonnegative().optional() }).strict();
const searchSchema = z.object({ q: z.string().trim().min(1).max(200), characterId: z.string().max(64).optional() });

export function conversationRoutes(ctx: AppContext): Router {
  const r = Router();

  r.get('/conversations', (req, res) => {
    res.json({ conversations: ctx.conversations.list(userId(req)) });
  });

  r.get('/conversations/:id', (req, res) => {
    const id = param(req, 'id');
    ctx.conversations.getOwned(userId(req), id);
    res.json({ conversation: ctx.conversations.summary(id) });
  });

  r.get('/conversations/:id/messages', (req, res) => {
    const q = pageSchema.safeParse(req.query);
    if (!q.success) throw badRequest('Pagination invalide.');
    res.json(ctx.messages.list(userId(req), param(req, 'id'), q.data));
  });

  r.post('/conversations/:id/messages', (req, res) => {
    const { message, created } = ctx.messages.sendFromUser(userId(req), param(req, 'id'), req.body);
    res.status(created ? 201 : 200).json({ message, created });
  });

  r.post('/conversations/:id/read', (req, res) => {
    const body = readSchema.safeParse(req.body ?? {});
    if (!body.success) throw badRequest('Requête invalide.');
    res.json(ctx.conversations.markRead(userId(req), param(req, 'id'), body.data.upToSeq));
  });

  r.delete('/messages/:id', (req, res) => {
    res.json({ message: ctx.messages.remove(userId(req), param(req, 'id')) });
  });

  r.get('/search', (req, res) => {
    const q = searchSchema.safeParse(req.query);
    if (!q.success) throw badRequest('Recherche invalide.');
    res.json({ results: ctx.messages.search(userId(req), q.data.q, q.data.characterId) });
  });

  r.get('/drafts', (req, res) => {
    res.json({ drafts: ctx.drafts.list(userId(req)) });
  });

  r.put('/conversations/:id/draft', (req, res) => {
    res.json({ draft: ctx.drafts.save(userId(req), param(req, 'id'), req.body) });
  });

  r.get('/suggestions', (req, res) => {
    res.json({ suggestions: ctx.suggestions.listPending(userId(req)) });
  });

  r.post('/suggestions/:id/send', (req, res) => {
    res.status(201).json({ message: ctx.suggestions.send(userId(req), param(req, 'id'), req.body) });
  });

  r.post('/suggestions/:id/discard', (req, res) => {
    ctx.suggestions.discard(userId(req), param(req, 'id'));
    res.json({ ok: true });
  });

  return r;
}
