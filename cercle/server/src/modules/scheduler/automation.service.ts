import type { AppContext } from '../../context.js';
import type { Character, MessageRow, TaskRow } from '../../domain.js';
import { randomBetween } from '../../lib/random.js';
import { safeJsonParse } from '../../lib/text.js';

/** Délai minimal entre le dernier message d'une rafale et la réponse IA groupée. */
const AI_GROUPING_GRACE_MS = 15_000;

export const dedupeKeys = {
  aiReply: (conversationId: string) => `ai_reply:${conversationId}`,
  characterReply: (conversationId: string) => `character_reply:${conversationId}`,
  initiate: (characterId: string) => `initiate:${characterId}`,
};

/**
 * Politiques d'automatisation (indépendantes de l'interface) :
 * - réponse du personnage : regroupée (debounce) sur les messages successifs de l'utilisateur ;
 * - réponse IA à ma place : une tâche par conversation, couvrant le groupe de messages
 *   entrants non répondus, échéance fixée au premier message + délai configuré ;
 * - messages spontanés : une chaîne de tâches par personnage.
 * Toute réponse humaine annule les réponses IA en attente de SA conversation uniquement.
 */
export class AutomationService {
  constructor(private readonly ctx: AppContext) {}

  private character(id: string): Character | null {
    return this.ctx.characters.findById(id);
  }

  onManualUserMessage(userId: string, conversationId: string, message: MessageRow): void {
    const cancelled = this.ctx.tasks.cancelPending({ conversationId, types: ['ai_reply'] }, 'manual_reply');
    if (cancelled.length) {
      this.ctx.logger.info('automation', 'Réponse manuelle : réponse IA en attente annulée', {
        conversationId,
        tasks: cancelled.map((t) => t.id),
      });
    }
    this.scheduleCharacterReply(userId, conversationId, message.seq);
  }

  scheduleCharacterReply(userId: string, conversationId: string, anchorUserSeq: number): TaskRow | null {
    const conv = this.ctx.conversations.getRow(conversationId);
    if (!conv) return null;
    const character = this.character(conv.character_id);
    if (!character || !character.isActive || !character.automation.replyEnabled) return null;
    const a = character.automation;
    const delay = this.ctx.settings.scaleMs(randomBetween(this.ctx.rng, a.replyDelayMinSeconds, a.replyDelayMaxSeconds) * 1000);
    const runAt = this.ctx.clock.now() + delay;
    return this.ctx.tasks.upsert(
      {
        type: 'character_reply',
        userId,
        conversationId,
        characterId: character.id,
        dedupeKey: dedupeKeys.characterReply(conversationId),
        runAt,
        payload: { anchorUserSeq },
      },
      // Nouveau message pendant l'attente : on attend la fin de la rafale avant de répondre.
      () => ({ runAt, payload: { anchorUserSeq } }),
    );
  }

  onCharacterMessage(userId: string, conversationId: string, message: MessageRow): void {
    const conv = this.ctx.conversations.getRow(conversationId);
    if (!conv) return;
    const character = this.character(conv.character_id);
    if (!character || !character.isActive || character.ai.mode === 'off') return;
    if (conv.auto_chain >= this.ctx.settings.get().maxAutoChain) {
      this.ctx.logger.info('automation', 'Chaîne de réponses automatiques plafonnée, aucune réponse IA programmée', {
        conversationId,
      });
      return;
    }
    const now = this.ctx.clock.now();
    const delay = this.ctx.settings.scaleMs(character.ai.delaySeconds * 1000);
    const grace = Math.min(this.ctx.settings.scaleMs(AI_GROUPING_GRACE_MS), delay);
    this.ctx.tasks.upsert(
      {
        type: 'ai_reply',
        userId,
        conversationId,
        characterId: character.id,
        dedupeKey: dedupeKeys.aiReply(conversationId),
        runAt: now + delay,
        payload: { anchorUserSeq: conv.last_user_seq, firstMessageId: message.id, lastMessageId: message.id },
      },
      (existing) => {
        const payload = safeJsonParse<Record<string, unknown>>(existing.payload_json, {});
        return {
          // Échéance inchangée (premier message + délai), sauf rafale tardive : petite marge.
          runAt: Math.max(existing.run_at, now + grace),
          payload: { ...payload, lastMessageId: message.id },
        };
      },
    );
  }

  private initiationDelay(character: Character): number {
    const a = character.automation;
    const minutes = randomBetween(this.ctx.rng, a.incomingMinMinutes, a.incomingMaxMinutes);
    return this.ctx.settings.scaleMs(minutes * 60_000);
  }

