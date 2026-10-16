import clsx from 'clsx';
import { FileClock, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Card, EmptyState, PageHeader, Segmented, TextInput } from '../components/ui';
import { formatDate, formatTime } from '../domain/dates';
import { useBankState, useMoney } from '../lib/hooks';

export default function Journal() {
  const state = useBankState();
  const money = useMoney();
  const [tab, setTab] = useState<'ops' | 'loans'>('ops');
  const [level, setLevel] = useState<'' | 'success' | 'info' | 'warning' | 'error'>('');
  const [q, setQ] = useState('');
  const logs = useMemo(() => state.simLog.filter((l) => (!level || l.level === level) && (!q || `${l.action} ${l.detail}`.toLowerCase().includes(q.toLowerCase()))), [state.simLog, level, q]);
  const events = useMemo(() => state.loanEvents.filter((e) => !q || e.description.toLowerCase().includes(q.toLowerCase())), [state.loanEvents, q]);
  const tone = { success: 'ok', info: 'info', warning: 'warn', error: 'danger' } as const;

  return (
    <div>
      <PageHeader title="Historique des opérations de simulation" icon={FileClock} subtitle="Journal technique de toutes les actions, y compris refusées, et historique complet des prêts. Rien n’y est jamais réécrit." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Segmented label="Journal" value={tab} onChange={setTab} options={[{ value: 'ops', label: `Opérations (${state.simLog.length})` }, { value: 'loans', label: `Événements de prêts (${state.loanEvents.length})` }]} />
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" className="pl-11" aria-label="Rechercher dans le journal" />
        </div>
      </div>
      {tab === 'ops' && (
        <div className="mb-4">
          <Segmented size="sm" label="Niveau" value={level} onChange={setLevel} options={[{ value: '', label: 'Tous' }, { value: 'success', label: 'Succès' }, { value: 'info', label: 'Info' }, { value: 'warning', label: 'Avertissements' }, { value: 'error', label: 'Refus' }]} />
        </div>
      )}
      <Card className="p-2 sm:p-4">
        {tab === 'ops' ? (
          logs.length ? (
            <ul className="divide-y divide-line">
              {logs.slice(0, 300).map((l) => (
                <li key={l.id} className="flex flex-wrap items-start gap-3 p-3">
                  <span className="w-24 shrink-0 text-xs text-muted">
                    {formatDate(l.date)}
                    <br />
                    {formatTime(l.date)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{l.action}</p>
                    <p className="text-sm text-muted">{l.detail}</p>
                  </div>
                  <Badge tone={tone[l.level]}>{{ success: 'Succès', info: 'Info', warning: 'Avertissement', error: 'Refusée' }[l.level]}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FileClock} title="Journal vide" />
          )
        ) : events.length ? (
          <ol className="relative ml-3 space-y-4 border-l-2 border-line py-2 pl-5">
            {events.map((e) => {
              const loan = e.loanId ? state.loans.find((l) => l.id === e.loanId) : undefined;
              const app = e.applicationId ? state.loanApplications.find((a) => a.id === e.applicationId) : undefined;
              return (
                <li key={e.id} className="relative">
                  <span className={clsx('absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface', e.kind === 'reversal' || e.kind === 'cancellation' ? 'bg-warn' : 'bg-brand')} />
                  <p className="text-sm font-semibold">
                    {e.status} · <span className="font-mono text-xs text-muted">{loan?.reference ?? app?.reference}</span>
                    {e.amount !== null && <span className="num text-muted"> · {money(e.amount)}</span>}
                  </p>
                  <p className="text-sm text-muted">{e.description}</p>
                  <p className="text-xs text-muted">{formatDate(e.date)} à {formatTime(e.date)}</p>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState icon={FileClock} title="Aucun événement de prêt" />
        )}
      </Card>
    </div>
  );
}
