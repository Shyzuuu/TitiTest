import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { param, requireConfirmation, userId } from '../../http/middleware.js';

export function characterRoutes(ctx: AppContext): Router {
  const r = Router();
  r.get('/characters', (req, res) => {
    res.json({ characters: ctx.characters.list(userId(req)) });
  });
  r.post('/characters', (req, res) => {
    const result = ctx.characters.create(userId(req), req.body);
    res.status(201).json(result);
  });
  r.get('/characters/:id', (req, res) => {
    res.json({ character: ctx.characters.get(userId(req), param(req, 'id')) });
  });
  r.patch('/characters/:id', (req, res) => {
    res.json({ character: ctx.characters.update(userId(req), param(req, 'id'), req.body) });
  });
  r.delete('/characters/:id', requireConfirmation('DELETE_CHARACTER'), (req, res) => {
    ctx.characters.remove(userId(req), param(req, 'id'));
    res.json({ ok: true });
  });
  return r;
}
