import clsx from 'clsx';
import {
  ArrowDownLeft, ArrowLeftRight, BarChart3, ShoppingCart, Bell, BookOpen, CalendarDays, Calculator, ChartPie, ChevronsLeft, ChevronsRight, ChevronsUpDown, CircleHelp, Coins, CreditCard,
  FileClock, FolderOpen, HandCoins, History, Home, Landmark, Moon, PiggyBank, RotateCcw, Scale, Search, Send, Settings,
  Sun, Target, User, Users, Wallet, X, AlertTriangle, CheckCircle2, Info, XCircle, FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { formatDate } from '../domain/dates';
import { formatMoney } from '../domain/money';
import { useResolvedTheme, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';
import { Logo, LogoMark } from './Logo';
import { LockScreen } from './LockScreen';
import { GlobalModals } from './OperationModals';
import { IconButton, Modal } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Principal',
    items: [
      { to: '/', label: 'Accueil', icon: Home, end: true },
      { to: '/comptes', label: 'Comptes', icon: Wallet },
      { to: '/cartes', label: 'Cartes virtuelles', icon: CreditCard },
      { to: '/historique', label: 'Historique', icon: History },
    ],
  },
  {
    title: 'Paiements',
    items: [
      { to: '/paiements', label: 'Paiements', icon: ArrowLeftRight, end: true },
      { to: '/paiements/achat', label: 'Payer (achat simulé)', icon: ShoppingCart },
      { to: '/envoyer', label: 'Envoyer', icon: Send },
      { to: '/recevoir', label: 'Recevoir', icon: ArrowDownLeft },
      { to: '/virements', label: 'Virements internes', icon: ArrowLeftRight },
      { to: '/contacts', label: 'Contacts', icon: Users },
    ],
  },
  {
    title: 'Crédit simulé',
    items: [
      { to: '/prets', label: 'Prêts fictifs', icon: HandCoins, end: true },
      { to: '/prets/mes-prets', label: 'Mes prêts', icon: Landmark },
      { to: '/prets/demandes', label: 'Mes demandes', icon: FolderOpen },
      { to: '/prets/calendrier', label: 'Calendrier', icon: CalendarDays },
      { to: '/prets/simulateur', label: 'Simulateur de crédit', icon: Calculator },
      { to: '/prets/comparateur', label: 'Comparateur', icon: Scale },
    ],
  },
  {
    title: 'Épargne & suivi',
    items: [
      { to: '/coffres', label: 'Coffres', icon: PiggyBank },
      { to: '/budgets', label: 'Budgets', icon: Target },
      { to: '/statistiques', label: 'Statistiques', icon: ChartPie },
    ],
  },
  {
    title: 'Compte',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/profil', label: 'Profil', icon: User },
      { to: '/parametres', label: 'Paramètres', icon: Settings },
      { to: '/journal', label: 'Journal de simulation', icon: FileClock },
      { to: '/aide', label: 'Centre d’aide', icon: CircleHelp },
      { to: '/reinitialisation', label: 'Réinitialisation', icon: RotateCcw },
    ],
  },
];

function useUnread() {
  return useBank((s) => s.state.notifications.reduce((n, x) => n + (x.read ? 0 : 1), 0));
}

export function SimulationBadge({ className }: { className?: string }) {
  return (
    <Link
      to="/aide#simulation"
      className={clsx('inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/15 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[rgb(150,92,14)] dark:text-warn', className)}
      title="Simulation bancaire — argent et crédits fictifs"
    >
      <FlaskConical size={12} aria-hidden />
      <span className="hidden sm:inline">Simulation</span>
    </Link>
  );
}

