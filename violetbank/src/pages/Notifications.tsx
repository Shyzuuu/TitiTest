import clsx from 'clsx';
import { Bell, BellOff, CheckCheck, CreditCard, ExternalLink, HandCoins, Landmark, PiggyBank, Receipt, Target, Trash2, Info } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, IconButton, PageHeader, Segmented } from '../components/ui';
import { formatDate, formatTime } from '../domain/dates';
import { deleteNotification, markAllNotificationsRead, markNotification } from '../domain/misc';
import type { NotificationKind } from '../domain/schema';
import { useBankState } from '../lib/hooks';
import { useBank } from '../store/bank';

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  transaction: Receipt,
  card: CreditCard,
  loan_application: HandCoins,
  loan_accepted: HandCoins,
  loan_refused: HandCoins,
  loan_activated: Landmark,
  loan_due: Landmark,
  loan_payment: Landmark,
  vault_goal: PiggyBank,
  budget: Target,
  system: Info,
};

export default function Notifications() {
  const state = useBankState();
  const update = useBank((s) => s.update);
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'unread' | 'loans'>('all');
  const list = state.notifications.filter((n) => (filter === 'unread' ? !n.read : filter === 'loans' ? n.kind.startsWith('loan') : true));
  const unread = state.notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        icon={Bell}
        subtitle={`${unread} non lue(s). Notifications internes à l’application : aucun SMS ni e-mail n’est envoyé.`}
        actions={
          <>
            <Button variant="secondary" icon={CheckCheck} disabled={!unread} onClick={() => update(markAllNotificationsRead)}>
              Tout marquer comme lu
            </Button>
            <Button variant="ghost" icon={Trash2} disabled={!state.notifications.length} onClick={() => update((s) => ({ ...s, notifications: [] }))}>
              Vider
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <Segmented label="Filtre" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Toutes' }, { value: 'unread', label: 'Non lues' }, { value: 'loans', label: 'Prêts' }]} />
      </div>
      {!state.settings.notifications && (
        <Card className="mb-4 flex items-center gap-3 p-4 text-sm">
          <BellOff size={18} className="text-muted" aria-hidden /> Les nouvelles notifications sont désactivées dans les paramètres.
        </Card>
      )}
      <Card className="p-2 sm:p-3">
        {list.length === 0 ? (
          <EmptyState icon={Bell} title="Aucune notification">Les événements de la simulation apparaîtront ici.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((n) => {
              const I = KIND_ICON[n.kind];
              return (
                <li key={n.id} className={clsx('flex items-start gap-3 rounded-2xl p-3', !n.read && 'bg-brand-soft/40')}>
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                    <I size={18} aria-hidden />
                    {!n.read && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand" aria-label="Non lue" />}
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      update((s) => markNotification(s, n.id, true));
                      if (n.link) navigate(n.link);
                    }}
                  >
                    <p className={clsx('font-semibold', !n.read && 'text-ink')}>{n.title}</p>
                    <p className="text-sm text-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(n.createdAt)} à {formatTime(n.createdAt)}
                      {n.link && <ExternalLink size={11} className="ml-1 inline" aria-hidden />}
                    </p>
                  </button>
                  <div className="flex shrink-0 flex-col">
                    <IconButton icon={CheckCheck} label={n.read ? 'Marquer comme non lue' : 'Marquer comme lue'} onClick={() => update((s) => markNotification(s, n.id, !n.read))} />
                    <IconButton icon={Trash2} label="Supprimer" onClick={() => update((s) => deleteNotification(s, n.id))} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
