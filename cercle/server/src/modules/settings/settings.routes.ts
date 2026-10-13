import { Router } from 'express';
import type { AppContext } from '../../context.js';
import { requireAdmin, userId } from '../../http/middleware.js';

export function settingsRoutes(ctx: AppContext): Router {
  const r = Router();
  r.get('/settings', (_req, res) => {
    res.json({ settings: ctx.settings.get(), aiStatus: ctx.settings.getAiStatus(), providers: ctx.ai.providers() });
  });
  // Les paramètres globaux pilotent les automatisations : réservés à l'administrateur.
  r.patch('/settings', requireAdmin, (req, res) => {
    const settings = ctx.settings.update(userId(req), req.body);
    res.json({ settings, aiStatus: ctx.settings.getAiStatus(), providers: ctx.ai.providers() });
  });
  return r;
}