function Sidebar() {
  const collapsed = useBank((s) => s.state.settings.sidebarCollapsed);
  const update = useBank((s) => s.update);
  const unread = useUnread();
  return (
    <aside className={clsx('sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex', collapsed ? 'w-[84px]' : 'w-[264px]')}>
      <div className={clsx('flex h-[72px] items-center px-5', collapsed && 'justify-center px-0')}>
        <Link to="/" aria-label="Accueil" className="min-w-0">
          <Logo compact={collapsed} />
        </Link>
      </div>
      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mt-4 first:mt-1">
            {!collapsed && <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-muted">{g.title}</p>}
            <ul className="space-y-0.5">
              {g.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] font-medium transition',
                        collapsed && 'justify-center',
                        isActive ? 'bg-brand-soft text-brand-ink' : 'text-ink/75 hover:bg-raised hover:text-ink',
                      )
                    }
                  >
                    <item.icon size={19} aria-hidden />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {item.to === '/notifications' && unread > 0 && (
                      <span className={clsx('num rounded-full bg-brand px-1.5 text-[11px] font-bold text-white', collapsed ? 'absolute right-2 top-1' : 'ml-auto')}>{unread}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => update((s) => ({ ...s, settings: { ...s.settings, sidebarCollapsed: !s.settings.sidebarCollapsed } }))}
          className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-raised hover:text-ink', collapsed && 'justify-center')}
          aria-label={collapsed ? 'Déplier la barre latérale' : 'Replier la barre latérale'}
        >
          {collapsed ? <ChevronsRight size={18} aria-hidden /> : <ChevronsLeft size={18} aria-hidden />}
          {!collapsed && 'Replier'}
        </button>
      </div>
    </aside>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** Bouton rond de l'en-tête : translucide sur le dégradé de l'accueil, plein ailleurs. */
function RoundLink({ to, label, icon: I, onHero, className }: { to: string; label: string; icon: LucideIcon; onHero: boolean; className?: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95',
        onHero ? 'bg-black/20 text-white backdrop-blur hover:bg-black/30' : 'border border-line bg-surface text-ink hover:bg-raised',
        className,
      )}
    >
      <I size={20} aria-hidden />
    </Link>
  );
}

function Header({ onHero }: { onHero: boolean }) {
  const profile = useBank((s) => s.state.profile);
  const simDate = useBank((s) => s.state.settings.simulationDate);
  const update = useBank((s) => s.update);
  const setSearchOpen = useUi((s) => s.setSearchOpen);
  const theme = useResolvedTheme();
  const today = useToday();
  const unread = useUnread();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const transparent = onHero && !scrolled;
  return (
    <header className={clsx('sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-colors duration-200', transparent ? 'bg-transparent' : onHero ? 'bg-[#2B1C6E]/90 backdrop-blur-xl' : 'border-b border-line/70 bg-bg/85 backdrop-blur-xl')}>
      <p className={clsx('py-1 text-center text-[10px] font-extrabold uppercase tracking-[.14em] sm:text-[11px]', onHero ? 'bg-black/15 text-white/85' : 'bg-gradient-to-r from-brand-deep via-brand to-brand-deep text-white')}>
        Simulation bancaire — argent et crédits fictifs
      </p>
      <div className="mx-auto flex h-[64px] max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Link to="/" aria-label="Accueil VBanque" className="shrink-0 lg:hidden">
          <LogoMark size={40} />
        </Link>
        <Link
          to="/profil"
          aria-label={`Profil de ${profile.displayName}${unread ? `, ${unread} notification(s) non lue(s)` : ''}`}
          className={clsx('relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[14px] font-bold transition active:scale-95', onHero ? 'bg-black/25 text-white' : 'bg-brand-soft text-brand-ink')}
        >
          {initials(profile.displayName)}
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className={clsx(
            'flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full px-3.5 text-left text-[15px] transition',
            onHero ? 'border border-white/20 bg-black/20 text-white/90 backdrop-blur hover:bg-black/30' : 'border border-line bg-surface text-muted hover:bg-raised',
          )}
        >
          <Search size={18} aria-hidden className="shrink-0" />
          <span className="truncate">Rechercher</span>
          <kbd className="ml-auto hidden rounded-md border border-current/30 px-1.5 text-[10px] opacity-60 md:inline">/</kbd>
        </button>
        {simDate && (
          <Link to="/parametres#horloge" className={clsx('hidden rounded-full px-2.5 py-1 text-xs font-semibold xl:inline', onHero ? 'bg-black/20 text-white' : 'bg-info/15 text-info')}>
            Horloge : {formatDate(today)}
          </Link>
        )}
        <SimulationBadge className="hidden md:inline-flex" />
        <RoundLink to="/statistiques" label="Statistiques" icon={BarChart3} onHero={onHero} className="hidden md:inline-flex" />
        <span className="relative">
          <RoundLink to="/notifications" label={`Notifications${unread ? ` (${unread} non lues)` : ''}`} icon={Bell} onHero={onHero} />
          {unread > 0 && <span className="num pointer-events-none absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-white">{unread > 99 ? '99+' : unread}</span>}
        </span>
        <RoundLink to="/parametres" label="Paramètres" icon={Settings} onHero={onHero} />
        <button
          type="button"
          onClick={() => update((s) => ({ ...s, settings: { ...s.settings, theme: theme === 'dark' ? 'light' : 'dark' } }))}
          aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className={clsx('hidden h-10 w-10 shrink-0 items-center justify-center rounded-full transition md:inline-flex', onHero ? 'bg-black/20 text-white hover:bg-black/30' : 'border border-line bg-surface hover:bg-raised')}
        >
          {theme === 'dark' ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
        </button>
      </div>
    </header>
  );
}

const BOTTOM_ITEMS: NavItem[] = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/comptes', label: 'Comptes', icon: Wallet },
  { to: '/cartes', label: 'Cartes', icon: CreditCard },
  { to: '/paiements', label: 'Paiements', icon: ArrowLeftRight },
  { to: '/profil', label: 'Profil', icon: User },
];

