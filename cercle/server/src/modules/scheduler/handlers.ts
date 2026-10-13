import type { AppContext } from '../../context.js';
import type { Character, ConversationRow, MessageRow, TaskRow, TaskType } from '../../domain.js';
import { randomBetween } from '../../lib/random.js';
import { hasQuestion, safeJsonParse } from '../../lib/text.js';
import { assessSensitivity } from '../ai/sensitivity.js';
import type { GenerationPurpose, GenerationResult } from '../ai/types.js';
import { dedupeKeys } from './automation.service.js';

export type TaskOutcome = { status: 'done' | 'cancelled' | 'superseded'; result?: Record<string, unknown> };
export type TaskHandler = (task: TaskRow) => Promise<TaskOutcome>;

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

/** Exécution perdue (bail expiré, tâche reprise ailleurs) : rien ne doit être écrit. */
class LostOwnership extends Error {}

export function createHandlers(ctx: AppContext): Record<TaskType, TaskHandler> {
  const payloadOf = (task: TaskRow) => safeJsonParse<Record<string, unknown>>(task.payload_json, {});

  const typing = (userId: string, conv: ConversationRow, on: boolean) =>
    ctx.bus.ephemeral(userId, 'typing', { conversationId: conv.id, characterId: conv.character_id, typing: on });

  const typingPause = () => sleep(randomBetween(ctx.rng, ctx.config.typingDelayMs.min, ctx.config.typingDelayMs.max));

  const assertOwned = (task: TaskRow) => {
    if (!ctx.tasks.isOwned(task)) throw new LostOwnership(`Tâche ${task.id} reprise par une autre exécution`);
  };

  /** Insère le premier message et planifie les suivants (rafale) comme tâches distinctes. */
  const deliverCharacterParts = (
    task: TaskRow,
    conv: ConversationRow,
    result: GenerationResult,
    origin: 'simulation' | 'character_reply',
  ): MessageRow | null => {
    const meta = { provider: result.providerId, model: result.model, fallback: result.fallback, purpose: task.type };
    const first = ctx.messages.insertFromCharacter(task.user_id, conv, result.parts[0]!, origin, `task:${task.id}:0`, meta);
    let at = ctx.clock.now();
    result.parts.slice(1).forEach((content, i) => {
      at += randomBetween(ctx.rng, 1500, 3500);
      ctx.tasks.insert({
        type: 'character_part',
        userId: task.user_id,
        conversationId: conv.id,
        characterId: conv.character_id,
        runAt: at,
        payload: { content, index: i + 1, parentTaskId: task.id, origin, meta, last: i === result.parts.length - 2 },
      });
    });
    return first;
  };

  const loadActive = (task: TaskRow): { conv: ConversationRow; character: Character } | null => {
    const conv = task.conversation_id ? ctx.conversations.getRow(task.conversation_id) : undefined;
    const character = task.character_id ? ctx.characters.findById(task.character_id) : null;
    if (!conv || !character || !character.isActive) return null;
    return { conv, character };
  };

  const characterReply: TaskHandler = async (task) => {
    const loaded = loadActive(task);
    if (!loaded || !loaded.character.automation.replyEnabled) return { status: 'cancelled', result: { reason: 'inactive' } };
    const { conv, character } = loaded;
    const anchor = Number(payloadOf(task).anchorUserSeq ?? 0);
    if (conv.last_user_seq > anchor) return { status: 'superseded', result: { reason: 'newer_user_message' } };

    typing(task.user_id, conv, true);
    try {
      const gen = ctx.ai.buildContext('character_reply', conv, character, character.automation.burstMax);
      const result = await ctx.ai.generate(gen, { allowLocalFallback: true });
      await typingPause();
      return ctx.db.transaction(() => {
        assertOwned(task);
        const fresh = ctx.conversations.getRow(conv.id)!;
        // L'utilisateur a écrit pendant la génération : la tâche suivante répondra à l'ensemble.
        if (fresh.last_user_seq > anchor) return { status: 'superseded' as const, result: { reason: 'user_wrote_during_generation' } };
        const first = deliverCharacterParts(task, fresh, result, 'character_reply');
        return {
          status: 'done' as const,
          result: { messageId: first?.id ?? null, parts: result.parts.length, provider: result.providerId, fallback: result.fallback },
        };
      });
    } finally {
      typing(task.user_id, conv, false);
    }
  };

  const characterPart: TaskHandler = async (task) => {
    const loaded = loadActive(task);
    if (!loaded) return { status: 'cancelled', result: { reason: 'inactive' } };
    const p = payloadOf(task);
    const content = String(p.content ?? '').trim();
    if (!content) return { status: 'cancelled', result: { reason: 'empty' } };
    return ctx.db.transaction(() => {
      assertOwned(task);
      const conv = ctx.conversations.getRow(loaded.conv.id)!;
      const message = ctx.messages.insertFromCharacter(
        task.user_id,
        conv,
        content,
        p.origin === 'simulation' ? 'simulation' : 'character_reply',
        `task:${String(p.parentTaskId)}:${Number(p.index)}`,
        (p.meta as Record<string, unknown>) ?? {},
      );
      if (!p.last) ctx.db.afterCommit(() => typing(task.user_id, conv, true));
      return { status: 'done' as const, result: { messageId: message?.id ?? null } };
    });
  };

  const characterInitiate: TaskHandler = async (task) => {
    const loaded = loadActive(task);
    const forced = Boolean(payloadOf(task).forced);
    // Un déclenchement manuel (démonstration, administration) passe outre la désactivation des messages spontanés.
    if (!loaded || (!forced && !loaded.character.automation.incomingEnabled)) {
      return { status: 'cancelled', result: { reason: 'disabled' } };
    }
    const { conv, character } = loaded;
    const now = ctx.clock.now();

    let purpose: GenerationPurpose = 'character_initiate';
    if (!forced) {
      if (ctx.tasks.findPending(dedupeKeys.characterReply(conv.id))) {
        return { status: 'done', result: { skipped: 'reply_pending' } };
      }
      const trailing = ctx.db.all<MessageRow>(
        `SELECT * FROM messages WHERE conversation_id = $c AND seq > $s AND status = 'sent' ORDER BY seq`,
        { c: conv.id, s: conv.last_user_seq },
      );
      if (trailing.length >= 2) return { status: 'done', result: { skipped: 'too_many_unanswered' } };
      const last = trailing[trailing.length - 1];
      if (last) {
        const waited = now - last.created_at;
        const a = character.automation;
        if (a.followupEnabled && hasQuestion(last.content) && waited >= ctx.settings.scaleMs(a.followupAfterMinutes * 60_000)) {
          purpose = 'character_followup';
        } else {
          return { status: 'done', result: { skipped: 'awaiting_user' } };
        }
      }
    }

    typing(task.user_id, conv, true);
    try {
      const maxParts = purpose === 'character_followup' ? 1 : character.automation.burstMax;
      const result = await ctx.ai.generate(ctx.ai.buildContext(purpose, conv, character, maxParts), { allowLocalFallback: true });
      await typingPause();
      return ctx.db.transaction(() => {
        assertOwned(task);
        const fresh = ctx.conversations.getRow(conv.id)!;
        const first = deliverCharacterParts(task, fresh, result, 'simulation');
        return { status: 'done' as const, result: { messageId: first?.id ?? null, purpose, parts: result.parts.length } };
      });
    } finally {
      typing(task.user_id, conv, false);
    }
  };

  const aiReply: TaskHandler = async (task) => {
    const conv = task.conversation_id ? ctx.conversations.getRow(task.conversation_id) : undefined;
    const character = task.character_id ? ctx.characters.findById(task.character_id) : null;
    if (!conv || !character || !character.isActive || character.ai.mode === 'off') {
      return { status: 'cancelled', result: { reason: 'ai_disabled' } };
    }
    const anchor = Number(payloadOf(task).anchorUserSeq ?? 0);
    // Contrôle n°1 (avant génération) : une réponse humaine a-t-elle déjà été envoyée ?
    if (conv.last_user_seq > anchor) return { status: 'superseded', result: { reason: 'manual_reply_detected' } };
    if (conv.auto_chain >= ctx.settings.get().maxAutoChain) return { status: 'cancelled', result: { reason: 'auto_chain_limit' } };
    const pending = ctx.db.all<MessageRow>(
      `SELECT * FROM messages WHERE conversation_id = $c AND seq > $s AND author_type = 'character' AND status = 'sent' ORDER BY seq`,
      { c: conv.id, s: anchor },
    );
    if (pending.length === 0) return { status: 'cancelled', result: { reason: 'nothing_to_answer' } };

    const mode = character.ai.mode;
    const verdict =
      mode === 'auto_with_exceptions'
        ? assessSensitivity(pending.map((m) => m.content), character.ai.excludedTopics)
        : { sensitive: false, reasons: [] as string[] };
    const asSuggestion = mode === 'suggest' || verdict.sensitive;

    const result = await ctx.ai.generate(ctx.ai.buildContext('user_proxy', conv, character, 1), {
      // Un message envoyé en mon nom n'est jamais produit par le repli local sans validation.
      allowLocalFallback: asSuggestion,
    });
    const content = result.parts.join('\n');

    return ctx.db.transaction(() => {
      assertOwned(task);
      // Contrôle n°2 (au moment d'écrire, dans la transaction) : aucune fenêtre de concurrence.
      const fresh = ctx.conversations.getRow(conv.id)!;
      if (fresh.last_user_seq > anchor) {
        ctx.logger.info('automation', 'Réponse manuelle détectée pendant la génération : réponse IA abandonnée', {
          conversationId: conv.id,
          taskId: task.id,
        });
        return { status: 'superseded' as const, result: { reason: 'manual_reply_detected_after_generation' } };
      }
      if (asSuggestion) {
        const reason = verdict.sensitive ? `Confirmation requise (${verdict.reasons.join(', ')})` : null;
        const suggestion = ctx.suggestions.create(task.user_id, {
          conversationId: conv.id,
          taskId: task.id,
          content,
          anchorUserSeq: anchor,
          reason,
        });
        ctx.notifications.create(task.user_id, {
          type: verdict.sensitive ? 'ai_confirmation' : 'ai_suggestion',
          conversationId: conv.id,
          title: verdict.sensitive
            ? `Confirmation requise pour répondre à ${character.fullName}`
            : `Réponse suggérée pour ${character.fullName}`,
          body: content,
        });
        return { status: 'done' as const, result: { suggestionId: suggestion.id, sensitive: verdict.sensitive, reasons: verdict.reasons } };
      }
      const message = ctx.messages.insertAiAuto(task.user_id, fresh, content, `task:${task.id}`);
      if (message) {
        ctx.notifications.create(task.user_id, {
          type: 'ai_auto_sent',
          conversationId: conv.id,
          messageId: message.id,
          title: `L'IA a répondu à ${character.fullName} à votre place`,
          body: content,
        });
        ctx.automation.scheduleCharacterReply(task.user_id, conv.id, message.seq);
      }
      return { status: 'done' as const, result: { messageId: message?.id ?? null, provider: result.providerId } };
    });
  };

  return {
    character_reply: characterReply,
    character_part: characterPart,
    character_initiate: characterInitiate,
    ai_reply: aiReply,
  };
}

export { LostOwnership };
