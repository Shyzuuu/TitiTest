import clsx from 'clsx';
import { CornerUpLeft, SendHorizontal, X } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { useStore } from '../../store/store';

const MAX_LENGTH = 4000;
const coarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

export interface ComposerHandle {
  focus(): void;
}

interface Props {
  conversationId: string;
  characterName: string;
  disabled?: boolean;
}

/**
 * Zone de saisie liée à UNE conversation (montée avec une clé par conversation) :
 * texte et citation vivent dans le brouillon de cette conversation uniquement.
 */
export const Composer = forwardRef<ComposerHandle, Props>(function Composer({ conversationId, characterName, disabled }, ref) {
  const draft = useStore((s) => s.drafts[conversationId]);
  const quoted = useStore((s) => (draft?.replyToMessageId ? s.messages[conversationId]?.byId[draft.replyToMessageId] : undefined));
  const setDraft = useStore((s) => s.setDraft);
  const sendMessage = useStore((s) => s.sendMessage);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const content = draft?.content ?? '';
  const replyTo = draft?.replyToMessageId ?? null;

  useImperativeHandle(ref, () => ({ focus: () => textarea.current?.focus() }), []);

  useLayoutEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [content]);

  useEffect(() => {
    if (!coarsePointer) textarea.current?.focus();
  }, [conversationId]);

  const submit = () => {
    const text = content.trim();
    if (!text || disabled || text.length > MAX_LENGTH) return;
    // Identifiant de conversation figé ici : l'envoi part vers la conversation affichée au moment du clic.
    void sendMessage(conversationId, text, replyTo);
    setDraft(conversationId, { content: '', replyToMessageId: null });
    textarea.current?.focus();
  };

  const tooLong = content.length > MAX_LENGTH;
  return (
    <div className="shrink-0 border-t border-line bg-panel px-2 pb-2 pt-2 sm:px-4 safe-bottom">
      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-[3px] border-accent bg-raised px-3 py-2" data-testid="reply-preview">
          <CornerUpLeft size={16} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="text-xs font-semibold text-accent">
              {quoted ? (quoted.authorType === 'user' ? 'Réponse à votre message' : `Réponse à ${characterName}`) : 'Réponse à un message'}
            </div>
            <div className="truncate text-muted">
              {quoted ? (quoted.status === 'deleted' ? 'Le message cité n’est plus disponible.' : `« ${quoted.content} »`) : '…'}
            </div>
          </div>
          <button
            className="icon-btn h-8 w-8"
            aria-label="Annuler la réponse"
            data-testid="cancel-reply"
            onClick={() => setDraft(conversationId, { replyToMessageId: null })}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message à {characterName}</span>
          <textarea
            ref={textarea}
            data-testid="composer"
            rows={1}
            value={content}
            disabled={disabled}
            placeholder={disabled ? 'Conversation indisponible' : `Écrire à ${characterName}…`}
            onChange={(e) => setDraft(conversationId, { content: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !coarsePointer) {
                e.preventDefault();
                submit();
              }
              if (e.key === 'Escape' && replyTo) setDraft(conversationId, { replyToMessageId: null });
            }}
            className={clsx('input max-h-[180px] resize-none rounded-2xl py-2.5 text-[15px] leading-snug', tooLong && 'border-danger')}
          />
        </label>
        <button
          className="btn-primary h-11 w-11 shrink-0 rounded-full p-0"
          aria-label="Envoyer"
          data-testid="send-button"
          disabled={!content.trim() || disabled || tooLong}
          onClick={submit}
        >
          <SendHorizontal size={19} />
        </button>
      </div>
      {content.length > MAX_LENGTH * 0.9 && (
        <div className={clsx('mt-1 text-right text-xs', tooLong ? 'text-danger' : 'text-muted')}>
          {content.length} / {MAX_LENGTH}
        </div>
      )}
    </div>
  );
});
