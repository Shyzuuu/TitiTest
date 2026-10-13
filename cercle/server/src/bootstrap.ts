import { loadConfig, type AppConfig } from './config.js';
import type { AppContext } from './context.js';
import { Database } from './db/database.js';
import { migrate } from './db/migrations.js';
import { seedDemoData } from './db/seed.js';
import { systemClock, type Clock } from './lib/clock.js';
import { createLogger } from './lib/logger.js';
import { mathRandom, type Random } from './lib/random.js';
import { EventBus } from './realtime/eventBus.js';
import { AiService } from './modules/ai/ai.service.js';
import type { AiProvider } from './modules/ai/types.js';
import { SuggestionService } from './modules/ai/suggestions.service.js';
import { AuthService } from './modules/auth/auth.service.js';
import { CharacterService } from './modules/characters/characters.service.js';
import { ConversationService } from './modules/conversations/conversations.service.js';
import { DraftService } from './modules/drafts/drafts.service.js';
import { MailboxService } from './modules/mailbox/mailbox.service.js';
import { MemoryService } from './modules/memory/memory.service.js';
import { MessageService } from './modules/messages/messages.service.js';
import { NotificationService } from './modules/notifications/notifications.service.js';
import { AutomationService } from './modules/scheduler/automation.service.js';
import { Scheduler } from './modules/scheduler/scheduler.js';
import { TaskRepository } from './modules/scheduler/tasks.repository.js';
import { SettingsService } from './modules/settings/settings.service.js';

export interface CreateContextOptions {
  config?: AppConfig;
  clock?: Clock;
  rng?: Random;
  /** Injection d'un fournisseur « réel » simulé (tests de panne, de concurrence). */
  anthropicProvider?: AiProvider | null;
  silentLogs?: boolean;
  seed?: boolean;
}

export function createContext(options: CreateContextOptions = {}): AppContext {
  const config = options.config ?? loadConfig();
  const clock = options.clock ?? systemClock;
  const db = new Database(config.databaseFile);
  migrate(db, clock.now());
  const ctx = {
    config,
    db,
    clock,
    rng: options.rng ?? mathRandom,
    logger: createLogger({ db, clock, level: config.logLevel, silent: options.silentLogs }),
    bus: new EventBus(db, clock),
  } as AppContext;
  ctx.settings = new SettingsService(ctx);
  ctx.auth = new AuthService(ctx);
  ctx.characters = new CharacterService(ctx);
  ctx.conversations = new ConversationService(ctx);
  ctx.messages = new MessageService(ctx);
  ctx.mailbox = new MailboxService(ctx);
  ctx.notifications = new NotificationService(ctx);
  ctx.memory = new MemoryService(ctx);
  ctx.drafts = new DraftService(ctx);
  ctx.suggestions = new SuggestionService(ctx);
  ctx.tasks = new TaskRepository(ctx);
  ctx.automation = new AutomationService(ctx);
  ctx.ai = new AiService(ctx, options.anthropicProvider === undefined ? {} : { anthropic: options.anthropicProvider });
  ctx.scheduler = new Scheduler(ctx);

  const user = ctx.auth.ensurePrimaryUser();
  const hasCharacters = db.get('SELECT 1 FROM characters WHERE user_id = $u LIMIT 1', { u: user.id });
  if (!hasCharacters && (options.seed ?? config.seedOnEmpty)) {
    db.transaction(() => seedDemoData(ctx, user.id));
  } else {
    ctx.automation.ensureAll(user.id);
  }
  return ctx;
}

export async function disposeContext(ctx: AppContext): Promise<void> {
  await ctx.scheduler.stop();
  ctx.db.close();
}
