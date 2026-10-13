import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

const boolFromEnv = z
  .enum(['true', 'false', '1', '0', 'yes', 'no', ''])
  .optional()
  .transform((v) => (v === undefined || v === '' ? undefined : ['true', '1', 'yes'].includes(v)));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().optional(),
  DATABASE_FILE: z.string().default('data/cercle.db'),
  APP_USERNAME: z.string().min(1).max(40).default('moi'),
  APP_PASSWORD: z.string().min(4).max(200).optional(),
  APP_DISPLAY_NAME: z.string().min(1).max(60).default('Moi'),
  COOKIE_SECURE: boolFromEnv,
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  CORS_ORIGIN: z.string().optional(),
  /** Nombre de proxys de confiance devant le serveur (ex. 1 sur Render), ou « loopback ». */
  TRUST_PROXY: z.string().optional(),
  SERVE_CLIENT: boolFromEnv,
  CLIENT_DIST: z.string().default('../client/dist'),
  AI_PROVIDER: z.enum(['auto', 'anthropic', 'local']).default('auto'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().min(1).default('claude-opus-5-5'),
  AI_EFFORT: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).default('low'),
  AI_MAX_TOKENS: z.coerce.number().int().min(256).max(16000).default(2000),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  AI_SERVER_FALLBACKS: boolFromEnv,
  SIMULATION_SPEED: z.enum(['demo', 'normal']).default('normal'),
  SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(100).max(60000).default(1000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(10).max(100000).default(600),
  SEED_ON_EMPTY: boolFromEnv,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

export interface AppConfig {
  env: Env['NODE_ENV'];
  port: number;
  host: string;
  databaseFile: string;
  auth: {
    username: string;
    password: string;
    passwordIsDefault: boolean;
    displayName: string;
    cookieSecure: boolean;
    sessionTtlMs: number;
  };
  corsOrigin?: string;
  trustProxy: number | string;
  serveClient: boolean;
  clientDist: string;
  ai: {
    provider: 'auto' | 'anthropic' | 'local';
    anthropicApiKey?: string;
    model: string;
    effort: Env['AI_EFFORT'];
    maxTokens: number;
    timeoutMs: number;
    serverFallbacks: boolean;
  };
  simulationSpeed: 'demo' | 'normal';
  schedulerIntervalMs: number;
  rateLimitPerMinute: number;
  seedOnEmpty: boolean;
  logLevel: Env['LOG_LEVEL'];
  /** Délai d'animation « en train d'écrire » ; 0 en test pour des exécutions déterministes. */
  typingDelayMs: { min: number; max: number };
}

export const DEFAULT_DEV_PASSWORD = 'cercle';

export function loadConfig(source: NodeJS.ProcessEnv = process.env, overrides: Partial<AppConfig> = {}): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuration invalide : ${issues}`);
  }
  const env = parsed.data;
  // Render définit RENDER=true : valeurs par défaut adaptées, sans configuration manuelle.
  const onPlatform = source.RENDER === 'true';
  const trustProxy = env.TRUST_PROXY;
  if (env.NODE_ENV === 'production' && !env.APP_PASSWORD) {
    throw new Error(
      'APP_PASSWORD est obligatoire en production : ajoutez la variable d’environnement APP_PASSWORD (votre mot de passe de connexion).',
    );
  }
  const databaseFile =
    env.DATABASE_FILE === ':memory:' || path.isAbsolute(env.DATABASE_FILE)
      ? env.DATABASE_FILE
      : path.resolve(SERVER_ROOT, env.DATABASE_FILE);
  const base: AppConfig = {
    env: env.NODE_ENV,
    port: env.PORT,
    // Hébergeur (Render…) ou production : écoute sur toutes les interfaces, sinon le port n'est pas détecté.
    host: env.HOST ?? (onPlatform || env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'),
    databaseFile,
    auth: {
      username: env.APP_USERNAME,
      password: env.APP_PASSWORD ?? DEFAULT_DEV_PASSWORD,
      passwordIsDefault: !env.APP_PASSWORD,
      displayName: env.APP_DISPLAY_NAME,
      cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
      sessionTtlMs: env.SESSION_TTL_DAYS * 24 * 3600 * 1000,
    },
    corsOrigin: env.CORS_ORIGIN,
    trustProxy: trustProxy === undefined ? (onPlatform ? 1 : 'loopback') : /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy,
    serveClient: env.SERVE_CLIENT ?? env.NODE_ENV === 'production',
    clientDist: path.resolve(SERVER_ROOT, env.CLIENT_DIST),
    ai: {
      provider: env.AI_PROVIDER,
      anthropicApiKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
      model: env.AI_MODEL,
      effort: env.AI_EFFORT,
      maxTokens: env.AI_MAX_TOKENS,
      timeoutMs: env.AI_TIMEOUT_MS,
      serverFallbacks: env.AI_SERVER_FALLBACKS ?? true,
    },
    simulationSpeed: env.SIMULATION_SPEED,
    schedulerIntervalMs: env.SCHEDULER_INTERVAL_MS,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    seedOnEmpty: env.SEED_ON_EMPTY ?? true,
    logLevel: env.LOG_LEVEL,
    typingDelayMs: env.NODE_ENV === 'test' ? { min: 0, max: 0 } : { min: 700, max: 2200 },
  };
  return { ...base, ...overrides, auth: { ...base.auth, ...overrides.auth }, ai: { ...base.ai, ...overrides.ai } };
}
