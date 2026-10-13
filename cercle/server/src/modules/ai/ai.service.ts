import type { AppContext } from '../../context.js';
import type { Character, ConversationRow, MessageRow } from '../../domain.js';
import { errorMessage } from '../../lib/errors.js';
import { safeJsonParse } from '../../lib/text.js';
import type { AiStatus } from '../settings/settings.service.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { LocalProvider } from './providers/local.js';
import {
  AiProviderError,
  type AiProvider,
  type GenerationContext,
  type GenerationPurpose,
  type GenerationResult,
  type HistoryItem,
} from './types.js';

const HISTORY_WINDOW = 30;

export interface ProviderInfo {
  id: string;
  label: string;
  isReal: boolean;
  configured: boolean;
  model: string | null;
}

export class AiService {
  private readonly local: LocalProvider;
  private readonly anthropic: AiProvider | null;

  constructor(
    private readonly ctx: AppContext,
    overrides: { anthropic?: AiProvider | null } = {},
  ) {
    this.local = new LocalProvider(ctx.rng);
    if (overrides.anthropic !== undefined) {
      this.anthropic = overrides.anthropic;
    } else if (ctx.config.ai.anthropicApiKey) {
      this.anthropic = new AnthropicProvider(ctx.config.ai);
    } else {
      this.anthropic = null;
    }
  }

  activeProviderId(): 'anthropic' | 'local' {
    const chosen = this.ctx.settings.get().aiProvider;
    if (chosen === 'anthropic' && this.anthropic) return 'anthropic';
    if (chosen === 'local') return 'local';
    if (this.ctx.config.ai.provider === 'local') return 'local';
    return this.anthropic ? 'anthropic' : 'local';
  }

  private provider(): AiProvider {
    return this.activeProviderId() === 'anthropic' && this.anthropic ? this.anthropic : this.local;
  }

  providers(): ProviderInfo[] {
    return [
      {
        id: 'anthropic',
        label: 'Claude (API Anthropic)',
        isReal: true,
        configured: this.anthropic !== null,
        model: this.anthropic?.model ?? this.ctx.config.ai.model,
      },
      { id: 'local', label: this.local.label, isReal: false, configured: true, model: this.local.model },
    ];
  }

  private today(): string {
    return new Date(this.ctx.clock.now()).toISOString().slice(0, 10);
  }

  usageToday(): { day: string; calls: number; errors: number; inputTokens: number; outputTokens: number; limit: number } {
    const day = this.today();
    const row = this.ctx.db.get<{ calls: number; errors: number; input_tokens: number; output_tokens: number }>(
      'SELECT calls, errors, input_tokens, output_tokens FROM ai_usage WHERE day = $d',
      { d: day },
    );
    return {
      day,
      calls: row?.calls ?? 0,
      errors: row?.errors ?? 0,
      inputTokens: row?.input_tokens ?? 0,
      outputTokens: row?.output_tokens ?? 0,
      limit: this.ctx.settings.get().aiDailyCallLimit,
    };
  }

  private recordUsage(ok: boolean, usage?: { inputTokens: number; outputTokens: number }): void {
    this.ctx.db.run(
      `INSERT INTO ai_usage (day, calls, errors, input_tokens, output_tokens) VALUES ($d, 1, $e, $i, $o)
       ON CONFLICT(day) DO UPDATE SET calls = calls + 1, errors = errors + $e,
         input_tokens = input_tokens + $i, output_tokens = output_tokens + $o`,
      { d: this.today(), e: ok ? 0 : 1, i: usage?.inputTokens ?? 0, o: usage?.outputTokens ?? 0 },
    );
  }

