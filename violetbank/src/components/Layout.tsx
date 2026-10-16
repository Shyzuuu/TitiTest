import clsx from 'clsx';
import {
  ArrowDownLeft, ArrowLeftRight, Bell, BookOpen, CalendarDays, Calculator, ChartPie, ChevronsLeft, ChevronsRight, CircleHelp, CreditCard,
  FileClock, FolderOpen, HandCoins, History, Home, Landmark, LayoutGrid, Moon, PiggyBank, Plus, RotateCcw, Scale, Send, Settings,
  Sun, Target, User, Users, Wallet, X, AlertTriangle, CheckCircle2, Info, XCircle, FlaskConical,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { formatDate } from '../domain/dates';
import { useResolvedTheme, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';
import { Logo, LogoMark } from './Logo';
import { GlobalModals } from './OperationModals';
import { Avatar, IconButton } from './ui';

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

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Bonsoir' : h < 18 ? 'Bonjour' : 'Bonsoir';
}

function Header() {
  const profile = useBank((s) => s.state.profile);
  const simDate = useBank((s) => s.state.settings.simulationDate);
  const update = useBank((s) => s.update);
  const theme = useResolvedTheme();
  const today = useToday();
  const unread = useUnread();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <p className="bg-gradient-to-r from-brand-deep via-brand to-brand-deep py-1 text-center text-[10px] font-extrabold uppercase tracking-[.14em] text-white sm:text-[11px]">
        Simulation bancaire — argent et crédits fictifs
      </p>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
        <Link to="/" className="lg:hidden" aria-label="Accueil">
          <LogoMark size={34} />
        </Link>
        <Link to="/profil" className="hidden items-center gap-3 sm:flex">
          <Avatar emoji={profile.avatarEmoji} color={profile.avatarColor} size={40} />
          <span className="min-w-0 leading-tight">
            <span className="block text-xs text-muted">{greeting()},</span>
            <span className="block truncate font-bold">{profile.displayName}</span>
          </span>
        </Link>
        <span className="min-w-0 truncate font-bold sm:hidden">
          {greeting()}, {profile.displayName}
        </span>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {simDate && (
            <Link to="/parametres#horloge" className="hidden rounded-full bg-info/15 px-2.5 py-1 text-xs font-semibold text-info md:inline">
              Horloge de test : {formatDate(today)}
            </Link>
          )}
          <SimulationBadge />
          <IconButton
            icon={theme === 'dark' ? Sun : Moon}
            label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            onClick={() => update((s) => ({ ...s, settings: { ...s.settings, theme: theme === 'dark' ? 'light' : 'dark' } }))}
          />
          <Link to="/notifications" className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl transition hover:bg-raised" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}>
            <Bell size={19} aria-hidden />
            {unread > 0 && <span className="num absolute right-1 top-1 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-bold leading-[18px] text-white">{unread > 99 ? '99+' : unread}</span>}
          </Link>
          <Link to="/parametres" className="hidden h-10 w-10 items-center justify-center rounded-2xl transition hover:bg-raised sm:inline-flex" aria-label="Paramètres">
            <Settings size={19} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  const open = useUi((s) => s.openModal);
  const setMore = useUi((s) => s.setMoreOpen);
  const items: NavItem[] = [
    { to: '/', label: 'Accueil', icon: Home, end: true },
    { to: '/cartes', label: 'Cartes', icon: CreditCard },
  ];
  const right: NavItem[] = [{ to: '/prets', label: 'Prêts', icon: HandCoins }];
  const link = (item: NavItem) => (
    <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => clsx('flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold transition', isActive ? 'text-brand-ink' : 'text-muted')}>
      <item.icon size={22} aria-hidden />
      {item.label}
    </NavLink>
  );
  return (
    <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-end px-2">
        {items.map(link)}
        <div className="flex flex-1 justify-center">
          <button type="button" onClick={() => open('quick')} aria-label="Actions rapides" className="-mt-5 flex h-14 w-14 items-center justify-center rounded-[20px] bg-brand text-white shadow-glow transition active:scale-95">
            <Plus size={26} aria-hidden />
          </button>
        </div>
        {right.map(link)}
        <button type="button" onClick={() => setMore(true)} className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-semibold text-muted">
          <LayoutGrid size={22} aria-hidden />
          Plus
        </button>
      </div>
    </nav>
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

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const theme = useResolvedTheme();
  const animations = useBank((s) => s.state.settings.animations);
  const appName = useBank((s) => s.state.settings.appName);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101014' : '#7656F6');
  }, [theme]);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !animations);
  }, [animations]);
  useEffect(() => {
    document.title = `${appName} — Simulation bancaire`;
  }, [appName]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="flex min-h-dvh">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-5 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
          <BootNotice />
          <div key={location.pathname} className="animate-rise">
            {children}
          </div>
        </main>
        <footer className="no-print hidden border-t border-line px-8 py-4 text-center text-xs text-muted lg:block">
          <strong className="font-bold text-ink/70">SIMULATION BANCAIRE — ARGENT ET CRÉDITS FICTIFS.</strong> {appName} n’est affiliée à aucune banque, ne détient aucun fonds et n’effectue aucun paiement réel.{' '}
          <Link to="/aide" className="font-semibold text-brand-ink hover:underline">
            <BookOpen size={12} className="inline" aria-hidden /> En savoir plus
          </Link>
        </footer>
      </div>
      <BottomNav />
      <MoreSheet />
      <GlobalModals />
      <Toaster />
    </div>
  );
}
