import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { param, requireConfirmation, userId } from '../../http/middleware.js';

export function memoryRoutes(ctx: AppContext): Router {
  const r = Router();
  r.get('/characters/:id/memories', (req, res) => {
    res.json({ memories: ctx.memory.list(userId(req), param(req, 'id')) });
  });
  r.post('/characters/:id/memories', (req, res) => {
    res.status(201).json({ memory: ctx.memory.create(userId(req), param(req, 'id'), req.body) });
  });
  r.delete('/characters/:id/memories', requireConfirmation('RESET_MEMORY'), (req, res) => {
    res.json({ deleted: ctx.memory.reset(userId(req), param(req, 'id')) });
  });
  r.patch('/memories/:id', (req, res) => {
    res.json({ memory: ctx.memory.update(userId(req), param(req, 'id'), req.body) });
  });
  r.delete('/memories/:id', (req, res) => {
    ctx.memory.remove(userId(req), param(req, 'id'));
    res.json({ ok: true });
  });
  return r;
}
