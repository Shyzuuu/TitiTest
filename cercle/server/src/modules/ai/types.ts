import type { Character, MemoryRow } from '../../domain.js';

export type GenerationPurpose = 'character_reply' | 'character_initiate' | 'character_followup' | 'user_proxy';

export interface HistoryItem {
  author: 'user' | 'character';
  content: string;
  createdAt: number;
  origin: string;
  quoted?: { author: 'user' | 'character'; content: string } | null;
  meta?: Record<string, unknown>;
}

export interface GenerationContext {
  purpose: GenerationPurpose;
  character: Character;
  userName: string;
  userPersona: string;
  /** Consignes propres à cette conversation pour l'IA qui répond à ma place. */
  replyStyle: string;
  memories: MemoryRow[];
  history: HistoryItem[];
  maxParts: number;
  now: number;
}

export interface GenerationResult {
  parts: string[];
  providerId: 'anthropic' | 'local' | string;
  model: string;
  /** Vrai si le fournisseur principal a échoué et que la simulation locale a pris le relais. */
  fallback: boolean;
  usage?: { inputTokens: number; outputTokens: number };
  meta?: Record<string, unknown>;
}

export interface AiProvider {
  readonly id: 'anthropic' | 'local' | string;
  readonly label: string;
  /** Faux pour la simulation locale : l'interface ne doit jamais la présenter comme une IA réelle. */
  readonly isReal: boolean;
  readonly model: string;
  generate(context: GenerationContext, signal?: AbortSignal): Promise<GenerationResult>;
  ping(): Promise<{ model: string; text: string }>;
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    readonly code: 'timeout' | 'refusal' | 'budget' | 'invalid_output' | 'auth' | 'rate_limit' | 'unavailable' | 'unknown',
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
