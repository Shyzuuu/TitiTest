import clsx from 'clsx';
import { Bell, Contact, Inbox, LogOut, MessageCircle, Settings, Shield, Users, WifiOff, PauseCircle, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { post } from '../../lib/api';
import { disconnectRealtime } from '../../store/realtime';
import { useStore } from '../../store/store';
import { Toasts } from '../ui/Toasts';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  mobile?: boolean;
  adminOnly?: boolean;
}

function useNavItems(): NavItem[] {
  const unreadMessages = useStore((s) => Object.values(s.conversations).reduce((n, c) => n + c.unreadCount, 0));
  const unreadMail = useStore((s) => s.mailboxCounts.unreadInbox);
  const unreadNotifs = useStore((s) => s.unreadNotifications);
  return [
    { to: '/chats', label: 'Messages', icon: <MessageCircle size={20} />, badge: unreadMessages, mobile: true },
    { to: '/mail', label: 'Boîte mail', icon: <Inbox size={20} />, badge: unreadMail, mobile: true },
    { to: '/contacts', label: 'Contacts', icon: <Contact size={20} />, mobile: true },
    { to: '/notifications', label: 'Notifications', icon: <Bell size={20} />, badge: unreadNotifs, mobile: true },
    { to: '/characters', label: 'Personnages', icon: <Users size={20} /> },
    { to: '/settings', label: 'Paramètres', icon: <Settings size={20} />, mobile: true },
    { to: '/admin', label: 'Administration', icon: <Shield size={20} />, adminOnly: true },
  ];
}

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-semibold leading-[18px] text-accent-ink">
      {n > 99 ? '99+' : n}
    </span>
  );
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <img src="/favicon.svg" width={size} height={size} alt="Cercle" className="rounded-xl" />
  );
}

function StatusBanner() {
  const connection = useStore((s) => s.connection);
  const paused = useStore((s) => s.settings?.automationPaused);
  if (connection === 'online' && !paused) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-line bg-raised px-3 py-1.5 text-xs" role="status">
      {connection === 'offline' && (
        <span className="inline-flex items-center gap-1.5 text-warn">
          <WifiOff size={14} /> Connexion perdue — reconnexion en cours, vos messages restent en file.
        </span>
      )}
      {(connection === 'resyncing' || connection === 'connecting') && (
        <span className="inline-flex items-center gap-1.5 text-muted">
          <Loader2 size={14} className="animate-spin" /> Synchronisation…
        </span>
      )}
      {paused && (
        <NavLink to="/admin" className="inline-flex items-center gap-1.5 text-warn hover:underline">
          <PauseCircle size={14} /> Automatisations suspendues
        </NavLink>
      )}
    </div>
  );
}

export function AppShell() {
  const items = useNavItems();
  const me = useStore((s) => s.me);
  const setAnonymous = useStore((s) => s.setAnonymous);
  const location = useLocation();
  const navigate = useNavigate();
  // Sur mobile, une conversation ouverte occupe tout l'écran : la barre du bas est masquée.
  const inConversation = /^\/chats\/[^/]+/.test(location.pathname);
  const visible = items.filter((i) => !i.adminOnly || me?.isAdmin);

  const logout = async () => {
    try {
      await post('/auth/logout');
    } finally {
      disconnectRealtime();
      setAnonymous();
      navigate('/login');
    }
  };

  return (
    <div className="h-app flex flex-col overflow-hidden">
      <StatusBanner />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Navigation principale" className="hidden w-[72px] shrink-0 flex-col items-center gap-1 border-r border-line bg-panel py-3 md:flex">
          <NavLink to="/chats" className="mb-3" aria-label="Accueil Cercle">
            <Logo />
          </NavLink>
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                clsx('icon-btn relative h-11 w-11', isActive && 'bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent')
              }
            >
              {item.icon}
              <Badge n={item.badge} />
            </NavLink>
          ))}
          <div className="mt-auto flex flex-col items-center gap-2">
            <NavLink
              to="/settings"
              title={me ? `${me.displayName} — profil` : 'Profil'}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-fuchsia-400 text-sm font-semibold text-white"
            >
              {(me?.displayName ?? '?').slice(0, 1).toUpperCase()}
            </NavLink>
            <button className="icon-btn" title="Se déconnecter" aria-label="Se déconnecter" onClick={logout}>
              <LogOut size={18} />
            </button>
          </div>
        </nav>
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
      {!inConversation && (
        <nav aria-label="Navigation mobile" className="safe-bottom flex shrink-0 border-t border-line bg-panel md:hidden">
          {visible
            .filter((i) => i.mobile)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  clsx('relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px]', isActive ? 'text-accent' : 'text-muted')
                }
              >
                <span className="relative">
                  {item.icon}
                  <Badge n={item.badge} />
                </span>
                {item.label.split(' ')[0]}
              </NavLink>
            ))}
        </nav>
      )}
      <Toasts />
    </div>
  );
}
