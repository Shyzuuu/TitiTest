import clsx from 'clsx';
import { Bot, PenLine, Search, Sparkles, X } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { get } from '../../lib/api';
import { formatListTime } from '../../lib/format';
import type { Character, ConversationSummary, Draft, Message } from '../../lib/types';
import { useStore } from '../../store/store';
import { Avatar } from '../ui/Avatar';
import { Logo } from '../layout/AppShell';

interface RowProps {
  conversation: ConversationSummary;
  character: Character | undefined;
  active: boolean;
  draft: Draft | undefined;
  typing: boolean;
  flashAt: number | undefined;
  hasSuggestion: boolean;
}

const Row = memo(function Row({ conversation: c, character, active, draft, typing, flashAt, hasSuggestion }: RowProps) {
  const last = c.lastMessage;
  const prefix = last?.authorType === 'user' ? (last.origin === 'ai_auto' ? 'IA : ' : 'Vous : ') : '';
  // L'animation est rejouée à chaque nouveau message entrant grâce à la clé.
  const fresh = flashAt && Date.now() - flashAt < 2000;
  return (
    <Link
      to={`/chats/${c.id}`}
      data-testid="conversation-row"
      data-conversation-id={c.id}
      data-character-name={character?.firstName}
      aria-current={active ? 'page' : undefined}
      key={fresh ? flashAt : 'row'}
      className={clsx(
        'group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition',
        active ? 'bg-accent/15' : 'hover:bg-raised',
        fresh && !active && 'animate-flash',
      )}
    >
      <Avatar character={character} size={46} showStatus />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={clsx('truncate text-[15px]', c.unreadCount ? 'font-semibold text-ink' : 'font-medium')}>
            {character?.fullName ?? 'Contact'}
            {character && !character.isActive && <span className="ml-1 text-xs font-normal text-faint">(désactivé)</span>}
          </span>
          {c.lastMessageAt && (
            <span className={clsx('shrink-0 text-xs', c.unreadCount ? 'font-semibold text-accent' : 'text-faint')}>
              {formatListTime(c.lastMessageAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm text-muted">
            {typing ? (
              <span className="text-accent">écrit…</span>
            ) : draft && !active ? (
              <>
                <span className="text-danger">Brouillon : </span>
                {draft.content || '(citation)'}
              </>
            ) : last ? (
              last.deleted ? (
                <span className="italic">Message supprimé</span>
              ) : (
                `${prefix}${last.preview}`
              )
            ) : (
              <span className="italic text-faint">Aucun message — dites bonjour !</span>
            )}
          </span>
          {hasSuggestion && <Sparkles size={14} className="shrink-0 text-warn" aria-label="Suggestion IA en attente" />}
          {c.pendingAiReply && <Bot size={14} className="shrink-0 text-accent" aria-label="Réponse IA programmée" />}
          {draft && !active && <PenLine size={13} className="shrink-0 text-faint" aria-hidden />}
          {c.unreadCount > 0 && (
            <span data-testid="unread-badge" className="min-w-[20px] animate-pop rounded-full bg-accent px-1.5 text-center text-xs font-semibold leading-5 text-accent-ink">
              {c.unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
});

interface SearchResult extends Message {
  characterId: string;
}

export function ConversationList({ activeId }: { activeId: string | null }) {
  const conversations = useStore((s) => s.conversations);
  const characters = useStore((s) => s.characters);
  const drafts = useStore((s) => s.drafts);
  const typing = useStore((s) => s.typing);
  const flash = useStore((s) => s.flash);
  const suggestions = useStore((s) => s.suggestions);
  const me = useStore((s) => s.me);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const searchSeq = useRef(0);
  const [, setTick] = useState(0);

  // Rafraîchit les heures relatives et l'expiration des indicateurs de frappe.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(async () => {
      try {
        const res = await get<{ results: SearchResult[] }>('/search', { q });
        if (seq === searchSeq.current) setResults(res.results.slice(0, 20));
      } catch {
        if (seq === searchSeq.current) setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(conversations)
      .filter((c) => {
        if (!q) return true;
        const ch = characters[c.characterId];
        return ch ? ch.fullName.toLowerCase().includes(q) : false;
      })
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt) - (a.lastMessageAt ?? a.createdAt));
  }, [conversations, characters, query]);

  const now = Date.now();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 px-4 pb-2 pt-4">
        <span className="md:hidden">
          <Logo size={32} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold leading-tight">Messages</h1>
          {me && <div className="truncate text-xs text-muted">Connecté en tant que {me.displayName}</div>}
        </div>
      </div>
      <div className="px-3 pb-2">
        <label className="relative block">
          <span className="sr-only">Rechercher une personne ou un message</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            className="input rounded-full pl-9 pr-9"
            placeholder="Rechercher une personne ou un message"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:text-ink" aria-label="Effacer la recherche" onClick={() => setQuery('')}>
              <X size={14} />
            </button>
          )}
        </label>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {sorted.map((c) => (
          <Row
            key={c.id}
            conversation={c}
            character={characters[c.characterId]}
            active={c.id === activeId}
            draft={drafts[c.id]}
            typing={(typing[c.id] ?? 0) > now}
            flashAt={flash[c.id]}
            hasSuggestion={Boolean(suggestions[c.id])}
          />
        ))}
        {sorted.length === 0 && !results.length && <p className="px-3 py-6 text-center text-sm text-muted">Aucune conversation trouvée.</p>}
        {results.length > 0 && (
          <div className="mt-3">
            <div className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-faint">Messages</div>
            {results.map((m) => {
              const ch = characters[m.characterId];
              return (
                <button
                  key={m.id}
                  className="flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left hover:bg-raised"
                  onClick={() => {
                    setQuery('');
                    navigate(`/chats/${m.conversationId}?m=${m.id}`);
                  }}
                >
                  <Avatar character={ch} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2 text-xs text-muted">
                      <span className="truncate">{m.authorType === 'user' ? `Vous → ${ch?.firstName ?? ''}` : ch?.fullName}</span>
                      <span>{formatListTime(m.createdAt)}</span>
                    </span>
                    <span className="line-clamp-2 text-sm">{m.content}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
