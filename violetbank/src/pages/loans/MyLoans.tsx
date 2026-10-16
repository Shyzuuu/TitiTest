import { Landmark, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProductIcon, SimulationDisclaimer, UnifiedStatusBadge } from '../../components/LoanParts';
import { Button, Card, EmptyState, PageHeader, Select, TextInput } from '../../components/ui';
import { formatDate } from '../../domain/dates';
import { LOAN_STATUS_LABEL, type UnifiedLoanStatus } from '../../domain/selectors';
import { useBankState, useMoney, useToday } from '../../lib/hooks';
import { unifiedLoans } from '../../lib/loanList';

export default function MyLoans() {
  const state = useBankState();
  const money = useMoney();
  const today = useToday();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'' | UnifiedLoanStatus>('');
  const [kind, setKind] = useState<'' | 'loan' | 'application'>('');
  const all = useMemo(() => unifiedLoans(state), [state]);
  const items = all.filter(
    (i) =>
      (!status || i.status === status) &&
      (!kind || i.kind === kind) &&
      (!query || `${i.label} ${i.reference}`.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <div>
      <PageHeader title="Mes prêts" icon={Landmark} subtitle="Tous vos prêts et dossiers de démonstration." actions={<Button icon={Plus} onClick={() => navigate('/prets/nouvelle')}>Nouvelle demande</Button>} />
      <Card className="mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher (scénario, référence)" className="pl-11" aria-label="Rechercher un prêt" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {(Object.keys(LOAN_STATUS_LABEL) as UnifiedLoanStatus[]).map((s) => (
            <option key={s} value={s}>
              {LOAN_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Filtrer par nature">
          <option value="">Prêts et demandes</option>
          <option value="loan">Prêts activés</option>
          <option value="application">Demandes non activées</option>
        </Select>
      </Card>
      {items.length === 0 ? (
        <Card>
          <EmptyState icon={Landmark} title={all.length ? 'Aucun résultat' : 'Aucun prêt fictif'} action={<Button onClick={() => navigate(all.length ? '/prets/mes-prets' : '/prets/simulateur')} variant={all.length ? 'secondary' : 'primary'}>{all.length ? 'Voir tout' : 'Commencer une simulation'}</Button>}>
            {all.length ? 'Aucun prêt ne correspond aux filtres.' : 'Simulez un prêt puis activez-le pour le voir ici.'}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((i) => (
            <Link key={i.key} to={i.link} className="card block p-4 transition hover:-translate-y-0.5 hover:shadow-lift sm:p-5">
              <div className="flex flex-wrap items-center gap-3">
                <ProductIcon product={state.loanProducts.find((p) => p.id === i.productId)} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{i.label}</p>
                  <p className="font-mono text-xs text-muted">{i.reference}</p>
                </div>
                <UnifiedStatusBadge status={i.status} />
              </div>
              <dl className="num mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4 lg:grid-cols-5">
                <div><dt className="text-xs text-muted">Capital initial</dt><dd className="font-semibold">{money(i.principal)}</dd></div>
                <div><dt className="text-xs text-muted">Restant dû</dt><dd className="font-semibold">{i.kind === 'loan' ? money(i.outstanding) : '—'}</dd></div>
                <div><dt className="text-xs text-muted">Mensualité</dt><dd className="font-semibold">{i.payment ? money(i.payment) : '—'}</dd></div>
                <div><dt className="text-xs text-muted">Durée initiale</dt><dd className="font-semibold">{i.months} mois</dd></div>
                <div><dt className="text-xs text-muted">Échéances restantes</dt><dd className="font-semibold">{i.kind === 'loan' ? i.remaining : '—'}</dd></div>
                <div><dt className="text-xs text-muted">Intérêts théoriques</dt><dd className="font-semibold">{money(i.interest)}</dd></div>
                <div><dt className="text-xs text-muted">Remboursé (simulé)</dt><dd className="font-semibold">{money(i.totalPaid)}</dd></div>
                <div><dt className="text-xs text-muted">Prochaine échéance</dt><dd className={i.nextDue && i.nextDue < today ? 'font-semibold text-danger' : 'font-semibold'}>{i.nextDue ? formatDate(i.nextDue) : '—'}</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      )}
      <SimulationDisclaimer className="mt-6" />
    </div>
  );
}
