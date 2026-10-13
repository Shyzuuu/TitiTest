import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { param, userId } from '../../http/middleware.js';

export function mailboxRoutes(ctx: AppContext): Router {
  const r = Router();
  r.get('/mailbox', (req, res) => {
    res.json(ctx.mailbox.list(userId(req), req.query));
  });
  r.get('/mailbox/counts', (req, res) => {
    res.json({ counts: ctx.mailbox.counts(userId(req)) });
  });
  r.post('/mailbox/read-all', (req, res) => {
    res.json({ updated: ctx.mailbox.markAllRead(userId(req)) });
  });
  r.get('/mailbox/:id', (req, res) => {
    res.json({ entry: ctx.mailbox.get(userId(req), param(req, 'id')) });
  });
  r.post('/mailbox/:id/actions', (req, res) => {
    res.json({ entry: ctx.mailbox.apply(userId(req), param(req, 'id'), req.body) });
  });
  r.delete('/mailbox/:id', (req, res) => {
    ctx.mailbox.purge(userId(req), param(req, 'id'));
    res.json({ ok: true });
  });
  return r;
}
