import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { param, userId } from '../../http/middleware.js';

export function notificationRoutes(ctx: AppContext): Router {
  const r = Router();
  r.get('/notifications', (req, res) => {
    res.json(ctx.notifications.list(userId(req), { unreadOnly: req.query.unread === '1' }));
  });
  r.post('/notifications/read-all', (req, res) => {
    ctx.notifications.markAllRead(userId(req));
    res.json({ ok: true });
  });
  r.post('/notifications/:id/read', (req, res) => {
    ctx.notifications.markRead(userId(req), param(req, 'id'));
    res.json({ ok: true });
  });
  r.delete('/notifications/:id', (req, res) => {
    ctx.notifications.remove(userId(req), param(req, 'id'));
    res.json({ ok: true });
  });
  return r;
}
