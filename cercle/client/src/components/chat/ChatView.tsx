import clsx from 'clsx';
import { ArrowDown, ArrowLeft, Bot, Loader2, PanelRight, Sparkles } from 'lucide-react';
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatCountdown, formatDaySeparator, sameDay } from '../../lib/format';
import type { Message, QuotedMessage } from '../../lib/types';
import { useStore } from '../../store/store';
import { Avatar, STATUS_LABEL } from '../ui/Avatar';
import { Composer, type ComposerHandle } from './Composer';
import { MessageBubble, PendingBubble, type QuoteTarget } from './MessageBubble';
import { SuggestionBar } from './SuggestionBar';

const NEAR_BOTTOM_PX = 140;
const GROUP_WINDOW_MS = 5 * 60_000;
/** Position de lecture mémorisée par conversation : retrouvée telle quelle au retour. */
const scrollMemory = new Map<string, { atBottom: boolean; top: number }>();

const EMPTY: Message[] = [];

function useNow(intervalMs: number, enabled: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}

export function ChatView({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const conversation = useStore((s) => s.conversations[conversationId]);
  const character = useStore((s) => (conversation ? s.characters[conversation.characterId] : undefined));
  const conv = useStore((s) => s.messages[conversationId]);
  const outbox = useStore((s) => s.outbox);
  const typingUntil = useStore((s) => s.typing[conversationId] ?? 0);
  const suggestion = useStore((s) => s.suggestions[conversationId]);
  const settings = useStore((s) => s.settings);
  const infoOpen = useStore((s) => s.infoPanelOpen || s.infoOverlayOpen);
  const { loadMessages, setActiveConversation, markRead, setDraft, retryMessage, discardFailed, deleteMessage, toggleInfoPanel, pushToast } =
    useStore.getState();

  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const atBottom = useRef(true);
  const prevHeight = useRef<number | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  const messages = useMemo(() => (conv ? conv.ids.map((id) => conv.byId[id]!) : EMPTY), [conv]);
  const pending = useMemo(() => Object.values(outbox).filter((o) => o.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt), [outbox, conversationId]);
  const now = useNow(1000, Boolean(conversation?.pendingAiReply) || typingUntil > Date.now());
  const typing = typingUntil > now;

  // Conversation active : utilisée pour la lecture automatique, jamais modifiée par un événement entrant.
  useEffect(() => {
    setActiveConversation(conversationId);
    return () => {
      if (useStore.getState().activeConversationId === conversationId) setActiveConversation(null);
    };
  }, [conversationId, setActiveConversation]);

  useEffect(() => {
    if (!conv?.loaded && !conv?.loading) void loadMessages(conversationId);
  }, [conversationId, conv?.loaded, conv?.loading, loadMessages]);

  useEffect(() => {
    if (!conv?.loaded || !conversation?.unreadCount) return;
    if (document.visibilityState === 'visible') void markRead(conversationId);
  }, [conv?.loaded, conversation?.unreadCount, conversationId, markRead]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && useStore.getState().conversations[conversationId]?.unreadCount) void markRead(conversationId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [conversationId, markRead]);

  // Restauration de la position de lecture propre à cette conversation.
  const restored = useRef(false);
  useLayoutEffect(() => {
    restored.current = false;
  }, [conversationId]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !conv?.loaded || restored.current) return;
    restored.current = true;
    const saved = scrollMemory.get(conversationId);
    if (saved && !saved.atBottom) {
      el.scrollTop = saved.top;
      atBottom.current = false;
    } else {
      el.scrollTop = el.scrollHeight;
      atBottom.current = true;
    }
  }, [conversationId, conv?.loaded]);

  // Nouveau contenu : on reste collé en bas si l'on y était ; chargement d'anciens messages : position conservée.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !restored.current) return;
    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }
    if (atBottom.current) el.scrollTop = el.scrollHeight;
    else setShowJump(true);
  }, [messages.length, pending.length, typing, suggestion?.id]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
    atBottom.current = bottom;
    scrollMemory.set(conversationId, { atBottom: bottom, top: el.scrollTop });
    if (bottom) setShowJump(false);
    if (el.scrollTop < 80 && conv?.hasMore && !conv.loading) {
      prevHeight.current = el.scrollHeight;
      void loadMessages(conversationId, true);
    }
  };

  const scrollToBottom = () => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setShowJump(false);
  };

  /** Retrouve un message (citation, recherche, notification), en chargeant l'historique si besoin. */
  const jumpTo = useCallback(
    async (messageId: string) => {
      for (let i = 0; i < 40; i++) {
        const state = useStore.getState().messages[conversationId];
        if (state?.byId[messageId]) break;
        if (!state?.loaded) {
          await loadMessages(conversationId);
          continue;
        }
        if (!state.hasMore) break;
        prevHeight.current = scroller.current?.scrollHeight ?? null;
        await loadMessages(conversationId, true);
      }
      const found = useStore.getState().messages[conversationId]?.byId[messageId];
      if (!found) {
        pushToast({ kind: 'info', title: 'Message introuvable', body: 'Le message cité n’est plus disponible.' });
        return;
      }
      requestAnimationFrame(() => {
        const node = document.getElementById(`msg-${messageId}`);
        node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        atBottom.current = false;
        setHighlight(messageId);
        setTimeout(() => setHighlight((h) => (h === messageId ? null : h)), 2200);
      });
    },
    [conversationId, loadMessages, pushToast],
  );

  const target = params.get('m');
  useEffect(() => {
    if (!target || !conv?.loaded) return;
    void jumpTo(target);
    const next = new URLSearchParams(params);
    next.delete('m');
    setParams(next, { replace: true });
  }, [target, conv?.loaded, jumpTo, params, setParams]);

  const onReply = useCallback(
    (t: QuoteTarget) => {
      setDraft(conversationId, { replyToMessageId: t.id });
      composer.current?.focus();
    },
    [conversationId, setDraft],
  );
  const onDelete = useCallback((id: string) => void deleteMessage(id), [deleteMessage]);

  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-muted" data-testid="chat-missing">
        Conversation introuvable.
      </div>
    );
  }

  const name = character?.fullName ?? 'Contact';
  const ai = conversation.pendingAiReply;
  const aiMode = character?.ai.mode ?? 'off';
  const effectiveDelay =
    character && settings?.simulationSpeed === 'demo' ? Math.max(1, Math.round(character.ai.delaySeconds / settings.demoDivisor)) : character?.ai.delaySeconds;

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-bg" data-testid="chat-view" data-conversation-id={conversationId} aria-label={`Conversation avec ${name}`}>
      <header className="flex min-h-[64px] shrink-0 items-center gap-2 border-b border-line bg-panel px-2 sm:px-4">
        <button className="icon-btn md:hidden" aria-label="Retour aux conversations" data-testid="back-button" onClick={() => navigate('/chats')}>
          <ArrowLeft size={20} />
        </button>
        <button className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left hover:bg-raised/60" onClick={() => toggleInfoPanel(true)}>
          <Avatar character={character} size={40} showStatus />
          <span className="min-w-0">
            <span className="block truncate font-semibold" data-testid="chat-title">
              {name}
            </span>
            <span className="block truncate text-xs text-muted">
              {typing ? (
                <span className="text-accent">en train d’écrire…</span>
              ) : character ? (
                character.isActive ? STATUS_LABEL[character.status] : 'Personnage désactivé'
              ) : null}
            </span>
          </span>
        </button>
        {ai && (
          <span className="hidden items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent sm:inline-flex" data-testid="ai-countdown">
            <Bot size={14} />
            {ai.status === 'running' ? 'IA en cours…' : `IA dans ${formatCountdown(ai.runAt - now)}`}
          </span>
        )}
        {!ai && aiMode !== 'off' && (
          <span className="hidden items-center gap-1 rounded-full bg-raised px-2.5 py-1 text-xs text-muted lg:inline-flex" title="Mode IA de cette conversation">
            <Sparkles size={13} />
            {aiMode === 'suggest' ? 'Suggestion' : aiMode === 'auto' ? 'Auto' : 'Auto + exceptions'} · {effectiveDelay} s
          </span>
        )}
        <button
          className={clsx('icon-btn', infoOpen && 'xl:bg-raised xl:text-ink')}
          aria-label="Afficher les informations"
          aria-pressed={infoOpen}
          onClick={() => toggleInfoPanel()}
        >
          <PanelRight size={19} />
        </button>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={scroller} onScroll={onScroll} className="scroll-thin absolute inset-0 overflow-y-auto px-3 pb-4 sm:px-6" data-testid="message-scroller">
          {conv?.hasMore && (
            <div className="flex justify-center py-3">
              <button
                className="btn-ghost text-xs"
                disabled={conv.loading}
                onClick={() => {
                  prevHeight.current = scroller.current?.scrollHeight ?? null;
                  void loadMessages(conversationId, true);
                }}
              >
                {conv.loading ? <Loader2 size={14} className="animate-spin" /> : null} Messages précédents
              </button>
            </div>
          )}
          {!conv?.loaded && (
            <div className="flex justify-center py-10 text-muted">
              <Loader2 className="animate-spin" />
            </div>
          )}
          {conv?.loaded && messages.length === 0 && pending.length === 0 && (
            <div className="mx-auto mt-10 max-w-sm text-center text-sm text-muted">
              <Avatar character={character} size={72} className="mx-auto mb-3" />
              <div className="font-medium text-ink">{name}</div>
              <p className="mt-1">{character?.description}</p>
              <p className="mt-3 text-xs">Envoyez le premier message — vous pouvez en envoyer plusieurs à la suite.</p>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
            const grouped = !newDay && prev?.authorType === m.authorType && m.createdAt - prev.createdAt < GROUP_WINDOW_MS && !m.replyTo;
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <div className="sticky top-1 z-10 my-3 flex justify-center">
                    <span className="rounded-full border border-line bg-panel/90 px-3 py-0.5 text-xs text-muted backdrop-blur">{formatDaySeparator(m.createdAt)}</span>
                  </div>
                )}
                <MessageBubble
                  message={m}
                  characterName={character?.firstName ?? 'Contact'}
                  grouped={grouped}
                  highlighted={highlight === m.id}
                  onReply={onReply}
                  onJump={(id) => void jumpTo(id)}
                  onDelete={onDelete}
                />
              </Fragment>
            );
          })}
          {pending.map((p) => {
            const q = p.replyToMessageId ? conv?.byId[p.replyToMessageId] : undefined;
            const quote: QuotedMessage | null = p.replyToMessageId
              ? q
                ? { id: q.id, authorType: q.authorType, content: q.content, deleted: q.status === 'deleted' }
                : { id: p.replyToMessageId, missing: true }
              : null;
            return (
              <PendingBubble
                key={p.clientId}
                message={p}
                quote={quote}
                characterName={character?.firstName ?? 'Contact'}
                onRetry={(id) => void retryMessage(id)}
                onDiscard={discardFailed}
                onJump={(id) => void jumpTo(id)}
              />
            );
          })}
          {typing && (
            <div className="mt-3 flex items-center gap-2" data-testid="typing-indicator" aria-live="polite">
              <div className="flex gap-1 rounded-2xl rounded-bl-md border border-line/60 bg-theirs px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-blink rounded-full bg-muted" style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </div>
              <span className="sr-only">{name} écrit</span>
            </div>
          )}
        </div>
        {showJump && (
          <button
            className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 animate-rise items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-lg"
            onClick={scrollToBottom}
          >
            <ArrowDown size={14} /> Nouveaux messages
          </button>
        )}
      </div>

      {suggestion && <SuggestionBar suggestion={suggestion} />}
      <Composer key={conversationId} ref={composer} conversationId={conversationId} characterName={character?.firstName ?? 'ce contact'} />
    </section>
  );
}
