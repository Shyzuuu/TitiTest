import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppContext } from '../../context.js';
import { badRequest } from '../../lib/errors.js';
import { authenticate, SESSION_COOKIE, tokenFromCookieHeader, userId } from '../../http/middleware.js';
import { toPublicUser } from './auth.service.js';

const loginSchema = z.object({ username: z.string().min(1).max(40), password: z.string().min(1).max(200) }).strict();
const profileSchema = z
  .object({ displayName: z.string().trim().min(1).max(60), bio: z.string().trim().max(500) })
  .partial()
  .strict();
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200) }).strict();

export function authRoutes(ctx: AppContext): Router {
  const r = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: ctx.config.env === 'test' ? 1000 : 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: { code: 'rate_limited', message: 'Trop de tentatives de connexion. Réessayez plus tard.' } },
  });

  // Durée relative (maxAge) : l'expiration effective reste contrôlée côté serveur par la session.
  const setCookie = (res: Response, token: string) =>
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: ctx.config.auth.cookieSecure,
      maxAge: ctx.config.auth.sessionTtlMs,
      path: '/',
    });

  r.post('/auth/login', loginLimiter, (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Identifiants manquants.');
    const { token, user } = ctx.auth.login(parsed.data.username, parsed.data.password);
    setCookie(res, token);
    ctx.logger.info('auth', `Connexion de ${user.username}`);
    res.json({ user: toPublicUser(user) });
  });

  r.post('/auth/logout', (req, res) => {
    const token = tokenFromCookieHeader(req.headers.cookie);
    if (token) ctx.auth.logout(token);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  r.get('/auth/me', authenticate(ctx), (req, res) => {
    res.json({ user: toPublicUser(req.user!) });
  });

  r.patch('/me', authenticate(ctx), (req, res) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Profil invalide.', parsed.error.flatten());
    res.json({ user: toPublicUser(ctx.auth.updateProfile(userId(req), parsed.data)) });
  });

  r.post('/me/password', authenticate(ctx), loginLimiter, (req, res) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Le nouveau mot de passe doit contenir au moins 8 caractères.');
    ctx.auth.changePassword(userId(req), parsed.data.currentPassword, parsed.data.newPassword);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  return r;
}
