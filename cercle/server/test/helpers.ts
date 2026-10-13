import supertest from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createAppServer, type AppServer } from '../src/app.js';
import { createContext, disposeContext } from '../src/bootstrap.js';
import { loadConfig, type AppConfig } from '../src/config.js';
import type { AppContext } from '../src/context.js';
import { ManualClock } from '../src/lib/clock.js';
import { seededRandom } from '../src/lib/random.js';
import type { RealtimeEvent } from '../src/realtime/eventBus.js';
import type { AiProvider, GenerationContext, GenerationResult } from '../src/modules/ai/types.js';

export interface TestEnv {
  ctx: AppContext;
  clock: ManualClock;
  app: AppServer;
  agent: TestAgent;
  userId: string;
  events: Array<RealtimeEvent & { userId: string }>;
  convOf(firstName: string): string;
  charOf(firstName: string): string;
  close(): Promise<void>;
}

export interface ApiMessage {
  id: string;
  seq: number;
  authorType: 'user' | 'character';
  content: string;
  origin: string;
  replyToMessageId: string | null;
  replyTo: { id: string; content?: string; deleted?: boolean; missing?: boolean; authorType?: string } | null;
  conversationId: string;
  clientId: string | null;
}

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return loadConfig({ NODE_ENV: 'test', DATABASE_FILE: ':memory:', APP_PASSWORD: 'secret-test', LOG_LEVEL: 'warn' }, overrides);
}

export async function createTestEnv(
  opts: { config?: Partial<AppConfig>; clock?: ManualClock; anthropicProvider?: AiProvider | null; login?: boolean } = {},
): Promise<TestEnv> {
  const clock = opts.clock ?? new ManualClock();
  const ctx = createContext({
    config: testConfig(opts.config),
    clock,
    rng: seededRandom(42),
    silentLogs: true,
    anthropicProvider: opts.anthropicProvider ?? null,
  });
  const app = createAppServer(ctx);
  const agent = supertest.agent(app.app).set('X-Requested-With', 'cercle');
  if (opts.login !== false) {
    await agent.post('/api/auth/login').send({ username: 'moi', password: 'secret-test' }).expect(200);
  }
  const userId = ctx.auth.primaryUser().id;
  const events: TestEnv['events'] = [];
  ctx.bus.subscribe((uid, e) => events.push({ ...e, userId: uid }));
  const byName = (firstName: string) => {
    const c = ctx.characters.list(userId).find((x) => x.firstName === firstName);
    if (!c) throw new Error(`Personnage ${firstName} introuvable`);
    return c;
  };
  return {
    ctx,
    clock,
    app,
    agent,
    userId,
    events,
    charOf: (n) => byName(n).id,
    convOf: (n) => ctx.conversations.idForCharacter(userId, byName(n).id)!,
    async close() {
      await app.close();
      await disposeContext(ctx);
    },
  };
}

let counter = 0;
export const clientId = () => `test-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Envoie un message utilisateur via l'API HTTP réelle. */
export function send(env: TestEnv, conversationId: string, content: string, replyToMessageId?: string, id = clientId()) {
  return env.agent.post(`/api/conversations/${conversationId}/messages`).send({ content, clientId: id, replyToMessageId });
}

export async function history(env: TestEnv, conversationId: string): Promise<ApiMessage[]> {
  const res = await env.agent.get(`/api/conversations/${conversationId}/messages?limit=200`).expect(200);
  return res.body.messages as ApiMessage[];
}

/** Fait écrire un personnage par le chemin de production (tâche planifiée forcée). */
export async function incoming(env: TestEnv, firstName: string) {
  env.ctx.automation.triggerIncomingNow(env.userId, env.charOf(firstName));
  await env.ctx.scheduler.runUntilIdle();
}

/** Coupe les automatisations des personnages cités pour isoler un scénario. */
export function quiet(env: TestEnv, ...names: string[]) {
  for (const n of names) {
    env.ctx.characters.update(env.userId, env.charOf(n), { automation: { incomingEnabled: false, replyEnabled: false } });
  }
}

export function quietAll(env: TestEnv) {
  quiet(env, ...env.ctx.characters.list(env.userId).map((c) => c.firstName));
}

export function setAi(env: TestEnv, firstName: string, ai: Record<string, unknown>) {
  env.ctx.characters.update(env.userId, env.charOf(firstName), { ai });
}

export function pendingTasks(env: TestEnv, type?: string) {
  return env.ctx.tasks.list({ status: 'pending', type }).concat(env.ctx.tasks.list({ status: 'running', type }));
}

/** Fournisseur IA contrôlable : générations instantanées, bloquées, en panne ou suspendues. */
export class ControlledProvider implements AiProvider {
  readonly id = 'anthropic';
  readonly label = 'Fournisseur contrôlé (test)';
  readonly isReal = true;
  readonly model = 'test-model';
  calls: GenerationContext[] = [];
  mode: 'instant' | 'manual' | 'fail' | 'hang' = 'instant';
  failure: Error | null = null;
  private waiting: Array<() => void> = [];

  async generate(context: GenerationContext): Promise<GenerationResult> {
    this.calls.push(context);
    if (this.mode === 'fail') throw this.failure ?? new Error('panne simulée');
    if (this.mode === 'hang') await new Promise<void>(() => undefined);
    if (this.mode === 'manual') await new Promise<void>((resolve) => this.waiting.push(resolve));
    const text = context.purpose === 'user_proxy' ? 'Réponse IA à ma place' : `Réponse de ${context.character.firstName}`;
    return { parts: [text], providerId: this.id, model: this.model, fallback: false, usage: { inputTokens: 10, outputTokens: 5 } };
  }

  async ping() {
    if (this.mode === 'fail') throw this.failure ?? new Error('panne simulée');
    return { model: this.model, text: 'OK' };
  }

  get pending() {
    return this.waiting.length;
  }

  releaseAll() {
    const w = this.waiting;
    this.waiting = [];
    w.forEach((r) => r());
  }
}

export async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor : délai dépassé');
    await new Promise((r) => setTimeout(r, 5));
  }
}
