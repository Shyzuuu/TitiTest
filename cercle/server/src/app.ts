import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { Server as SocketServer } from 'socket.io';
import type { AppContext } from './context.js';
import { notFound } from './lib/errors.js';
import { authenticate, csrfGuard, errorHandler, tokenFromCookieHeader } from './http/middleware.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { characterRoutes } from './modules/characters/characters.routes.js';
import { conversationRoutes } from './modules/conversations/conversations.routes.js';
import { eventRoutes } from './modules/events/events.routes.js';
import { mailboxRoutes } from './modules/mailbox/mailbox.routes.js';
import { memoryRoutes } from './modules/memory/memory.routes.js';
import { notificationRoutes } from './modules/notifications/notifications.routes.js';
import { settingsRoutes } from './modules/settings/settings.routes.js';

export interface AppServer {
  app: express.Express;
  server: http.Server;
  io: SocketServer;
  close(): Promise<void>;
}

export function createAppServer(ctx: AppContext): AppServer {
  const app = express();
  const server = http.createServer(app);
  const io = new SocketServer(server, {
    path: '/socket.io',
    cors: ctx.config.corsOrigin ? { origin: ctx.config.corsOrigin, credentials: true } : undefined,
    serveClient: false,
  });

  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: '300kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: ctx.clock.now() });
  });

  const api = Router();
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: ctx.config.rateLimitPerMinute,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'rate_limited', message: 'Trop de requêtes, ralentissez.' } },
    }),
  );
  api.use(csrfGuard);
  api.use(authRoutes(ctx));
  const protectedApi = Router();
  protectedApi.use(authenticate(ctx));
  protectedApi.use(eventRoutes(ctx));
  protectedApi.use(characterRoutes(ctx));
  protectedApi.use(conversationRoutes(ctx));
  protectedApi.use(mailboxRoutes(ctx));
  protectedApi.use(notificationRoutes(ctx));
  protectedApi.use(memoryRoutes(ctx));
  protectedApi.use(settingsRoutes(ctx));
  protectedApi.use(adminRoutes(ctx, () => io.engine.clientsCount));
  api.use(protectedApi);
  api.use(() => {
    throw notFound('Route API inconnue.');
  });
  app.use('/api', api);

  if (ctx.config.serveClient) {
    const dist = ctx.config.clientDist;
    const indexFile = path.join(dist, 'index.html');
    if (fs.existsSync(indexFile)) {
      app.use(express.static(dist, { index: false, maxAge: '1h' }));
      app.get(/^(?!\/api\/|\/socket\.io\/).*/, (_req, res) => res.sendFile(indexFile));
    } else {
      ctx.logger.warn('http', `Client non construit (${indexFile} absent) : lancez « npm run build ».`);
    }
  }
  app.use(errorHandler(ctx));

  // Temps réel : chaque socket authentifié rejoint la salle de son utilisateur.
  io.use((socket, next) => {
    const user = ctx.auth.authenticate(tokenFromCookieHeader(socket.handshake.headers.cookie));
    if (!user) return next(new Error('unauthorized'));
    socket.data.userId = user.id;
    next();
  });
  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId as string}`);
  });
  const unsubscribe = ctx.bus.subscribe((userId, event) => {
    io.to(`user:${userId}`).emit('event', event);
  });

  return {
    app,
    server,
    io,
    async close() {
      unsubscribe();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
