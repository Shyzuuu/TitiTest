import type { AppContext } from '../../context.js';
import { globalSettingsSchema, settingsPatchSchema, type GlobalSettings } from '../../domain.js';
import { badRequest } from '../../lib/errors.js';
import { safeJsonParse } from '../../lib/text.js';

export interface AiStatus {
  provider: 'anthropic' | 'local';
  /** `unverified` tant qu'aucun test réel n'a abouti : on n'affiche jamais « connectée » sans preuve. */
  state: 'unverified' | 'ok' | 'error';
  checkedAt: number | null;
  latencyMs: number | null;
  model: string | null;
  error: string | null;
}

export class SettingsService {
  private cache: GlobalSettings | null = null;

  constructor(private readonly ctx: AppContext) {}

  private read<T>(key: string): T | undefined {
    const row = this.ctx.db.get<{ value_json: string }>('SELECT value_json FROM settings WHERE key = $k', { k: key });
    return row ? safeJsonParse<T | undefined>(row.value_json, undefined) : undefined;
  }

  private write(key: string, value: unknown): void {
    this.ctx.db.run(
      `INSERT INTO settings (key, value_json, updated_at) VALUES ($k, $v, $t)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      { k: key, v: JSON.stringify(value), t: this.ctx.clock.now() },
    );
  }

  get(): GlobalSettings {
    if (this.cache) return this.cache;
    const stored = this.read<Partial<GlobalSettings>>('global') ?? {};
    const parsed = globalSettingsSchema.safeParse({ simulationSpeed: this.ctx.config.simulationSpeed, ...stored });
    this.cache = parsed.success ? parsed.data : globalSettingsSchema.parse({});
    return this.cache;
  }

  update(userId: string, patch: unknown): GlobalSettings {
    const parsed = settingsPatchSchema.safeParse(patch);
    if (!parsed.success) throw badRequest('Paramètres invalides.', parsed.error.flatten());
    const previous = this.get();
    const next = globalSettingsSchema.parse({ ...previous, ...parsed.data });
    this.ctx.db.transaction(() => {
      this.write('global', next);
      this.cache = next;
      this.ctx.bus.publish(userId, 'settings.updated', { settings: next });
    });
    if (previous.automationPaused && !next.automationPaused) this.ctx.automation.onAutomationResumed(userId);
    if (previous.simulationSpeed !== next.simulationSpeed || previous.demoDivisor !== next.demoDivisor) {
      this.ctx.automation.rescheduleAllInitiations(userId);
    }
    return next;
  }

  invalidate(): void {
    this.cache = null;
  }

  /** Délai effectif : divisé en mode démo pour tester les automatisations en quelques secondes. */
  scaleMs(ms: number): number {
    const s = this.get();
    return s.simulationSpeed === 'demo' ? Math.max(250, Math.round(ms / s.demoDivisor)) : Math.round(ms);
  }

  getAiStatus(): AiStatus {
    const provider = this.ctx.ai.activeProviderId();
    const stored = this.read<AiStatus>('ai_status');
    if (stored && stored.provider === provider) return stored;
    return { provider, state: 'unverified', checkedAt: null, latencyMs: null, model: null, error: null };
  }

  setAiStatus(status: AiStatus): void {
    this.write('ai_status', status);
  }
}
