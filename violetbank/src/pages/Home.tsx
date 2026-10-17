import clsx from 'clsx';
import {
  ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChartPie, ChevronRight, Coins, CreditCard, Eye, EyeOff, HandCoins, LayoutGrid, MoreHorizontal, PiggyBank, Plus, Send,
  Settings2, Target, Users, type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hero, HeroAmount, HeroPill, RoundActions, Widget } from '../components/Hero';
import { Icon } from '../components/Icon';
import { Button, EmptyState, Modal, Switch } from '../components/ui';
import { createCard } from '../domain/cards';
import { getCategory } from '../domain/categories';
import { effectiveType, isPosted } from '../domain/core';
import { daysInMonth, formatDate, formatTime, monthKey } from '../domain/dates';
import type { Transaction, VirtualCard } from '../domain/schema';
import { dashboardSummary, ORDINARY_OUT_TYPES } from '../domain/selectors';
import { useActiveAccounts, useBalances, useBankState, useMoney, useToday } from '../lib/hooks';
import { readPreference, writePreference } from '../store/storage';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';

const WIDGETS = [
  { key: 'discover', label: 'Découvrir VIOLETBANK' },
  { key: 'accounts', label: 'Comptes fictifs' },
  { key: 'activity', label: 'Activité récente' },
  { key: 'loans', label: 'Prêts actifs' },
  { key: 'vaults', label: 'Coffres' },
  { key: 'learn', label: 'En savoir plus' },
  { key: 'products', label: 'Produits fictifs' },
  { key: 'spending', label: 'Dépenses du mois' },
  { key: 'cards', label: 'Cartes' },
  { key: 'wealth', label: 'Patrimoine net' },
] as const;
type WidgetKey = (typeof WIDGETS)[number]['key'];

function useHiddenWidgets() {
  const [hidden, setHidden] = useState<WidgetKey[]>(() => {
    try {
      const v = JSON.parse(readPreference('home-widgets-hidden', '[]'));
      return Array.isArray(v) ? v.filter((k): k is WidgetKey => WIDGETS.some((w) => w.key === k)) : [];
    } catch {
      return [];
    }
  });
  const toggle = (key: WidgetKey, visible: boolean) =>
    setHidden((h) => {
      const next = visible ? h.filter((k) => k !== key) : [...new Set([...h, key])];
      writePreference('home-widgets-hidden', JSON.stringify(next));
      return next;
    });
  return { hidden, toggle };
}

