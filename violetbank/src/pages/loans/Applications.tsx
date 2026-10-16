import clsx from 'clsx';
import { FolderOpen, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DecisionPanel } from '../../components/LoanDecision';
import { ProductIcon } from '../../components/LoanParts';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Segmented } from '../../components/ui';
import { formatDate, formatTime } from '../../domain/dates';
import type { ApplicationStatus } from '../../domain/schema';
import { useBankState, useMoney } from '../../lib/hooks';
import { APP_STATUS_LABEL, APP_STATUS_TONE } from '../../lib/labels';

type Filter = 'open' | 'all' | 'closed';
const OPEN: ApplicationStatus[] = ['draft', 'pending', 'accepted', 'info_required'];

export default function Applications() {
  const state = useBankState();
  const money = useMoney();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(params.get('app'));

  useEffect(() => {
    const id = params.get('app');
    if (id) setSelected(id);
  }, [params]);

  const apps = useMemo(
    () =>
      state.loanApplications.filter((a) => (filter === 'all' ? true : filter === 'open' ? OPEN.includes(a.status) : !OPEN.includes(a.status))),
    [state.loanApplications, filter],
  );
  const close = () => {
    setSelected(null);
    if (params.has('app')) {
      params.delete('app');
      setParams(params, { replace: true });
    }
  };
  const current = state.loanApplications.find((a) => a.id === selected);

  return (
    <div>
      <PageHeader title="Mes demandes de prêt" icon={FolderOpen} subtitle="Dossiers de démonstration et décisions simulées." actions={<Button icon={Plus} onClick={() => navigate('/prets/nouvelle')}>Nouvelle demande</Button>} />
      <div className="mb-4">
        <Segmented label="Filtrer les demandes" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Toutes' }, { value: 'open', label: 'En cours' }, { value: 'closed', label: 'Clôturées' }]} />
      </div>
      {apps.length === 0 ? (
        <Card>
          <EmptyState icon={FolderOpen} title="Aucune demande" action={<Button onClick={() => navigate('/prets/nouvelle')}>Créer une demande</Button>}>
            Les demandes de démonstration apparaîtront ici avec leur décision simulée.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {apps.map((a) => {
            const product = state.loanProducts.find((p) => p.id === a.productId);
            return (
              <button key={a.id} type="button" onClick={() => setSelected(a.id)} className={clsx('card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift', selected === a.id && 'ring-2 ring-brand')}>
                <div className="flex items-start gap-3">
                  <ProductIcon product={product} size={42} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{product?.name ?? 'Scénario'}</p>
                    <p className="font-mono text-xs text-muted">{a.reference}</p>
                  </div>
                  <Badge tone={APP_STATUS_TONE[a.status]}>{APP_STATUS_LABEL[a.status]}</Badge>
                </div>
                <div className="num mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="font-bold">{money(a.amount)}</span>
                  <span className="text-muted">{a.months} mois</span>
                  <span className="text-muted">créée le {formatDate(a.createdAt)} à {formatTime(a.createdAt)}</span>
                </div>
                {a.decisionReason && <p className="mt-2 line-clamp-2 text-xs text-muted">{a.decisionReason}</p>}
              </button>
            );
          })}
        </div>
      )}
      {current && (
        <Modal open onClose={close} title={`Dossier ${current.reference}`} description="Décision de simulation — jamais une décision bancaire réelle." size="lg">
          <DecisionPanel key={current.id} appId={current.id} />
        </Modal>
      )}
    </div>
  );
}
