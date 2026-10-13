import Anthropic from '@anthropic-ai/sdk';
import type { AppConfig } from '../../../config.js';
import { buildSystemPrompt, buildUserPrompt } from '../prompt.js';
import { sanitizeAiOutput } from '../sanitize.js';
import { AiProviderError, type AiProvider, type GenerationContext, type GenerationResult } from '../types.js';

/**
 * Fournisseur Claude (API Anthropic), appelé exclusivement côté serveur.
 * La clé reste dans l'environnement du serveur ; aucune donnée de configuration
 * n'est transmise au modèle.
 */
export class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  readonly label = 'Claude (API Anthropic)';
  readonly isReal = true;
  readonly model: string;
  private readonly client: Anthropic;

  constructor(private readonly config: AppConfig['ai']) {
    if (!config.anthropicApiKey) throw new Error('ANTHROPIC_API_KEY manquante');
    this.model = config.model;
    // Les réessais sont gérés par le planificateur (persistants, visibles dans l'administration).
    this.client = new Anthropic({ apiKey: config.anthropicApiKey, timeout: config.timeoutMs, maxRetries: 0 });
  }

  private async call(system: string, user: string, maxTokens: number, signal?: AbortSignal) {
    try {
      const response = await this.client.beta.messages.create(
        {
          model: this.model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
          // Conversation légère : effort réduit pour la latence et le coût (configurable via AI_EFFORT).
          output_config: { effort: this.config.effort },
          ...(this.config.serverFallbacks
            ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
            : {}),
        },
        { signal, timeout: this.config.timeoutMs },
      );
      if (response.stop_reason === 'refusal') {
        throw new AiProviderError('Le modèle a refusé de générer cette réponse.', false, 'refusal');
      }
      const text = response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('')
        .trim();
      if (!text) {
        const truncated = response.stop_reason === 'max_tokens';
        throw new AiProviderError(
          truncated ? 'Réponse tronquée (limite de jetons atteinte).' : 'Réponse vide du modèle.',
          true,
          'invalid_output',
        );
      }
      return {
        text,
        model: response.model,
        usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      };
    } catch (err) {
      throw mapError(err);
    }
  }

  async generate(context: GenerationContext, signal?: AbortSignal): Promise<GenerationResult> {
    const { text, model, usage } = await this.call(
      buildSystemPrompt(context),
      buildUserPrompt(context),
      this.config.maxTokens,
      signal,
    );
    const names = [context.character.firstName, context.character.fullName, context.userName, 'Moi'];
    return {
      parts: sanitizeAiOutput(text, { maxParts: context.maxParts, names }),
      providerId: this.id,
      model,
      fallback: false,
      usage,
    };
  }

  async ping(): Promise<{ model: string; text: string }> {
    const { text, model } = await this.call(
      'Tu es un test de connectivité. Réponds exactement « OK ».',
      'Test de connexion.',
      512,
    );
    return { model, text: text.slice(0, 40) };
  }
}

function mapError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiProviderError('Délai d’attente du fournisseur IA dépassé.', true, 'timeout');
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AiProviderError('Clé API Anthropic refusée (vérifiez ANTHROPIC_API_KEY).', false, 'auth');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AiProviderError('Limite de débit du fournisseur IA atteinte.', true, 'rate_limit');
  }
  if (err instanceof Anthropic.BadRequestError || err instanceof Anthropic.NotFoundError) {
    return new AiProviderError(`Requête refusée par le fournisseur IA : ${err.message}`, false, 'unknown');
  }
  if (err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
    return new AiProviderError('Fournisseur IA indisponible.', true, 'unavailable');
  }
  if (err instanceof Anthropic.APIUserAbortError) {
    return new AiProviderError('Génération annulée.', false, 'timeout');
  }
  if (err instanceof Anthropic.APIError) {
    return new AiProviderError(`Erreur du fournisseur IA : ${err.message}`, true, 'unknown');
  }
  return new AiProviderError(err instanceof Error ? err.message : 'Erreur inconnue du fournisseur IA.', true, 'unknown');
}