  /**
   * Génère via le fournisseur actif. Les appels réels sont plafonnés par jour ; en cas
   * d'échec, la simulation locale peut prendre le relais (si autorisé), le résultat étant
   * alors explicitement marqué `fallback`.
   */
  async generate(context: GenerationContext, opts: { allowLocalFallback: boolean }): Promise<GenerationResult> {
    const provider = this.provider();
    if (!provider.isReal) return provider.generate(context);
    const usage = this.usageToday();
    try {
      if (usage.calls >= usage.limit) {
        throw new AiProviderError(`Plafond quotidien d'appels IA atteint (${usage.limit}).`, false, 'budget');
      }
      const result = await provider.generate(context);
      this.recordUsage(true, result.usage);
      return result;
    } catch (err) {
      const aiErr = err instanceof AiProviderError ? err : new AiProviderError(errorMessage(err), true, 'unknown');
      if (aiErr.code !== 'budget') this.recordUsage(false);
      this.ctx.logger.warn('ai', `Échec de génération (${provider.id}) : ${aiErr.message}`, { code: aiErr.code });
      if (aiErr.code === 'auth' || aiErr.code === 'unavailable' || aiErr.code === 'timeout') {
        this.ctx.settings.setAiStatus({
          provider: 'anthropic',
          state: 'error',
          checkedAt: this.ctx.clock.now(),
          latencyMs: null,
          model: provider.model,
          error: aiErr.message,
        });
      }
      if (opts.allowLocalFallback && this.ctx.settings.get().aiFallbackToLocal) {
        const local = await this.local.generate(context);
        return { ...local, fallback: true, meta: { fallbackReason: aiErr.message } };
      }
      throw aiErr;
    }
  }

  /** Test réel du fournisseur : seul un appel abouti fait passer l'état à « ok ». */
  async test(): Promise<AiStatus> {
    const provider = this.provider();
    const started = Date.now();
    let status: AiStatus;
    try {
      const { model } = await provider.ping();
      if (provider.isReal) this.recordUsage(true);
      status = {
        provider: provider.id as 'anthropic' | 'local',
        state: 'ok',
        checkedAt: this.ctx.clock.now(),
        latencyMs: Date.now() - started,
        model,
        error: null,
      };
    } catch (err) {
      if (provider.isReal) this.recordUsage(false);
      status = {
        provider: provider.id as 'anthropic' | 'local',
        state: 'error',
        checkedAt: this.ctx.clock.now(),
        latencyMs: Date.now() - started,
        model: provider.model,
        error: errorMessage(err),
      };
    }
    this.ctx.settings.setAiStatus(status);
    this.ctx.logger.info('ai', `Test du fournisseur ${provider.id} : ${status.state}`, { error: status.error });
    return status;
  }

  /** Contexte de génération, strictement limité à la conversation et à la mémoire du personnage concerné. */
  buildContext(purpose: GenerationPurpose, conv: ConversationRow, character: Character, maxParts = 1): GenerationContext {
    const user = this.ctx.db.get<{ display_name: string }>('SELECT display_name FROM users WHERE id = $id', {
      id: conv.user_id,
    });
    const rows = this.ctx.db
      .all<MessageRow>(
        `SELECT * FROM messages WHERE conversation_id = $c AND status = 'sent' ORDER BY seq DESC LIMIT $l`,
        { c: conv.id, l: HISTORY_WINDOW },
      )
      .reverse();
    const byId = new Map(rows.map((r) => [r.id, r]));
    const history: HistoryItem[] = rows.map((r) => {
      const q = r.reply_to_message_id ? byId.get(r.reply_to_message_id) ?? this.ctx.messages.getRow(r.reply_to_message_id) : undefined;
      return {
        author: r.author_type,
        content: r.content,
        createdAt: r.created_at,
        origin: r.origin,
        quoted: q && q.status === 'sent' ? { author: q.author_type, content: q.content } : null,
        meta: safeJsonParse(r.meta_json, {}),
      };
    });
    const settings = this.ctx.settings.get();
    return {
      purpose,
      character,
      userName: user?.display_name ?? 'Moi',
      userPersona: settings.userPersona,
      replyStyle: character.ai.replyStyle,
      memories: this.ctx.memory.forCharacter(character.id, 40),
      history,
      maxParts,
      now: this.ctx.clock.now(),
    };
  }
}
