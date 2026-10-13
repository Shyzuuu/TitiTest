import clsx from 'clsx';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CheckCheck,
  Filter,
  Inbox,
  Mail,
  MailOpen,
  MessageCircleReply,
  Search,
  Send,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Avatar } from '../components/ui/Avatar';
import { Empty } from '../components/ui/Empty';
import { ConfirmDialog } from '../components/ui/Modal';
import { del, errorText, get, post } from '../lib/api';
import { formatFull, formatListTime } from '../lib/format';
import type { MailboxCounts, MailboxEntry, MailboxView } from '../lib/types';
import { useStore } from '../store/store';

const VIEWS: Array<{ id: MailboxView; label: string; icon: typeof Inbox }> = [
  { id: 'inbox', label: 'Boîte de réception', icon: Inbox },
  { id: 'unread', label: 'Non lus', icon: Mail },
  { id: 'read', label: 'Lus', icon: MailOpen },
  { id: 'sent', label: 'Envoyés', icon: Send },
  { id: 'archive', label: 'Archives', icon: Archive },
  { id: 'trash', label: 'Corbeille', icon: Trash2 },
];

const isView = (v: string | undefined): v is MailboxView => VIEWS.some((x) => x.id === v);

interface Filters {
  q: string;
  characterId: string;
  from: string;
  to: string;
}

/**
 * Boîte mail virtuelle : une vue sur les messages (identifiant unique par message),
 * avec son propre classement. Supprimer ici ne touche jamais la conversation.
 */
