import { Calculator, Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AmountField, DurationField, ProductSelect, RateAndDateFields } from '../../components/LoanParamsFields';
import { ScheduleChart, ScheduleTable, SimulationDisclaimer } from '../../components/LoanParts';
import { Button, Callout, Card, KeyValue, PageHeader } from '../../components/ui';
import { formatDate } from '../../domain/dates';
import { formatRate } from '../../domain/money';
import { useBankState, useMoney, useToday } from '../../lib/hooks';
import { useLoanParams } from '../../lib/loanParams';

export default function Simulator() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const ctl = useLoanParams({ products: state.loanProducts.filter((p) => p.enabled), today, query });
  const q = ctl.quote;

  return (
    <div>
      <PageHeader title="Simulateur de crédit" icon={Calculator} subtitle="Tous les résultats sont recalculés instantanément par le moteur financier de la démonstration." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="space-y-5 p-5 sm:p-6 lg:col-span-2">
          <ProductSelect ctl={ctl} />
          <AmountField ctl={ctl} />
          <DurationField ctl={ctl} />
          <RateAndDateFields ctl={ctl} />
        </Card>
        <div className="space-y-6 lg:col-span-3">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand to-brand-deep p-6 text-white">
              <p className="text-sm text-white/80">{ctl.params.mode === 'annuity' ? 'Mensualité fictive' : 'Première mensualité fictive'}</p>
              <p className="num mt-1 text-4xl font-extrabold tracking-tight" data-testid="sim-payment">{q ? money(q.firstPayment) : '—'}</p>
              {q && q.lastPayment !== q.firstPayment && <p className="mt-1 text-sm text-white/75">Dernière échéance : {money(q.lastPayment)} (ajustement d’arrondi{ctl.params.mode === 'constant_principal' ? ' et capital constant' : ''})</p>}
            </div>
            {q ? (
              <dl className="grid gap-x-8 px-6 py-4 sm:grid-cols-2">
                <KeyValue label="Capital fictif emprunté" value={money(q.totalPrincipal)} />
                <KeyValue label="Taux annuel nominal fictif" value={formatRate(q.annualRateBps)} />
                <KeyValue label="Taux périodique mensuel" value={`${(q.monthlyRate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} %`} />
                <KeyValue label="Nombre de mensualités" value={q.count} />
                <KeyValue label="Coût total fictif des intérêts" value={money(q.totalInterest)} tone="danger" />
                <KeyValue label="Total fictif à rembourser" value={money(q.totalAmount)} strong />
                <KeyValue label="Première échéance" value={formatDate(q.rows[0]?.dueDate ?? today)} />
                <KeyValue label="Dernière échéance" value={formatDate(q.rows[q.rows.length - 1]?.dueDate ?? today)} />
              </dl>
            ) : (
              <div className="p-6">
                <Callout tone="warn">Corrigez les paramètres pour obtenir une simulation.</Callout>
              </div>
            )}
            <div className="border-t border-line px-6 py-4">
              <Button block icon={Send} disabled={!q} onClick={() => navigate(`/prets/nouvelle?${ctl.toQuery()}`)}>
                Faire une demande avec ces paramètres
              </Button>
            </div>
          </Card>
          {q && (
            <>
              <Card className="p-5">
                <h2 className="mb-2 text-lg font-bold">Capital et intérêts par échéance</h2>
                <ScheduleChart rows={q.rows} />
              </Card>
              <Card className="p-5">
                <h2 className="mb-3 text-lg font-bold">Échéancier détaillé</h2>
                <ScheduleTable rows={q.rows} max={12} />
              </Card>
            </>
          )}
          <Card className="p-5 text-sm text-muted">
            <h2 className="mb-2 text-base font-bold text-ink">Hypothèses du calcul</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Mensualités constantes : M = P × r / (1 − (1 + r)^−n), avec r = taux annuel / 12 ; si le taux est nul, M = P / n.</li>
              <li>Les intérêts de chaque mois sont calculés sur le capital restant dû et arrondis au centime.</li>
              <li>La dernière échéance est ajustée de quelques centimes pour solder exactement le capital.</li>
              <li>Le total à rembourser est la somme des échéances réellement générées. Aucun frais n’est ajouté.</li>
            </ul>
          </Card>
          <SimulationDisclaimer />
        </div>
      </div>
    </div>
  );
}