/** Barre flottante : les libellés se replient au défilement pour libérer l'écran. */
function BottomNav() {
  const unread = useUnread();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 120);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-md items-center gap-0.5 rounded-full border border-white/10 bg-[#15122A]/92 p-1.5 text-white shadow-lift backdrop-blur-xl">
        {BOTTOM_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            aria-label={item.label}
            className={({ isActive }) =>
              clsx('relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[11px] font-semibold transition-all', isActive ? 'bg-white/15 text-white' : 'text-white/65 hover:text-white')
            }
          >
            <item.icon size={22} aria-hidden />
            <span className={clsx('transition-all', compact ? 'h-0 overflow-hidden opacity-0' : 'h-4 opacity-100')}>{item.label}</span>
            {item.to === '/profil' && unread > 0 && <span className="absolute right-[26%] top-1.5 h-2 w-2 rounded-full bg-danger" />}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Recherche globale : rubriques, contacts, prêts et opérations. */
function SearchModal() {
  const open = useUi((s) => s.searchOpen);
  const setOpen = useUi((s) => s.setSearchOpen);
  const openModal = useUi((s) => s.openModal);
  const state = useBank((s) => s.state);
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === '/' && !open && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: { key: string; title: string; subtitle: string; icon: LucideIcon; run: () => void }[] = [];
    for (const g of NAV_GROUPS)
      for (const item of g.items)
        if (item.label.toLowerCase().includes(term)) out.push({ key: `p${item.to}`, title: item.label, subtitle: g.title, icon: item.icon, run: () => navigate(item.to) });
    for (const c of state.contacts)
      if (!c.archived && c.name.toLowerCase().includes(term)) out.push({ key: `c${c.id}`, title: c.name, subtitle: `Contact fictif · ${c.handle}`, icon: Users, run: () => navigate(`/envoyer?contact=${c.id}`) });
    for (const l of state.loans)
      if (`${l.reference} ${l.label}`.toLowerCase().includes(term)) out.push({ key: `l${l.id}`, title: l.label, subtitle: `Prêt fictif ${l.reference}`, icon: Landmark, run: () => navigate(`/prets/${l.id}`) });
    let n = 0;
    for (const t of state.transactions) {
      if (n >= 8) break;
      if (`${t.label} ${t.note ?? ''}`.toLowerCase().includes(term)) {
        n++;
        out.push({ key: `t${t.id}`, title: t.label, subtitle: `${formatDate(t.date)} · ${formatMoney(t.amount, { currency: state.settings.currency, signed: true })}`, icon: History, run: () => openModal('transaction', { id: t.id }) });
      }
    }
    return out.slice(0, 24);
  }, [q, state, navigate, openModal]);

  if (!open) return null;
  const pick = (r: (typeof results)[number]) => {
    setOpen(false);
    r.run();
  };
  return (
    <Modal open onClose={() => setOpen(false)} title="Rechercher" description="Rubriques, contacts, prêts et opérations fictives.">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) pick(results[0]);
          }}
          placeholder="Ex. Prêts, Lina, Marché…"
          className="input pl-11"
          aria-label="Terme recherché"
        />
      </div>
      <ul className="mt-3 max-h-[50dvh] overflow-y-auto">
        {results.map((r) => (
          <li key={r.key}>
            <button type="button" onClick={() => pick(r)} className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-raised">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                <r.icon size={18} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{r.title}</span>
                <span className="block truncate text-xs text-muted">{r.subtitle}</span>
              </span>
            </button>
          </li>
        ))}
        {q.trim() && results.length === 0 && <li className="py-6 text-center text-sm text-muted">Aucun résultat pour « {q} ».</li>}
      </ul>
    </Modal>
  );
}