export function MailPage() {
  const params = useParams();
  const view: MailboxView = isView(params.view) ? params.view : 'inbox';
  const entryId = params.entryId ?? null;
  const navigate = useNavigate();
  const characters = useStore((s) => s.characters);
  const version = useStore((s) => s.mailboxVersion);
  const counts = useStore((s) => s.mailboxCounts);
  const pushToast = useStore((s) => s.pushToast);
  const [items, setItems] = useState<MailboxEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ q: '', characterId: '', from: '', to: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<MailboxEntry | null>(null);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const requestSeq = useRef(0);

  const query = useCallback(
    (before?: number) => ({
      view,
      q: filters.q.trim() || undefined,
      characterId: filters.characterId || undefined,
      from: filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : undefined,
      before,
      limit: 50,
    }),
    [view, filters],
  );

  // Rechargement sur changement de dossier, de filtre ou d'événement boîte mail.
  useEffect(() => {
    const seq = ++requestSeq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await get<{ items: MailboxEntry[]; hasMore: boolean; counts: MailboxCounts }>('/mailbox', query());
        if (seq !== requestSeq.current) return;
        setItems(res.items);
        setHasMore(res.hasMore);
        useStore.setState({ mailboxCounts: res.counts });
      } catch (err) {
        if (seq === requestSeq.current) pushToast({ kind: 'error', title: 'Boîte mail indisponible', body: errorText(err) });
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query, version, pushToast]);

  // Ouverture d'un élément : lecture complète et marquage « lu » persistant.
  useEffect(() => {
    if (!entryId) {
      setSelected(null);
      return;
    }
    let alive = true;
    get<{ entry: MailboxEntry }>(`/mailbox/${entryId}`)
      .then(async ({ entry }) => {
        if (!alive) return;
        setSelected(entry);
        if (entry.direction === 'in' && !entry.read) {
          const res = await post<{ entry: MailboxEntry }>(`/mailbox/${entry.id}/actions`, { action: 'mark_read' });
          if (alive) setSelected(res.entry);
        }
      })
      .catch(() => alive && setSelected(null));
    return () => {
      alive = false;
    };
  }, [entryId, version]);

  const act = async (entry: MailboxEntry, action: string) => {
    try {
      const res = await post<{ entry: MailboxEntry }>(`/mailbox/${entry.id}/actions`, { action });
      setSelected((s) => (s?.id === entry.id ? res.entry : s));
      if (['archive', 'unarchive', 'trash', 'restore'].includes(action)) navigate(`/mail/${view}`);
    } catch (err) {
      pushToast({ kind: 'error', title: 'Action impossible', body: errorText(err) });
    }
  };

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    const res = await get<{ items: MailboxEntry[]; hasMore: boolean }>('/mailbox', query(last.createdAt));
    setItems((cur) => [...cur, ...res.items.filter((i) => !cur.some((c) => c.id === i.id))]);
    setHasMore(res.hasMore);
  };

  const countFor = (id: MailboxView) => (id === 'inbox' || id === 'unread' ? counts.unread : id === 'trash' ? counts.trash : 0);
  const filtering = Boolean(filters.q || filters.characterId || filters.from || filters.to);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Dossiers (colonne sur ordinateur, onglets défilants sur mobile) */}
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-line bg-panel p-3 lg:flex">
        <div className="mb-2 px-2 text-lg font-semibold">Boîte mail</div>
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => navigate(`/mail/${v.id}`)}
            className={clsx('flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition', view === v.id ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-raised hover:text-ink')}
          >
            <v.icon size={17} />
            <span className="flex-1 text-left">{v.label}</span>
            {countFor(v.id) > 0 && <span className="text-xs font-semibold">{countFor(v.id)}</span>}
          </button>
        ))}
        <button className="btn-ghost mt-auto justify-start text-xs" onClick={() => void post('/mailbox/read-all')}>
          <CheckCheck size={15} /> Tout marquer comme lu
        </button>
      </aside>

      <div className={clsx('min-h-0 min-w-0 flex-1 flex-col border-r border-line bg-panel md:max-w-md lg:max-w-sm xl:max-w-md', selected ? 'hidden md:flex' : 'flex')}>
        <div className="flex items-center gap-2 px-3 pt-3 lg:hidden">
          <h1 className="flex-1 text-lg font-semibold">Boîte mail</h1>
        </div>
        <div className="scroll-thin flex gap-1.5 overflow-x-auto px-3 pt-2 lg:hidden" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => navigate(`/mail/${v.id}`)}
              className={clsx('shrink-0 rounded-full px-3 py-1.5 text-xs font-medium', view === v.id ? 'bg-accent text-accent-ink' : 'bg-raised text-muted')}
            >
              {v.label}
              {countFor(v.id) > 0 && ` · ${countFor(v.id)}`}
            </button>
          ))}
        </div>
        <div className="flex gap-2 p-3">
          <label className="relative block flex-1">
            <span className="sr-only">Rechercher dans la boîte mail</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input
              className="input rounded-full pl-9"
              placeholder="Expéditeur ou contenu"
              data-testid="mail-search"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </label>
          <button className={clsx('icon-btn', (showFilters || filtering) && 'bg-raised text-accent')} aria-label="Filtres" onClick={() => setShowFilters((v) => !v)}>
            <Filter size={17} />
          </button>
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 gap-2 px-3 pb-3">
            <select className="input col-span-2" value={filters.characterId} onChange={(e) => setFilters((f) => ({ ...f, characterId: e.target.value }))} aria-label="Expéditeur">
              <option value="">Tous les contacts</option>
              {Object.values(characters).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
            <label className="text-xs text-muted">
              Du
              <input type="date" className="input mt-1" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
            </label>
            <label className="text-xs text-muted">
              Au
              <input type="date" className="input mt-1" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
            </label>
            {filtering && (
              <button className="btn-ghost col-span-2 text-xs" onClick={() => setFilters({ q: '', characterId: '', from: '', to: '' })}>
                <X size={14} /> Réinitialiser les filtres
              </button>
            )}
          </div>
        )}
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {!loading && items.length === 0 && (
            <Empty icon={<Inbox size={24} />} title={filtering ? 'Aucun résultat' : 'Rien ici'}>
              {filtering ? 'Modifiez vos critères de recherche.' : 'Les messages des personnages arrivent aussi dans cette boîte.'}
            </Empty>
          )}
          {items.map((e) => {
            const ch = characters[e.characterId];
            const unread = e.direction === 'in' && !e.read;
            return (
              <button
                key={e.id}
                data-testid="mail-item"
                data-unread={unread}
                onClick={() => navigate(`/mail/${view}/${e.id}`)}
                className={clsx(
                  'flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition',
                  entryId === e.id ? 'bg-accent/15' : 'hover:bg-raised',
                )}
              >
                <Avatar character={ch} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={clsx('truncate text-sm', unread ? 'font-semibold' : 'text-muted')}>
                      {e.direction === 'out' ? `À : ${ch?.fullName ?? '—'}` : ch?.fullName ?? 'Contact'}
                    </span>
                    <span className={clsx('shrink-0 text-xs', unread ? 'font-semibold text-accent' : 'text-faint')}>{formatListTime(e.createdAt)}</span>
                  </span>
                  <span className={clsx('block truncate text-sm', unread && 'font-medium')}>{e.messageDeleted ? 'Message supprimé' : e.subject}</span>
                  <span className="block truncate text-xs text-faint">{e.preview}</span>
                </span>
                {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Non lu" />}
              </button>
            );
          })}
          {hasMore && (
            <button className="btn-ghost mx-auto mt-2 flex text-xs" onClick={() => void loadMore()}>
              Charger plus
            </button>
          )}
        </div>
      </div>

      <div className={clsx('min-h-0 min-w-0 flex-1 flex-col bg-bg', selected ? 'flex' : 'hidden md:flex')}>
        {selected ? (
          <article className="flex min-h-0 flex-1 flex-col" data-testid="mail-detail">
            <header className="flex min-h-[60px] shrink-0 items-center gap-1 border-b border-line bg-panel px-2 sm:px-4">
              <button className="icon-btn md:hidden" aria-label="Retour à la liste" onClick={() => navigate(`/mail/${view}`)}>
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1" />
              {selected.direction === 'in' && (
                <button className="icon-btn" title={selected.read ? 'Marquer comme non lu' : 'Marquer comme lu'} aria-label={selected.read ? 'Marquer comme non lu' : 'Marquer comme lu'} onClick={() => void act(selected, selected.read ? 'mark_unread' : 'mark_read')}>
                  {selected.read ? <Mail size={18} /> : <MailOpen size={18} />}
                </button>
              )}
              {selected.folder === 'archive' ? (
                <button className="icon-btn" title="Désarchiver" aria-label="Désarchiver" onClick={() => void act(selected, 'unarchive')}>
                  <ArchiveRestore size={18} />
                </button>
              ) : selected.folder !== 'trash' ? (
                <button className="icon-btn" title="Archiver" aria-label="Archiver" onClick={() => void act(selected, 'archive')}>
                  <Archive size={18} />
                </button>
              ) : null}
              {selected.folder === 'trash' ? (
                <>
                  <button className="icon-btn" title="Restaurer" aria-label="Restaurer" onClick={() => void act(selected, 'restore')}>
                    <Undo2 size={18} />
                  </button>
                  <button className="icon-btn hover:text-danger" title="Supprimer définitivement" aria-label="Supprimer définitivement" onClick={() => setConfirmPurge(true)}>
                    <Trash2 size={18} />
                  </button>
                </>
              ) : (
                <button className="icon-btn hover:text-danger" title="Mettre à la corbeille" aria-label="Mettre à la corbeille" onClick={() => void act(selected, 'trash')}>
                  <Trash2 size={18} />
                </button>
              )}
            </header>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
              <div className="mx-auto max-w-2xl">
                <h2 className="mb-4 break-words text-xl font-semibold">{selected.messageDeleted ? 'Message supprimé' : selected.subject}</h2>
                <div className="mb-6 flex items-center gap-3">
                  <Avatar character={characters[selected.characterId]} size={44} />
                  <div className="min-w-0">
                    <div className="font-medium">
                      {selected.direction === 'in' ? characters[selected.characterId]?.fullName : 'Vous'}
                      <span className="text-sm font-normal text-muted"> → {selected.direction === 'in' ? 'Vous' : characters[selected.characterId]?.fullName}</span>
                    </div>
                    <div className="text-xs text-muted">{formatFull(selected.createdAt)}</div>
                  </div>
                </div>
                <div className="card whitespace-pre-wrap break-words p-5 text-[15px] leading-relaxed">
                  {selected.messageDeleted ? <span className="italic text-muted">Ce message a été supprimé de la conversation.</span> : selected.content}
                </div>
                <button
                  className="btn-primary mt-6"
                  data-testid="reply-in-conversation"
                  onClick={() => navigate(`/chats/${selected.conversationId}?m=${selected.messageId}`)}
                >
                  <MessageCircleReply size={16} /> Répondre dans la conversation
                </button>
              </div>
            </div>
          </article>
        ) : (
          <Empty icon={<Mail size={26} />} title="Sélectionnez un message">
            Chaque message reçu d’un personnage arrive aussi ici. « Répondre dans la conversation » ouvre directement la discussion.
          </Empty>
        )}
      </div>
      <ConfirmDialog
        open={confirmPurge}
        title="Supprimer définitivement"
        message="L’élément sera retiré de la boîte mail. Le message reste visible dans la conversation."
        confirmLabel="Supprimer"
        danger
        onClose={() => setConfirmPurge(false)}
        onConfirm={async () => {
          if (!selected) return;
          await del(`/mailbox/${selected.id}`);
          navigate(`/mail/${view}`);
        }}
      />
    </div>
  );
}
