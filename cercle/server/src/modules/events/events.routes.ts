import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest } from '../../lib/errors.js';
import { toPublicUser } from '../auth/auth.service.js';
import { userId } from '../../http/middleware.js';

const afterSchema = z.object({ after: z.coerce.number().int().nonnegative() });

export function eventRoutes(ctx: AppContext): Router {
  const r = Router();

  /** Rattrapage après reconnexion : événements manqués depuis `after`, ou `reset` si l'historique est purgé. */
  r.get('/events', (req, res) => {
    const q = afterSchema.safeParse(req.query);
    if (!q.success) throw badRequest('Paramètre after invalide.');
    res.json(ctx.bus.since(userId(req), q.data.after));
  });

  /** État complet de l'application en une requête (démarrage et resynchronisation). */
  r.get('/bootstrap', (req, res) => {
    const uid = userId(req);
    // Le numéro d'événement est lu en premier : tout événement ultérieur sera rejoué par le client.
    const lastEventSeq = ctx.bus.lastSeq(uid);
    res.json({
      me: toPublicUser(req.user!),
      lastEventSeq,
      settings: ctx.settings.get(),
      aiStatus: ctx.settings.getAiStatus(),
      providers: ctx.ai.providers(),
      characters: ctx.characters.list(uid),
      conversations: ctx.conversations.list(uid),
      drafts: ctx.drafts.list(uid),
      suggestions: ctx.suggestions.listPending(uid),
      notifications: ctx.notifications.list(uid, { limit: 50 }),
      mailboxCounts: ctx.mailbox.counts(uid),
      serverTime: ctx.clock.now(),
    });
  });
  return r;
}
