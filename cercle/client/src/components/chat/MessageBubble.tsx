import clsx from 'clsx';
import { AlertCircle, Bot, Check, CheckCheck, Clock, Copy, CornerUpLeft, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import { formatFull, formatTime } from '../../lib/format';
import type { Message, OutgoingMessage, QuotedMessage } from '../../lib/types';

export interface QuoteTarget {
  id: string;
  authorType: 'user' | 'character';
  content: string;
}

interface QuoteProps {
  quote: QuotedMessage;
  mine: boolean;
  characterName: string;
  onJump(id: string): void;
}

function Quote({ quote, mine, characterName, onJump }: QuoteProps) {
  const unavailable = quote.missing || quote.deleted;
  const author = quote.authorType === 'user' ? 'Vous' : characterName;
  return (
    <button
      type="button"
      data-testid="quote"
      onClick={(e) => {
        e.stopPropagation();
        onJump(quote.id);
      }}
      className={clsx(
        'mb-1.5 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left text-xs transition',
        mine ? 'border-white/70 bg-black/15 hover:bg-black/25' : 'border-accent bg-raised hover:bg-line/60',
      )}
    >
      {unavailable ? (
        <span className="italic opacity-80">Le message cité n’est plus disponible.</span>
      ) : (
        <>
          <span className={clsx('block font-semibold', mine ? 'text-white/90' : 'text-accent')}>{author}</span>
          <span className="line-clamp-2 opacity-90">{quote.content}</span>
        </>
      )}
    </button>
  );
}

interface Props {
  message: Message;
  characterName: string;
  grouped: boolean;
  highlighted: boolean;
  onReply(target: QuoteTarget): void;
  onJump(id: string): void;
  onDelete(id: string): void;
}

const ORIGIN_BADGE: Partial<Record<Message['origin'], { label: string; icon: typeof Bot }>> = {
  ai_auto: { label: 'Envoyé par l’IA', icon: Bot },
  ai_suggestion: { label: 'Suggestion IA validée', icon: Sparkles },
};

export const MessageBubble = memo(function MessageBubble({ message: m, characterName, grouped, highlighted, onReply, onJump, onDelete }: Props) {
  const mine = m.authorType === 'user';
  const deleted = m.status === 'deleted';
  const [actionsOpen, setActionsOpen] = useState(false);
  const badge = ORIGIN_BADGE[m.origin];

  return (
    <div
      id={`msg-${m.id}`}
      data-testid="message"
      data-message-id={m.id}
      data-author={m.authorType}
      className={clsx('group flex w-full', mine ? 'justify-end' : 'justify-start', grouped ? 'mt-0.5' : 'mt-3')}
    >
      <div className={clsx('flex max-w-[85%] items-end gap-1 sm:max-w-[72%]', mine ? 'flex-row-reverse' : 'flex-row')}>
        <div
          onClick={() => setActionsOpen((v) => !v)}
          className={clsx(
            'relative min-w-[64px] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm transition',
            mine ? 'bg-mine text-mine-ink' : 'border border-line/60 bg-theirs text-ink',
            mine ? (grouped ? 'rounded-tr-md' : 'rounded-br-md') : grouped ? 'rounded-tl-md' : 'rounded-bl-md',
            highlighted && 'ring-2 ring-warn ring-offset-2 ring-offset-bg',
          )}
        >
          {badge && (
            <span className={clsx('mb-1 flex items-center gap-1 text-[11px] font-medium', mine ? 'text-white/80' : 'text-accent')}>
              <badge.icon size={12} /> {badge.label}
            </span>
          )}
          {m.replyTo && <Quote quote={m.replyTo} mine={mine} characterName={characterName} onJump={onJump} />}
          {deleted ? (
            <span className="italic opacity-70">Message supprimé</span>
          ) : (
            <span className="whitespace-pre-wrap break-words" data-testid="message-text">
              {m.content}
            </span>
          )}
          <span className={clsx('ml-2 inline-flex translate-y-0.5 items-center gap-0.5 whitespace-nowrap align-bottom text-[11px]', mine ? 'text-white/70' : 'text-faint')} title={formatFull(m.createdAt)}>
            {formatTime(m.createdAt)}
            {mine && <CheckCheck size={13} aria-label="Envoyé" />}
          </span>
        </div>
        {!deleted && (
          <div
            className={clsx(
              'flex shrink-0 items-center gap-0.5 transition',
              actionsOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100',
              mine ? 'flex-row-reverse' : 'flex-row',
            )}
          >
            <button
              type="button"
              className="icon-btn h-8 w-8"
              title="Répondre"
              aria-label="Répondre à ce message"
              data-testid="reply-button"
              onClick={(e) => {
                e.stopPropagation();
                setActionsOpen(false);
                onReply({ id: m.id, authorType: m.authorType, content: m.content });
              }}
            >
              <CornerUpLeft size={16} />
            </button>
            <button
              type="button"
              className="icon-btn hidden h-8 w-8 sm:inline-flex"
              title="Copier"
              aria-label="Copier le texte"
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard?.writeText(m.content).catch(() => undefined);
              }}
            >
              <Copy size={15} />
            </button>
            {mine && (
              <button
                type="button"
                className="icon-btn h-8 w-8 hover:text-danger"
                title="Supprimer"
                aria-label="Supprimer ce message"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(m.id);
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

interface PendingProps {
  message: OutgoingMessage;
  quote: QuotedMessage | null;
  characterName: string;
  onRetry(clientId: string): void;
  onDiscard(clientId: string): void;
  onJump(id: string): void;
}

/** Message optimiste : affiché immédiatement, avec un état clair en cas d'échec. */
export function PendingBubble({ message: m, quote, characterName, onRetry, onDiscard, onJump }: PendingProps) {
  const failed = m.status === 'failed';
  return (
    <div className="mt-1 flex w-full justify-end" data-testid="pending-message" data-status={m.status}>
      <div className="flex max-w-[85%] flex-col items-end sm:max-w-[72%]">
        <div className={clsx('rounded-2xl rounded-br-md bg-mine px-3.5 py-2 text-[15px] leading-relaxed text-mine-ink', failed ? 'opacity-60' : 'opacity-80')}>
          {quote && <Quote quote={quote} mine characterName={characterName} onJump={onJump} />}
          <span className="whitespace-pre-wrap break-words">{m.content}</span>
          <span className="ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[11px] text-white/70">
            {failed ? <AlertCircle size={13} /> : <Clock size={12} className="animate-pulse" />}
          </span>
        </div>
        {failed && (
          <div className="mt-1 flex items-center gap-2 text-xs text-danger">
            <span>Échec de l’envoi{m.error ? ` (${m.error})` : ''}</span>
            <button className="inline-flex items-center gap-1 font-medium hover:underline" onClick={() => onRetry(m.clientId)}>
              <RotateCcw size={12} /> Réessayer
            </button>
            <button className="font-medium text-muted hover:underline" onClick={() => onDiscard(m.clientId)}>
              Supprimer
            </button>
          </div>
        )}
        {!failed && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-faint">
            <Check size={11} /> Envoi…
          </span>
        )}
      </div>
    </div>
  );
}
