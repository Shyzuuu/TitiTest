import { Download, Filter, History as HistoryIcon, Search, X } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TransactionList } from '../components/Transactions';
import { Button, Card, EmptyState, Field, PageHeader, Select, TextInput } from '../components/ui';
import { parseAmount } from '../domain/money';
import type { TxType } from '../domain/schema';
import { transactionsToCsv } from '../lib/download';
import { exportFile } from '../lib/native';
import { useBankState, useMoney, useToday } from '../lib/hooks';
import { TX_TYPE_LABEL } from '../lib/labels';
import { useUi } from '../store/ui';

const PAGE = 60;

export default function History() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const open = useUi((s) => s.openModal);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<'' | TxType | 'loans'>('');
  const [account, setAccount] = useState('');
  const [status, setStatus] = useState<'' | 'completed' | 'declined' | 'reversed'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toLowerCase());

  // Lien profond depuis une notification : ouvre le détail de l'opération.
  useEffect(() => {
    const id = params.get('tx');
    if (id) {
      open('transaction', { id });
      params.delete('tx');
      setParams(params, { replace: true });
    }
  }, [params, setParams, open]);

  const minC = min ? parseAmount(min) : null;
  const maxC = max ? parseAmount(max) : null;
  const amountError = (minC && !minC.ok ? minC.error : null) ?? (maxC && !maxC.ok ? maxC.error : null);

  const lo = minC?.ok ? minC.cents : null;
  const hi = maxC?.ok ? maxC.cents : null;
  const filtered = useMemo(() => {
    const accountNames = new Map(state.accounts.map((a) => [a.id, a.name.toLowerCase()]));
    return state.transactions.filter((t) => {
      if (type === 'loans' ? !t.loanId : type && t.type !== type) return false;
      if (account && t.accountId !== account) return false;
      if (status === 'declined' && t.status !== 'declined') return false;
      if (status === 'completed' && (t.status !== 'completed' || t.reversedBy)) return false;
      if (status === 'reversed' && !t.reversedBy && t.type !== 'reversal') return false;
      const day = t.date.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      const abs = Math.abs(t.amount);
      if (lo !== null && abs < lo) return false;
      if (hi !== null && abs > hi) return false;
      if (q && !`${t.label} ${t.note ?? ''} ${t.id} ${accountNames.get(t.accountId) ?? ''} ${TX_TYPE_LABEL[t.type]}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [state.transactions, state.accounts, type, account, status, from, to, lo, hi, q]);

  const active = [type, account, status, from, to, min, max, query].filter(Boolean).length;
  const reset = () => {
    setQuery('');
    setType('');
    setAccount('');
    setStatus('');
    setFrom('');
    setTo('');
    setMin('');
    setMax('');
  };
  const net = filtered.reduce((s, t) => s + (t.status === 'completed' ? t.amount : 0), 0);

  return (
    <div>
      <PageHeader
        title="Historique des transactions"
        icon={HistoryIcon}
        subtitle={`${filtered.length} opération(s) · solde net ${money(net, { signed: true })}`}
        actions={
          <Button variant="secondary" icon={Download} disabled={!filtered.length} onClick={() => void exportFile(`violetbank-historique-${today}.csv`, transactionsToCsv(state, filtered), 'text/csv;charset=utf-8')}>
            Export CSV
          </Button>
        }
      />
      <Card className="mb-5 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un libellé, une note, un identifiant…" className="pl-11" aria-label="Recherche textuelle" />
          </div>
          <Button variant={showFilters ? 'soft' : 'secondary'} icon={Filter} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <span className="hidden sm:inline">Filtres</span>
            {active > 0 && <span className="num rounded-full bg-brand px-1.5 text-xs text-white">{active}</span>}
          </Button>
        </div>
        {showFilters && (
          <div className="mt-4 grid animate-fade gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Type" htmlFor="f-type">
              <Select id="f-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="">Tous les types</option>
                <option value="loans">Toutes les opérations de prêt</option>
                {(Object.keys(TX_TYPE_LABEL) as TxType[]).map((k) => (
                  <option key={k} value={k}>
                    {TX_TYPE_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Compte" htmlFor="f-acc">
              <Select id="f-acc" value={account} onChange={(e) => setAccount(e.target.value)}>
                <option value="">Tous les comptes</option>
                {state.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.archived ? ' (archivé)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Statut" htmlFor="f-status">
              <Select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="">Tous les statuts</option>
                <option value="completed">Effectuées</option>
                <option value="declined">Refusées</option>
                <option value="reversed">Contrepassées / corrections</option>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Du" htmlFor="f-from">
                <TextInput id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </Field>
              <Field label="Au" htmlFor="f-to">
                <TextInput id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2">
              <Field label="Montant min." htmlFor="f-min" error={amountError}>
                <TextInput id="f-min" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0,00" />
              </Field>
              <Field label="Montant max." htmlFor="f-max">
                <TextInput id="f-max" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder="∞" />
              </Field>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button variant="ghost" icon={X} onClick={reset} disabled={!active}>
                Réinitialiser les filtres
              </Button>
            </div>
          </div>
        )}
      </Card>
      <Card className="p-3 sm:p-5">
        <TransactionList
          txs={filtered.slice(0, limit)}
          empty={
            <EmptyState icon={Search} title="Aucune opération" action={active ? <Button variant="secondary" onClick={reset}>Effacer les filtres</Button> : undefined}>
              {active ? 'Aucune opération ne correspond à ces critères.' : 'Les opérations fictives apparaîtront ici.'}
            </EmptyState>
          }
        />
        {filtered.length > limit && (
          <div className="mt-4 text-center">
            <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
              Afficher plus ({filtered.length - limit} restantes)
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
