import type { NextFunction, Request, Response } from 'express';
import { parse as parseCookie } from 'cookie';
import { ZodError } from 'zod';
import type { AppContext } from '../context.js';
import type { UserRow } from '../domain.js';
import { forbidden, HttpError, unauthorized } from '../lib/errors.js';

export const SESSION_COOKIE = 'cercle_session';
/** En-tête exigé sur toute requête modifiante : un formulaire tiers ne peut pas l'ajouter sans pré-vol CORS. */
export const CSRF_HEADER = 'x-requested-with';
export const CSRF_VALUE = 'cercle';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserRow;
  }
}

export function tokenFromCookieHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  return parseCookie(header)[SESSION_COOKIE];
}

export function authenticate(ctx: AppContext) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = ctx.auth.authenticate(tokenFromCookieHeader(req.headers.cookie));
    if (!user) return next(unauthorized());
    req.user = user;
    next();
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || req.user.is_admin !== 1) return next(forbidden('Réservé à l’administrateur.'));
  next();
}

/** Les opérations irréversibles exigent une confirmation explicite nommant l'action. */
export function requireConfirmation(action: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.headers['x-confirm'] !== action) {
      return next(new HttpError(428, 'confirmation_required', `Confirmation requise : en-tête X-Confirm: ${action}.`));
    }
    next();
  };
}

export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.headers[CSRF_HEADER] !== CSRF_VALUE) return next(forbidden('En-tête anti-CSRF manquant.'));
  next();
}

export function userId(req: Request): string {
  if (!req.user) throw unauthorized();
  return req.user.id;
}

export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== 'string' || v.length === 0 || v.length > 80) throw new HttpError(400, 'bad_request', `Paramètre ${name} invalide.`);
  return v;
}

export function errorHandler(ctx: AppContext) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      return res.status(400).json({ error: { code: 'bad_request', message: 'Requête invalide.', details: err.flatten() } });
    }
    const status = (err as { status?: number; statusCode?: number })?.status ?? (err as { statusCode?: number })?.statusCode;
    if (status === 413) return res.status(413).json({ error: { code: 'payload_too_large', message: 'Requête trop volumineuse.' } });
    if (err instanceof SyntaxError && status === 400) {
      return res.status(400).json({ error: { code: 'bad_json', message: 'JSON invalide.' } });
    }
    ctx.logger.error('http', `Erreur interne sur ${req.method} ${req.path}`, err);
    // Jamais de détail interne vers le client.
    res.status(500).json({ error: { code: 'internal', message: 'Erreur interne du serveur.' } });
  };
}
