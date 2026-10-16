import { CalendarDays, Calculator, FolderOpen, HandCoins, Landmark, Plus, Scale, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoansIllustration, ProductIcon, SimulationDisclaimer, UnifiedStatusBadge } from '../../components/LoanParts';
import { Button, Card, EmptyState, SectionTitle, SeeAll, StatTile } from '../../components/ui';
import { formatDate } from '../../domain/dates';
import { quoteLoan } from '../../domain/loanMath';
import { formatRate } from '../../domain/money';
import { loanPortfolio } from '../../domain/selectors';
import { useBankState, useMoney, useToday } from '../../lib/hooks';
import { unifiedLoans } from '../../lib/loanList';

/** Montant d'exemple : 1 000 borné aux limites du scénario, durée de 12 mois bornée. */
export function exampleFor(p: { minAmount: number; maxAmount: number; minMonths: number; maxMonths: number }) {
  const amount = Math.min(p.maxAmount, Math.max(p.minAmount, 100_000));
  const months = Math.min(p.maxMonths, Math.max(p.minMonths, 12));
  return { amount, months };
}

export default function LoansHome() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const navigate = useNavigate();
  const p = useMemo(() => loanPortfolio(state), [state]);
  const items = useMemo(() => unifiedLoans(state).slice(0, 4), [state]);
  const products = state.loanProducts.filter((x) => x.enabled);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#8B70FF] via-brand to-brand-deep p-6 text-white shadow-glow sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <span className="chip bg-white/15 text-white">Module de crédit simulé</span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Prêts fictifs</h1>
            <p className="mt-2 text-white/80">Simulez un prêt, obtenez une décision de démonstration, recevez un capital fictif et gérez vos remboursements — sans aucune banque réelle.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" className="border-0 bg-white text-brand-deep hover:bg-white/90" icon={Calculator} onClick={() => navigate('/prets/simulateur')}>
                Simuler un prêt
              </Button>
              <Button className="bg-white/15 shadow-none hover:bg-white/25" icon={Plus} onClick={() => navigate('/prets/nouvelle')}>
                Nouvelle demande
              </Button>
              <Button className="bg-white/15 shadow-none hover:bg-white/25" icon={Landmark} onClick={() => navigate('/prets/mes-prets')}>
                Mes prêts
              </Button>
              <Button className="bg-white/15 shadow-none hover:bg-white/25" icon={CalendarDays} onClick={() => navigate('/prets/calendrier')}>
                Calendrier
              </Button>
            </div>
          </div>
          <LoansIllustration />
        </div>
      </section>

      <SimulationDisclaimer />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Capitaux fictifs empruntés" value={money(p.borrowed)} icon={HandCoins} to="/prets/mes-prets" />
        <StatTile label="Capital fictif restant dû" value={money(p.outstanding)} icon={Landmark} tone="warn" to="/prets/mes-prets" />
        <StatTile label="Total remboursé (simulé)" value={money(p.repaidTotal)} icon={Wallet} tone="ok" hint={`dont ${money(p.interestPaid)} d’intérêts`} />
        <StatTile
          label="Prochaine échéance"
          value={p.nextDue ? money(p.nextDue.installment.amount - p.nextDue.installment.paidPrincipal - p.nextDue.installment.paidInterest) : '—'}
          icon={CalendarDays}
          tone="info"
          to="/prets/calendrier"
          hint={p.nextDue ? `${formatDate(p.nextDue.installment.dueDate)}${p.nextDue.installment.dueDate < today ? ' · en retard dans la simulation' : ''}` : 'Aucune'}
        />
        <StatTile label="Demandes en cours" value={p.pendingApplications} icon={FolderOpen} tone="brand" to="/prets/demandes" />
        <StatTile label="Prêts actifs" value={p.activeCount} icon={Landmark} tone="brand" to="/prets/mes-prets" />
        <StatTile label="Prêts terminés" value={p.closedCount} icon={HandCoins} tone="ok" to="/prets/mes-prets" hint="Remboursés intégralement" />
        <StatTile label="Comparer des scénarios" value="Comparateur" icon={Scale} tone="neutral" to="/prets/comparateur" />
      </section>

      <Card className="p-4 sm:p-6">
        <SectionTitle title="Mes prêts et demandes" action={items.length ? <SeeAll to="/prets/mes-prets" /> : undefined} />
        {items.length === 0 ? (
          <EmptyState icon={HandCoins} title="Aucun prêt fictif pour l’instant" action={<Button icon={Calculator} onClick={() => navigate('/prets/simulateur')}>Commencer une simulation</Button>}>
            Testez le simulateur puis déposez une demande de démonstration.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((it) => (
              <li key={it.key}>
                <Link to={it.link} className="flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-raised">
                  <ProductIcon product={state.loanProducts.find((x) => x.id === it.productId)} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{it.label}</span>
                    <span className="text-xs text-muted">
                      {it.reference} · {money(it.principal)} · {it.months} mois
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    <UnifiedStatusBadge status={it.status} />
                  </span>
                  <span className="num text-right text-sm font-bold">{it.kind === 'loan' ? money(it.outstanding) : money(it.payment)}<span className="block text-[11px] font-medium text-muted">{it.kind === 'loan' ? 'restant dû' : '/ mois estimé'}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <SectionTitle title="Scénarios de démonstration" subtitle="Scénarios de simulation, ne représentant aucune offre bancaire réelle. Taux hypothétiques configurables dans les paramètres." />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((prod) => {
            const ex = exampleFor(prod);
            const q = quoteLoan({ principal: ex.amount, annualRateBps: prod.annualRateBps, months: ex.months, mode: 'annuity', startDate: today });
            return (
              <Card key={prod.id} className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <ProductIcon product={prod} />
                  <div className="min-w-0">
                    <h3 className="truncate font-bold">{prod.name}</h3>
                    <p className="text-xs text-muted">Taux fictif {formatRate(prod.annualRateBps)}</p>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm text-muted">{prod.description}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-raised p-2">
                    <dt className="text-muted">Montant</dt>
                    <dd className="num font-semibold">{money(prod.minAmount, { compact: true })} – {money(prod.maxAmount, { compact: true })}</dd>
                  </div>
                  <div className="rounded-xl bg-raised p-2">
                    <dt className="text-muted">Durée</dt>
                    <dd className="num font-semibold">{prod.minMonths} – {prod.maxMonths} mois</dd>
                  </div>
                </dl>
                <p className="mt-3 text-sm">
                  Ex. {money(ex.amount)} sur {ex.months} mois : <strong className="num">{money(q.firstPayment)}/mois</strong>
                </p>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" block onClick={() => navigate(`/prets/simulateur?produit=${prod.id}`)}>
                    Simuler
                  </Button>
                  <Button size="sm" block onClick={() => navigate(`/prets/nouvelle?produit=${prod.id}`)}>
                    Demander
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