  scheduleNextInitiation(userId: string, characterId: string, replaceExisting = false): TaskRow | null {
    const character = this.character(characterId);
    if (!character || !character.isActive || !character.automation.incomingEnabled) return null;
    const conversationId = this.ctx.conversations.idForCharacter(userId, characterId);
    if (!conversationId) return null;
    const runAt = this.ctx.clock.now() + this.initiationDelay(character);
    return this.ctx.tasks.upsert(
      {
        type: 'character_initiate',
        userId,
        conversationId,
        characterId,
        dedupeKey: dedupeKeys.initiate(characterId),
        runAt,
        payload: {},
        maxAttempts: 2,
      },
      (existing) => ({ runAt: replaceExisting ? runAt : existing.run_at, payload: {} }),
    );
  }

  /** Aligne les tâches d'un personnage sur sa configuration (après création ou modification). */
  reconcileCharacter(userId: string, characterId: string, previous?: Character): void {
    const character = this.character(characterId);
    if (!character) return;
    const conversationId = this.ctx.conversations.idForCharacter(userId, characterId);
    if (!character.isActive) {
      this.ctx.tasks.cancelPending({ characterId }, 'character_disabled');
      return;
    }
    if (!character.automation.incomingEnabled) {
      this.ctx.tasks.cancelPending({ characterId, types: ['character_initiate'] }, 'incoming_disabled');
    } else {
      const intervalChanged =
        previous &&
        (previous.automation.incomingMinMinutes !== character.automation.incomingMinMinutes ||
          previous.automation.incomingMaxMinutes !== character.automation.incomingMaxMinutes);
      this.scheduleNextInitiation(userId, characterId, Boolean(intervalChanged));
    }
    if (!character.automation.replyEnabled) {
      this.ctx.tasks.cancelPending({ characterId, types: ['character_reply'] }, 'reply_disabled');
    }
    if (character.ai.mode === 'off') {
      this.ctx.tasks.cancelPending({ characterId, types: ['ai_reply'] }, 'ai_disabled');
    } else if (conversationId && previous && previous.ai.delaySeconds !== character.ai.delaySeconds) {
      // Nouveau délai : l'échéance est recalculée depuis la création de la tâche.
      const pending = this.ctx.tasks.findPending(dedupeKeys.aiReply(conversationId));
      if (pending) {
        const runAt = Math.max(
          this.ctx.clock.now(),
          pending.created_at + this.ctx.settings.scaleMs(character.ai.delaySeconds * 1000),
        );
        this.ctx.tasks.reschedule(pending.id, runAt);
      }
    } else if (conversationId && previous && previous.ai.mode === 'off') {
      // Activation de l'IA : prise en charge des messages entrants déjà en attente de réponse.
      const conv = this.ctx.conversations.getRow(conversationId);
      if (conv && conv.last_character_seq > conv.last_user_seq && conv.last_message_id) {
        const last = this.ctx.messages.getRow(conv.last_message_id);
        if (last) this.onCharacterMessage(userId, conversationId, last);
      }
    }
  }

  rescheduleAllInitiations(userId: string): void {
    for (const c of this.ctx.characters.list(userId)) {
      if (c.isActive && c.automation.incomingEnabled) this.scheduleNextInitiation(userId, c.id, true);
    }
  }

  /** À la reprise, les messages spontanés en retard sont replanifiés (pas de rafale de rattrapage). */
  onAutomationResumed(userId: string): void {
    const now = this.ctx.clock.now();
    for (const c of this.ctx.characters.list(userId)) {
      const pending = this.ctx.tasks.findPending(dedupeKeys.initiate(c.id));
      if (pending && pending.run_at <= now) this.scheduleNextInitiation(userId, c.id, true);
    }
    this.ctx.logger.info('automation', 'Automatisations reprises');
  }

  /** Au démarrage : chaque personnage actif retrouve sa chaîne de messages spontanés. */
  ensureAll(userId: string): void {
    this.ctx.db.transaction(() => {
      for (const c of this.ctx.characters.list(userId)) this.reconcileCharacter(userId, c.id);
    });
  }

  /** Déclenchement manuel (administration / démonstration) d'un message entrant immédiat. */
  triggerIncomingNow(userId: string, characterId: string): TaskRow {
    const character = this.ctx.characters.get(userId, characterId);
    const conversationId = this.ctx.conversations.idForCharacter(userId, characterId)!;
    const now = this.ctx.clock.now();
    return this.ctx.tasks.upsert(
      {
        type: 'character_initiate',
        userId,
        conversationId,
        characterId: character.id,
        dedupeKey: dedupeKeys.initiate(characterId),
        runAt: now,
        payload: { forced: true },
        maxAttempts: 2,
      },
      () => ({ runAt: now, payload: { forced: true } }),
    );
  }
}
