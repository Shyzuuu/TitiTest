import type { AppConfig } from './config.js';
import type { Database } from './db/database.js';
import type { Clock } from './lib/clock.js';
import type { Logger } from './lib/logger.js';
import type { Random } from './lib/random.js';
import type { EventBus } from './realtime/eventBus.js';
import type { AuthService } from './modules/auth/auth.service.js';
import type { SettingsService } from './modules/settings/settings.service.js';
import type { CharacterService } from './modules/characters/characters.service.js';
import type { ConversationService } from './modules/conversations/conversations.service.js';
import type { MessageService } from './modules/messages/messages.service.js';
import type { MailboxService } from './modules/mailbox/mailbox.service.js';
import type { NotificationService } from './modules/notifications/notifications.service.js';
import type { MemoryService } from './modules/memory/memory.service.js';
import type { DraftService } from './modules/drafts/drafts.service.js';
import type { AiService } from './modules/ai/ai.service.js';
import type { TaskRepository } from './modules/scheduler/tasks.repository.js';
import type { AutomationService } from './modules/scheduler/automation.service.js';
import type { Scheduler } from './modules/scheduler/scheduler.js';
import type { SuggestionService } from './modules/ai/suggestions.service.js';

/** Conteneur de dépendances : chaque service reçoit le contexte et résout ses pairs à l'appel. */
export interface AppContext {
  config: AppConfig;
  db: Database;
  clock: Clock;
  rng: Random;
  logger: Logger;
  bus: EventBus;
  auth: AuthService;
  settings: SettingsService;
  characters: CharacterService;
  conversations: ConversationService;
  messages: MessageService;
  mailbox: MailboxService;
  notifications: NotificationService;
  memory: MemoryService;
  drafts: DraftService;
  ai: AiService;
  suggestions: SuggestionService;
  tasks: TaskRepository;
  automation: AutomationService;
  scheduler: Scheduler;
}
