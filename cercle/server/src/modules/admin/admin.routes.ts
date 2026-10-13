import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { resetDemoData } from '../../db/seed.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { param, requireAdmin, requireConfirmation, userId } from '../../http/middleware.js';
import { toTaskDto } from '../scheduler/tasks.repository.js';

const startedAt = Date.now();

const tasksQuery = z.object({
  status: z.enum(['pending', 'running', 'done', 'cancelled', 'superseded', 'failed']).optional(),
  type: z.enum(['character_reply', 'character_initiate', 'character_part', 'ai_reply']).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});
const logsQuery = z.object({
  level: z.enum(['info', 'warn', 'error']).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(200),
});

export function adminRoutes(ctx: AppContext, getRealtimeClients: () => number): Router {
  const r = Router();
  r.use('/admin', requireAdmin);

  /** État réel des services : rien n'est affiché comme « connecté » sans vérification. */
  r.get('/admin/status', (_req, res) => {
    let dbOk = false;
    try {
      dbOk = ctx.db.get<{ ok: number }>('SELECT 1 AS ok')?.ok === 1;
    } catch {
      dbOk = false;
    }
    const lastErrors = ctx.db.all('SELECT * FROM logs WHERE level = $l ORDER BY id DESC LIMIT 10', { l: 'error' });
    res.json({
      server: { uptimeMs: Date.now() - startedAt, env: ctx.config.env, node: process.version, time: ctx.clock.now() },
      database: { ok: dbOk, file: ctx.config.databaseFile === ':memory:' ? ':memory:' : 'sqlite' },
      scheduler: ctx.scheduler.status(),
      tasks: ctx.tasks.counts(),
      realtime: { clients: getRealtimeClients() },
      ai: { status: ctx.settings.getAiStatus(), providers: ctx.ai.providers(), usage: ctx.ai.usageToday() },
      settings: ctx.settings.get(),
      recentErrors: lastErrors,
    });
  });

  r.get('/admin/tasks', (req, res) => {
    const q = tasksQuery.safeParse(req.query);
    if (!q.success) throw badRequest('Filtre invalide.');
    res.json({ tasks: ctx.tasks.list(q.data) });
  });

  r.post('/admin/tasks/:id/cancel', (req, res) => {
    const task = ctx.tasks.get(param(req, 'id'));
    if (!task || task.user_id !== userId(req)) throw notFound('Tâche introuvable.');
    if (task.status !== 'pending') throw conflict('Seule une tâche en attente peut être annulée.');
    ctx.db.transaction(() => {
      ctx.db.run(
        `UPDATE scheduled_tasks SET status = 'cancelled', result_json = $r, updated_at = $now WHERE id = $id AND status = 'pending'`,
        { id: task.id, r: JSON.stringify({ reason: 'admin' }), now: ctx.clock.now() },
      );
      if (task.conversation_id) ctx.conversations.publishSummary(task.user_id, task.conversation_id);
    });
    if (task.type === 'character_initiate' && task.character_id) {
      ctx.automation.scheduleNextInitiation(task.user_id, task.character_id);
    }
    res.json({ task: toTaskDto(ctx.tasks.get(task.id)!) });
  });

  r.post('/admin/tasks/:id/run-now', (req, res) => {
    const task = ctx.tasks.get(param(req, 'id'));
    if (!task || task.user_id !== userId(req)) throw notFound('Tâche introuvable.');
    if (task.status !== 'pending') throw conflict('Seule une tâche en attente peut être avancée.');
    ctx.tasks.reschedule(task.id, ctx.clock.now());
    void ctx.scheduler.tick();
    res.json({ task: toTaskDto(ctx.tasks.get(task.id)!) });
  });

  r.get('/admin/logs', (req, res) => {
    const q = logsQuery.safeParse(req.query);
    if (!q.success) throw badRequest('Filtre invalide.');
    const rows = ctx.db.all(
      `SELECT id, level, scope, message, data_json AS data, created_at AS createdAt FROM logs
       WHERE ($level IS NULL OR level = $level) ORDER BY id DESC LIMIT $l`,
      { level: q.data.level ?? null, l: q.data.limit },
    );
    res.json({ logs: rows });
  });

  r.post('/admin/automation', (req, res) => {
    const body = z.object({ paused: z.boolean() }).strict().safeParse(req.body);
    if (!body.success) throw badRequest('Paramètre paused attendu.');
    const settings = ctx.settings.update(userId(req), { automationPaused: body.data.paused });
    ctx.logger.info('admin', body.data.paused ? 'Automatisations suspendues' : 'Automatisations reprises');
    res.json({ settings });
  });

  r.post('/admin/ai/test', async (_req, res) => {
    res.json({ status: await ctx.ai.test() });
  });

  r.post('/admin/simulate/incoming', async (req, res) => {
    const body = z.object({ characterId: z.string().min(1).max(64) }).strict().safeParse(req.body);
    if (!body.success) throw badRequest('characterId attendu.');
    const task = ctx.automation.triggerIncomingNow(userId(req), body.data.characterId);
    await ctx.scheduler.tick();
    res.json({ task: toTaskDto(ctx.tasks.get(task.id)!) });
  });

  r.get('/admin/export', (req, res) => {
    const uid = userId(req);
    const q = (sql: string) => ctx.db.all(sql, { u: uid });
    const data = {
      exportedAt: new Date(ctx.clock.now()).toISOString(),
      format: 'cercle-export-v1',
      user: ctx.db.get('SELECT id, username, display_name, bio, created_at FROM users WHERE id = $u', { u: uid }),
      settings: ctx.settings.get(),
      characters: q('SELECT * FROM characters WHERE user_id = $u'),
      conversations: q('SELECT * FROM conversations WHERE user_id = $u'),
      messages: q('SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = $u ORDER BY m.conversation_id, m.seq'),
      mailbox: q('SELECT * FROM mailbox_entries WHERE user_id = $u'),
      memories: q('SELECT m.* FROM character_memories m JOIN characters c ON c.id = m.character_id WHERE c.user_id = $u'),
      notifications: q('SELECT * FROM notifications WHERE user_id = $u'),
      drafts: q('SELECT d.* FROM drafts d JOIN conversations c ON c.id = d.conversation_id WHERE c.user_id = $u'),
      tasks: q('SELECT * FROM scheduled_tasks WHERE user_id = $u'),
    };
    res.setHeader('Content-Disposition', `attachment; filename="cercle-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json(data);
  });

  r.post('/admin/reset', requireConfirmation('RESET_DEMO'), (req, res) => {
    const created = resetDemoData(ctx, userId(req));
    ctx.logger.warn('admin', 'Données de démonstration réinitialisées');
    res.json({ ok: true, characters: created });
  });

  return r;
}
