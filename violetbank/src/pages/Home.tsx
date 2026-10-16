import { ArrowDownLeft, ArrowDownToLine, ArrowLeftRight, CalendarClock, CreditCard, Eye, EyeOff, HandCoins, History, Landmark, ListOrdered, PiggyBank, Plus, Receipt, Send, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { TransactionRow } from '../components/Transactions';
import { VirtualCardView } from '../components/VirtualCardView';
import { Badge, Button, Card, EmptyState, SectionTitle, SeeAll, StatTile } from '../components/ui';
import { formatDate } from '../domain/dates';
import { dashboardSummary } from '../domain/selectors';
import { useBalances, useBankState, useMoney, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';

export function Home() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const balances = useBalances();
  const update = useBank((s) => s.update);
  const open = useUi((s) => s.openModal);
  const navigate = useNavigate();
  const summary = useMemo(() => dashboardSummary(state, today), [state, today]);
  const hidden = state.settings.balanceHidden;
  const recent = state.transactions.slice(0, 6);
  const cards = state.cards.filter((c) => !c.deletedAt);
  const accounts = state.accounts.filter((a) => !a.archived);

  const toggleHidden = () => update((s) => ({ ...s, settings: { ...s.settings, balanceHidden: !s.settings.balanceHidden } }));

  const quick = [
    { label: 'Ajouter des fonds', icon: Plus, onClick: () => open('deposit') },
    { label: 'Nouvelle carte', icon: CreditCard, onClick: () => navigate('/cartes?nouvelle=1') },
    { label: 'Transfert', icon: ArrowLeftRight, onClick: () => open('transfer') },
    { label: 'Dépense', icon: Receipt, onClick: () => open('expense') },
    { label: 'Créer un coffre', icon: PiggyBank, onClick: () => navigate('/coffres?nouveau=1') },
    { label: 'Demander un prêt', icon: HandCoins, onClick: () => navigate('/prets/nouvelle') },
    { label: 'Rembourser', icon: Landmark, onClick: () => navigate('/prets/remboursement') },
    { label: 'Historique', icon: History, onClick: () => navigate('/historique') },
  ];

  return (
    <div className="space-y-8">
      {/* Solde principal */}
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#8B70FF] via-brand to-brand-deep p-6 text-white shadow-glow sm:p-8" aria-labelledby="balance-title">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-[#4930B5]/60 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p id="balance-title" className="text-sm font-semibold text-white/80">
              Argent disponible fictif · {accounts.length} compte{accounts.length > 1 ? 's' : ''}
            </p>
            <button type="button" onClick={toggleHidden} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold transition hover:bg-white/25" aria-pressed={hidden}>
              {hidden ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
              {hidden ? 'Afficher' : 'Masquer'}
            </button>
          </div>
          <p className="num mt-2 text-[40px] font-extrabold leading-none tracking-tight sm:text-6xl" data-testid="main-balance">
            {money(summary.available, { sensitive: true })}
          </p>
          <p className="mt-3 text-sm text-white/75">
            + {money(summary.inVaults, { sensitive: true })} dans les coffres
            {summary.loanOutstanding > 0 && <> · dette fictive {money(summary.loanOutstanding, { sensitive: true })} (non incluse)</>}
          </p>
          <div className="mt-6 grid grid-cols-5 gap-2 sm:flex sm:flex-wrap">
            {[
              { label: 'Ajouter', icon: ArrowDownToLine, onClick: () => open('deposit') },
              { label: 'Envoyer', icon: Send, onClick: () => navigate('/envoyer') },
              { label: 'Recevoir', icon: ArrowDownLeft, onClick: () => navigate('/recevoir') },
              { label: 'Prêts', icon: HandCoins, onClick: () => navigate('/prets') },
              { label: 'Détails', icon: ListOrdered, onClick: () => navigate('/comptes') },
            ].map((a) => (
              <button key={a.label} type="button" onClick={a.onClick} className="flex flex-col items-center gap-1.5 rounded-2xl text-xs font-semibold sm:flex-row sm:bg-white/15 sm:px-4 sm:py-2.5 sm:text-sm sm:hover:bg-white/25">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur transition hover:bg-white/30 sm:h-auto sm:w-auto sm:bg-transparent">
                  <a.icon size={20} aria-hidden />
                </span>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Résumé financier */}
      <section aria-label="Résumé financier" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Disponible" value={money(summary.available, { sensitive: true })} icon={Wallet} to="/comptes" hint="Somme des comptes actifs" />
        <StatTile label="Dans les coffres" value={money(summary.inVaults, { sensitive: true })} icon={PiggyBank} tone="ok" to="/coffres" />
        <StatTile label="Entrées du mois" value={money(summary.monthIn, { sensitive: true })} icon={TrendingUp} tone="ok" to="/statistiques" hint="Hors crédits simulés" />
        <StatTile label="Dépenses du mois" value={money(summary.monthOut, { sensitive: true })} icon={TrendingDown} tone="danger" to="/statistiques" hint={summary.monthLoanOut ? `+ ${money(summary.monthLoanOut)} de remboursements` : 'Hors remboursements'} />
        <StatTile label="Prêts en cours (dû)" value={money(summary.loanOutstanding, { sensitive: true })} icon={Landmark} tone="warn" to="/prets/mes-prets" hint="Dette fictive, non disponible" />
        <StatTile
          label="Prochaine échéance"
          value={summary.nextDue ? money(summary.nextDue.installment.amount - summary.nextDue.installment.paidInterest - summary.nextDue.installment.paidPrincipal) : '—'}
          icon={CalendarClock}
          tone="info"
          to="/prets/calendrier"
          hint={summary.nextDue ? `${formatDate(summary.nextDue.installment.dueDate)} · ${summary.nextDue.loan.reference}` : 'Aucun prêt actif'}
        />
        <StatTile label="Transactions" value={summary.txCount} icon={ListOrdered} tone="neutral" to="/historique" hint="Opérations effectuées" />
        <StatTile label="Cartes virtuelles" value={summary.cardCount} icon={CreditCard} tone="brand" to="/cartes" hint={`${cards.filter((c) => c.locked).length} verrouillée(s)`} />
      </section>

      {/* Actions rapides */}
      <section>
        <SectionTitle title="Actions rapides" />
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none sm:grid sm:grid-cols-4 lg:grid-cols-8">
          {quick.map((q) => (
            <button key={q.label} type="button" onClick={q.onClick} className="card flex min-w-[104px] flex-col items-center gap-2 p-4 text-center text-[13px] font-semibold transition hover:-translate-y-0.5 hover:shadow-lift">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
                <q.icon size={20} aria-hidden />
              </span>
              {q.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Activité récente */}
        <Card className="p-4 sm:p-5 lg:col-span-3">
          <SectionTitle title="Activité récente" action={<SeeAll to="/historique" />} />
          {recent.length ? (
            <div>
              {recent.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          ) : (
            <EmptyState icon={History} title="Aucune opération" action={<Button onClick={() => open('deposit')}>Ajouter des fonds de test</Button>}>
              Ajoutez de l’argent fictif pour commencer la simulation.
            </EmptyState>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="p-5">
            <SectionTitle title="Mes cartes" action={<SeeAll to="/cartes" />} />
            {cards[0] ? (
              <Link to="/cartes" aria-label="Gérer mes cartes">
                <VirtualCardView card={cards[0]} flippable={false} />
              </Link>
            ) : (
              <EmptyState icon={CreditCard} title="Aucune carte" action={<Button onClick={() => navigate('/cartes?nouvelle=1')}>Créer une carte</Button>} />
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle title="Comptes" action={<SeeAll to="/comptes" />} />
            <ul className="space-y-1">
              {accounts.map((a) => (
                <li key={a.id}>
                  <Link to="/comptes" className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-raised">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: a.color }}>
                      <Icon name={a.icon} size={18} />
                    </span>
                    <span className="flex-1 truncate font-semibold">{a.name}</span>
                    <span className="num font-bold">{money(balances.accounts.get(a.id) ?? 0, { sensitive: true })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          {summary.nextDue && (
            <Card className="p-5">
              <SectionTitle title="Prochaine échéance fictive" action={<Badge tone="info">Simulation</Badge>} />
              <p className="text-sm text-muted">
                {summary.nextDue.loan.label} · échéance n°{summary.nextDue.installment.index}
              </p>
              <p className="num mt-1 text-2xl font-bold">{money(summary.nextDue.installment.amount - summary.nextDue.installment.paidInterest - summary.nextDue.installment.paidPrincipal)}</p>
              <p className="text-sm text-muted">le {formatDate(summary.nextDue.installment.dueDate, 'long')}</p>
              <Button className="mt-4" block variant="soft" onClick={() => navigate(`/prets/remboursement?pret=${summary.nextDue?.loan.id}`)}>
                Simuler le remboursement
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