function ActivityRow({ tx }: { tx: Transaction }) {
  const money = useMoney();
  const open = useUi((s) => s.openModal);
  const state = useBankState();
  const contact = tx.contactId ? state.contacts.find((c) => c.id === tx.contactId) : undefined;
  const cat = getCategory(tx.category, state.customCategories);
  const declined = tx.status === 'declined';
  return (
    <button type="button" onClick={() => open('transaction', { id: tx.id })} className="flex w-full items-center gap-3.5 rounded-2xl py-2.5 text-left transition hover:bg-raised/60">
      <span className="relative shrink-0">
        {contact ? (
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold" style={{ borderColor: contact.color, color: contact.color }}>
            {contact.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
          </span>
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${cat.color}26`, color: cat.color }}>
            <Icon name={cat.icon} size={20} />
          </span>
        )}
        {(tx.type === 'p2p_in' || tx.type === 'p2p_out' || tx.type === 'transfer_in' || tx.type === 'transfer_out') && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-bg">
            {tx.amount > 0 ? <ArrowDownLeft size={12} aria-hidden /> : <ArrowUpRight size={12} aria-hidden />}
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx('block truncate text-[16px] font-semibold', declined && 'text-muted line-through')}>{tx.label}</span>
        <span className="block text-sm text-muted">
          {formatDate(tx.date).slice(0, 6)}, {formatTime(tx.date).replace('h', ':')}
          {declined && ' · refusée'}
        </span>
      </span>
      <span className={clsx('num shrink-0 text-[16px] font-semibold', declined ? 'text-muted line-through' : tx.amount > 0 ? 'text-ok' : 'text-ink')}>{money(tx.amount, { signed: true })}</span>
    </button>
  );
}

function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0" role="img" aria-label={`${value} étapes sur ${total}`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="4" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgb(var(--brand))" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / total)} transform="rotate(-90 28 28)" className="transition-[stroke-dashoffset] duration-700" />
      <text x="28" y="33" textAnchor="middle" fontSize="13" fontWeight="700" fill="currentColor">
        {value}/{total}
      </text>
    </svg>
  );
}

/** Courbe cumulée des dépenses courantes du mois ; pointillés après la date du jour. */
function SpendingSparkline({ today }: { today: string }) {
  const state = useBankState();
  const money = useMoney();
  const month = monthKey(today);
  const [y, m] = month.split('-').map(Number) as [number, number];
  const days = daysInMonth(y, m);
  const todayDay = Number(today.slice(8, 10));
  const daily = useMemo(() => {
    const arr = new Array<number>(days + 1).fill(0);
    for (const tx of state.transactions) {
      if (!isPosted(tx) || monthKey(tx.date) !== month || !ORDINARY_OUT_TYPES.has(effectiveType(tx))) continue;
      const d = Number(tx.date.slice(8, 10));
      if (d <= todayDay) arr[d] = (arr[d] ?? 0) - tx.amount;
    }
    return arr;
  }, [state.transactions, month, days, todayDay]);
  const cumulative: number[] = [];
  let acc = 0;
  for (let d = 1; d <= todayDay; d++) {
    acc += daily[d] ?? 0;
    cumulative.push(acc);
  }
  const total = Math.max(0, acc);
  const W = 320;
  const H = 110;
  const max = Math.max(1, total);
  const x = (d: number) => ((d - 1) / Math.max(1, days - 1)) * W;
  const yv = (v: number) => H - 8 - (Math.max(0, v) / max) * (H - 24);
  const pts = cumulative.map((v, i) => `${x(i + 1).toFixed(1)},${yv(v).toFixed(1)}`).join(' ');
  const lastX = x(todayDay);
  const lastY = yv(total);
  const ticks = [1, 6, 11, 16, 21, 26, days].filter((d, i, a) => d <= days && a.indexOf(d) === i);
  return (
    <div>
      <p className="num text-4xl font-extrabold tracking-tight">{money(total, { sensitive: true, compact: total % 100 === 0 })}</p>
      <div className="relative mt-3">
        <span className="num absolute right-0 top-0 text-sm font-semibold text-muted">{money(total, { sensitive: true, compact: true })}</span>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label={`Dépenses cumulées du mois : ${money(total)}`}>
          <defs>
            <linearGradient id="spend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgb(var(--brand))" stopOpacity=".28" />
              <stop offset="1" stopColor="rgb(var(--brand))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgb(var(--line))" strokeWidth="1" />
          ))}
          <rect x={lastX} y={lastY} width={W - lastX} height={H - 8 - lastY} fill="url(#spend-fill)" />
          <polyline points={pts} fill="none" stroke="rgb(var(--ink))" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <line x1={lastX} x2={W} y1={lastY} y2={lastY} stroke="rgb(var(--muted))" strokeWidth="2" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="mt-1 flex justify-between text-sm text-muted">
          {ticks.map((t) => (
            <span key={t} className="num">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniCard({ card }: { card: VirtualCard }) {
  return (
    <div className="relative aspect-[1.586] w-full overflow-hidden rounded-lg shadow-soft" style={{ background: card.style === 'minimal' ? card.color : `linear-gradient(135deg, ${card.color}, ${card.accent})` }}>
      <span className="absolute right-1.5 top-1 text-[8px] font-black tracking-widest text-white/85">DEMO</span>
      {card.kind === 'disposable' && <span className="absolute left-1.5 top-1 rounded bg-white/25 px-1 text-[7px] font-bold text-white">1×</span>}
      <span className="absolute bottom-1.5 right-1.5 flex">
        <span className="h-3 w-3 rounded-full bg-white/70" />
        <span className="-ml-1.5 h-3 w-3 rounded-full bg-white/35" />
      </span>
      {card.locked && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[10px] font-bold text-white">Verrouillée</span>}
    </div>
  );
}

function ProductRow({ to, icon: I, color, title, text }: { to: string; icon: LucideIcon; color: string; title: string; text: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-2xl py-3 transition hover:bg-raised/60">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white" style={{ background: color }}>
        <I size={22} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

export function Home() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const balances = useBalances();
  const accounts = useActiveAccounts();
  const update = useBank((s) => s.update);
  const act = useBank((s) => s.act);
  const open = useUi((s) => s.openModal);
  const setMore = useUi((s) => s.setMoreOpen);
  const navigate = useNavigate();
  const { hidden, toggle } = useHiddenWidgets();
  const [managing, setManaging] = useState(false);
  const summary = useMemo(() => dashboardSummary(state, today), [state, today]);
  const hiddenBalance = state.settings.balanceHidden;
  const cards = state.cards.filter((c) => !c.deletedAt);
  const vaults = state.vaults.filter((v) => !v.archived);
  const show = (k: WidgetKey) => !hidden.includes(k);

  const steps = [
    { label: 'Ajouter des fonds de test', done: state.transactions.some((t) => t.type === 'deposit'), run: () => open('deposit') },
    { label: 'Créer une carte virtuelle', done: cards.length > 0, run: () => navigate('/cartes?nouvelle=1') },
    { label: 'Ouvrir un coffre', done: vaults.length > 0, run: () => navigate('/coffres?nouveau=1') },
    { label: 'Simuler un prêt', done: state.loanApplications.length > 0, run: () => navigate('/prets/simulateur') },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);

  const createDisposable = () => {
    const accountId = accounts[0]?.id;
    if (!accountId) return;
    const res = act((s, ctx) => createCard(s, ctx, { name: 'Jetable', accountId, color: '#2B2B35', accent: '#7656F6', style: 'metal', avatar: null, monthlyLimit: null, locked: false, kind: 'disposable' }), { success: 'Carte jetable générée : son identifiant change après chaque dépense simulée.' });
    if (res.ok) navigate('/cartes');
  };
  const disposable = cards.find((c) => c.kind === 'disposable');
  const net = summary.available + summary.inVaults - summary.loanOutstanding;

  const heroActions = [
    { label: 'Ajouter', aria: 'Ajouter de l’argent', icon: Plus, onClick: () => open('deposit') },
    { label: 'Envoyer', icon: Send, onClick: () => navigate('/envoyer') },
    { label: 'Recevoir', icon: ArrowDownLeft, onClick: () => navigate('/recevoir') },
    { label: 'Cartes', icon: CreditCard, onClick: () => navigate('/cartes') },
    { label: 'Prêts', icon: HandCoins, onClick: () => navigate('/prets') },
  ];
  const activeLoans = state.loans.filter((l) => l.status === 'active' || l.status === 'partially_repaid');

  return (
    <div className="mx-auto max-w-2xl">
      {/* Solde principal sur le dégradé plein écran */}
      <Hero title="Accueil" eyebrow={<>Bonjour, {state.profile.displayName} · Personnel · {state.settings.currency}</>} className="min-h-[440px] sm:min-h-[480px]">
        <button type="button" onClick={() => update((s) => ({ ...s, settings: { ...s.settings, balanceHidden: !s.settings.balanceHidden } }))} className="mt-1 rounded-2xl px-3" aria-label={hiddenBalance ? 'Afficher le solde' : 'Masquer le solde'} title={hiddenBalance ? 'Afficher le solde' : 'Masquer le solde'}>
          <HeroAmount cents={summary.available} testId="main-balance" className="text-[64px] sm:text-[76px]" />
        </button>
        <p className="mt-1 flex items-center gap-2 text-[15px] font-medium text-white/85">
          {hiddenBalance ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
          Identifiant démo {state.profile.demoHandle}
        </p>
        {summary.loanOutstanding > 0 && <p className="mt-1 text-xs text-white/70">Dette fictive {money(summary.loanOutstanding, { sensitive: true })} non incluse</p>}
        <div className="mt-auto flex flex-wrap justify-center gap-2">
          <HeroPill to="/comptes">Comptes et coffres</HeroPill>
          <button type="button" onClick={() => open('quick')} className="rounded-full bg-white/25 px-5 py-3 text-[16px] font-semibold text-white backdrop-blur transition hover:bg-white/35" aria-label="Actions rapides">
            <MoreHorizontal size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-6 w-full pb-6">
          <RoundActions actions={heroActions} />
        </div>
      </Hero>

      <div className="space-y-4">
        {show('discover') && (
          <Widget>
            <div className="flex gap-4">
              <ProgressRing value={doneCount} total={steps.length} />
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-snug">{doneCount === steps.length ? 'Vous maîtrisez la simulation 🎉' : 'Découvrez davantage de fonctionnalités VIOLETBANK'}</h2>
                <p className="mt-0.5 text-[15px] text-muted">{nextStep ? `Prochaine étape : ${nextStep.label.toLowerCase()}.` : 'Toutes les étapes de découverte sont terminées.'}</p>
              </div>
            </div>
            {nextStep ? (
              <Button variant="dark" className="mt-4 rounded-full" block size="lg" onClick={nextStep.run}>
                {doneCount === 0 ? 'Démarrer' : 'Continuer'}
              </Button>
            ) : (
              <Button className="mt-4 rounded-full" variant="secondary" block onClick={() => toggle('discover', false)}>
                Masquer ce widget
              </Button>
            )}
          </Widget>
        )}

        {show('accounts') && (
          <Widget title="Comptes" to="/comptes">
            {accounts.map((a) => (
              <Link key={a.id} to="/comptes" className="flex items-center gap-3.5 rounded-2xl py-2 transition hover:bg-raised/60">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white" style={{ background: a.color }}>
                  <Icon name={a.icon} size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.name}</span>
                  <span className="text-xs text-muted">{state.settings.currency} · affichage uniquement</span>
                </span>
                <span className="num font-semibold">{money(balances.accounts.get(a.id) ?? 0, { sensitive: true })}</span>
              </Link>
            ))}
          </Widget>
        )}

        {show('activity') && (
          <Widget>
            {state.transactions.length ? (
              <>
                {state.transactions.slice(0, 3).map((tx) => (
                  <ActivityRow key={tx.id} tx={tx} />
                ))}
                <Link to="/historique" className="mt-2 block py-2 text-center text-[16px] font-bold">
                  Tout afficher
                </Link>
              </>
            ) : (
              <EmptyState icon={ArrowLeftRight} title="Aucune opération" action={<Button onClick={() => open('deposit')}>Ajouter des fonds de test</Button>} />
            )}
          </Widget>
        )}

        {show('loans') && (
          <Widget title="Prêts fictifs actifs" to="/prets">
            {activeLoans.length ? (
              <>
                {activeLoans.slice(0, 3).map((l) => {
                  const next = l.schedule.find((i) => i.status === 'upcoming' || i.status === 'partial');
                  const outstanding = l.principal - l.payments.reduce((acc, p) => acc + (p.reversed ? 0 : p.principal), 0);
                  return (
                    <Link key={l.id} to={`/prets/${l.id}`} className="block rounded-2xl py-2 transition hover:bg-raised/60">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-semibold">{l.label}</span>
                        <span className="num font-semibold">{money(outstanding, { sensitive: true })}</span>
                      </div>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-raised">
                        <div className="h-full rounded-full bg-ok" style={{ width: `${Math.round(((l.principal - outstanding) / l.principal) * 100)}%` }} />
                      </div>
                      {next && (
                        <p className={`mt-1 text-xs ${next.dueDate < today ? 'font-semibold text-danger' : 'text-muted'}`}>
                          Prochaine échéance {money(next.amount - next.paidInterest - next.paidPrincipal)} le {formatDate(next.dueDate)}
                          {next.dueDate < today ? ' · en retard dans la simulation' : ''}
                        </p>
                      )}
                    </Link>
                  );
                })}
                <Button variant="dark" className="mt-3 rounded-full" block onClick={() => navigate(summary.nextDue ? `/prets/remboursement?pret=${summary.nextDue.loan.id}` : '/prets')}>
                  Simuler un remboursement
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <p className="flex-1 text-sm text-muted">Aucun prêt fictif en cours. Simulez une mensualité en quelques secondes.</p>
                <Button className="rounded-full" onClick={() => navigate('/prets/simulateur')}>
                  Simuler
                </Button>
              </div>
            )}
          </Widget>
        )}

        {show('vaults') && (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {vaults.map((v) => (
              <Link key={v.id} to="/coffres" className="flex w-40 shrink-0 flex-col items-center rounded-[28px] border border-line/60 bg-surface p-4 text-center shadow-soft">
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full text-white" style={{ background: v.color }}>
                  <Icon name={v.icon} size={26} />
                </span>
                <span className="-mt-2 max-w-full truncate rounded-full bg-ink px-3 py-0.5 text-xs font-semibold text-bg">{v.name}</span>
                <span className="num mt-2 text-lg font-bold">{money(balances.vaults.get(v.id) ?? 0, { sensitive: true })}</span>
              </Link>
            ))}
            <Link to="/coffres?nouveau=1" className="flex w-40 shrink-0 flex-col items-center justify-center gap-3 rounded-[28px] border border-dashed border-line bg-surface/60 p-4 text-sm font-semibold text-muted">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-raised text-ink">
                <Plus size={22} aria-hidden />
              </span>
              Nouveau coffre
            </Link>
          </div>
        )}

        {show('learn') && (
          <Widget title="En savoir plus" to="/aide">
            {[
              { icon: HandCoins, title: 'Prêt fictif', text: 'Obtenez une estimation simulée en quelques secondes.', cta: 'Demander', run: () => navigate('/prets/simulateur') },
              { icon: PiggyBank, title: 'Coffres', text: 'Mettez de côté de l’argent de test vers un objectif.', cta: 'Ouvrir', run: () => navigate('/coffres?nouveau=1') },
              disposable
                ? { icon: CreditCard, title: 'Carte jetable', text: `Identifiant régénéré ${disposable.regenerations} fois.`, cta: 'Voir', run: () => navigate('/cartes') }
                : { icon: CreditCard, title: 'Carte jetable', text: 'Un identifiant de démonstration neuf après chaque paiement.', cta: 'Générer', run: createDisposable },
            ].map((r) => (
              <div key={r.title} className="flex items-center gap-4 py-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-raised">
                  <r.icon size={22} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold">{r.title}</span>
                  <span className="block text-sm text-muted">{r.text}</span>
                </span>
                <button type="button" onClick={r.run} className="shrink-0 rounded-full bg-raised px-5 py-2.5 text-[15px] font-semibold transition hover:bg-line">
                  {r.cta}
                </button>
              </div>
            ))}
            <Button variant="dark" className="mt-3 rounded-full" block size="lg" onClick={() => setMore(true)}>
              Toutes les rubriques
            </Button>
          </Widget>
        )}

        {show('products') && (
          <Widget>
            <ProductRow to="/coffres" icon={PiggyBank} color="#F07A3A" title="Épargne et coffres" text="Objectifs d’épargne fictifs, sans intérêts réels." />
            <ProductRow to="/prets" icon={Coins} color="#3FC24A" title="Prêts" text="Simulateur, demandes et remboursements fictifs." />
            <ProductRow to="/statistiques" icon={ChartPie} color="#3AA6F5" title="Statistiques" text="Analysez vos flux de démonstration." />
            <ProductRow to="/budgets" icon={Target} color="#B04AF0" title="Budgets" text="Fixez des plafonds par catégorie." />
            <ProductRow to="/contacts" icon={Users} color="#22C3C7" title="Contacts fictifs" text="Envoyez et recevez de l’argent de test." />
          </Widget>
        )}

        {show('spending') && (
          <Widget title="Dépenses du mois" to="/statistiques">
            <SpendingSparkline today={today} />
          </Widget>
        )}

        {show('cards') && (
          <Widget title="Cartes" to="/cartes">
            <div className="grid grid-cols-3 gap-4">
              {!disposable && (
                <button type="button" onClick={createDisposable} className="text-center">
                  <div className="flex aspect-[1.586] w-full items-center justify-center rounded-lg border border-dashed border-line bg-raised">
                    <Plus size={20} aria-hidden />
                  </div>
                  <p className="mt-2 font-semibold">Jetable</p>
                  <p className="text-sm text-muted">Générer</p>
                </button>
              )}
              {cards.slice(0, disposable ? 6 : 5).map((c) => (
                <Link key={c.id} to="/cartes" className="text-center">
                  <MiniCard card={c} />
                  <p className="mt-2 truncate font-semibold">{c.name}</p>
                  <p className="num text-sm text-muted">··{c.demoId.slice(-4)}</p>
                </Link>
              ))}
            </div>
          </Widget>
        )}

        {show('wealth') && (
          <Widget title="Patrimoine net fictif" to="/comptes">
            <p className="num text-4xl font-extrabold tracking-tight">{money(net, { sensitive: true })}</p>
            <ul className="mt-3 space-y-1">
              {[
                { icon: CreditCard, color: '#4285F4', label: 'Espèces (comptes)', value: summary.available },
                { icon: PiggyBank, color: '#26B879', label: 'Coffres', value: summary.inVaults },
                { icon: HandCoins, color: '#E44F62', label: 'Prêts fictifs (dû)', value: -summary.loanOutstanding },
              ].map((r) => (
                <li key={r.label} className="flex items-center gap-3 py-1.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ background: r.color }}>
                    <r.icon size={18} aria-hidden />
                  </span>
                  <span className="flex-1 font-medium">{r.label}</span>
                  <span className="num font-semibold">{money(r.value, { sensitive: true })}</span>
                </li>
              ))}
            </ul>
          </Widget>
        )}

        <div className="flex justify-center pt-2">
          <button type="button" onClick={() => setManaging(true)} className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3 text-[16px] font-semibold shadow-soft transition hover:bg-raised">
            <Settings2 size={18} aria-hidden /> Gérer les widgets
          </button>
        </div>
      </div>

      {managing && (
        <Modal open onClose={() => setManaging(false)} title="Widgets de l’accueil" description="Préférence enregistrée sur cet appareil.">
          <div className="divide-y divide-line">
            {WIDGETS.map((w) => (
              <Switch key={w.key} checked={show(w.key)} onChange={(v) => toggle(w.key, v)} label={w.label} />
            ))}
          </div>
          <Button className="mt-4" block onClick={() => setManaging(false)} icon={LayoutGrid}>
            Terminé
          </Button>
        </Modal>
      )}
    </div>
  );
}