function MoreSheet() {
  const open = useUi((s) => s.moreOpen);
  const setOpen = useUi((s) => s.setMoreOpen);
  const unread = useUnread();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, setOpen]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Toutes les rubriques">
      <div className="absolute inset-0 animate-fade bg-[#101014]/55 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
      <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] animate-sheet overflow-y-auto rounded-t-[28px] bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-lg font-bold">Toutes les rubriques</p>
          <IconButton icon={X} label="Fermer" onClick={() => setOpen(false)} />
        </div>
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mb-4">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">{g.title}</p>
            <div className="grid grid-cols-3 gap-2 min-[420px]:grid-cols-4">
              {g.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => clsx('relative flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-[11.5px] font-semibold leading-tight', isActive ? 'bg-brand-soft text-brand-ink' : 'bg-raised/60')}>
                  <item.icon size={20} aria-hidden />
                  {item.label}
                  {item.to === '/notifications' && unread > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand" />}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TOAST_ICON = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle } as const;
const TOAST_COLOR = { success: 'text-ok', error: 'text-danger', info: 'text-info', warning: 'text-warn' } as const;

function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:items-end">
      {toasts.map((t) => {
        const I = TOAST_ICON[t.tone];
        return (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-2xl border border-line bg-surface p-4 shadow-lift">
            <I size={20} className={clsx('mt-0.5 shrink-0', TOAST_COLOR[t.tone])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
            </div>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Fermer la notification" className="rounded-lg p-1 text-muted hover:bg-raised">
              <X size={16} aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function BootNotice() {
  const notice = useBank((s) => s.bootNotice);
  const dismiss = useBank((s) => s.dismissBootNotice);
  if (!notice) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm" role="alert">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
      <p className="flex-1">{notice}</p>
      <button type="button" onClick={dismiss} className="font-semibold text-brand-ink">
        OK
      </button>
    </div>
  );
}

/** Écrans principaux affichés sur le dégradé plein écran. */
// Hauteur du dégradé par écran : il doit couvrir tout le contenu blanc posé dessus.
const HERO_ROUTES = new Map<string, number>([['/', 780], ['/prets', 820], ['/cartes', 1500], ['/paiements', 640], ['/profil', 720]]);

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const theme = useResolvedTheme();
  const animations = useBank((s) => s.state.settings.animations);
  const appName = 'VBanque';
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101014' : '#7656F6');
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !animations);
  }, [animations]);
  useEffect(() => {
    document.title = `${appName} — Simulation bancaire`;
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const onHero = HERO_ROUTES.has(location.pathname);
  return (
    <div className="flex min-h-dvh">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        {onHero && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 bg-[linear-gradient(180deg,#9C80FF_0%,#7656F6_20%,#5E42DE_40%,#4C32B8_60%,#2B1C6E_84%,rgb(var(--bg))_100%)]"
            style={{ height: HERO_ROUTES.get(location.pathname) }}
          />
        )}
        <Header onHero={onHero} />
        <main id="contenu" className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-36 pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
          <BootNotice />
          <div key={location.pathname} className="animate-rise">
            {children}
          </div>
        </main>
        <footer className="no-print hidden border-t border-line px-8 py-4 text-center text-xs text-muted lg:block">
          <strong className="font-bold text-ink/70">SIMULATION BANCAIRE — ARGENT ET CRÉDITS FICTIFS.</strong> {appName}, application créée par Titi, n’est affiliée à aucune banque, ne détient aucun fonds et n’effectue aucun paiement réel.{' '}
          <Link to="/aide" className="font-semibold text-brand-ink hover:underline">
            <BookOpen size={12} className="inline" aria-hidden /> En savoir plus
          </Link>
        </footer>
      </div>
      <BottomNav />
      <MoreSheet />
      <GlobalModals />
      <SearchModal />
      <LockScreen />
      <Toaster />
    </div>
  );
}
