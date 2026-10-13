import { Loader2, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { onUnauthorized } from './lib/api';
import { AdminPage } from './pages/AdminPage';
import { CharactersPage } from './pages/CharactersPage';
import { ChatsPage } from './pages/ChatsPage';
import { ContactsPage } from './pages/ContactsPage';
import { LoginPage } from './pages/LoginPage';
import { MailPage } from './pages/MailPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { connectRealtime, disconnectRealtime, resumeRealtime } from './store/realtime';
import { useStore } from './store/store';

function Splash({ error }: { error?: string | null }) {
  const bootstrap = useStore((s) => s.bootstrap);
  return (
    <div className="h-app flex flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="max-w-sm text-sm text-danger">Serveur injoignable : {error}</p>
          <button className="btn-primary" onClick={() => void bootstrap()}>
            <RefreshCw size={16} /> Réessayer
          </button>
        </>
      ) : (
        <Loader2 className="animate-spin text-accent" size={28} />
      )}
    </div>
  );
}

export function App() {
  const status = useStore((s) => s.status);
  const bootError = useStore((s) => s.bootError);
  const isAdmin = useStore((s) => s.me?.isAdmin);
  const location = useLocation();

  useEffect(() => {
    onUnauthorized(() => {
      disconnectRealtime();
      useStore.getState().setAnonymous();
    });
    void useStore.getState().bootstrap();
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    connectRealtime();
    const onVisible = () => document.visibilityState === 'visible' && resumeRealtime();
    const onOnline = () => resumeRealtime();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [status]);

  if (status === 'loading' || status === 'error') return <Splash error={status === 'error' ? bootError : null} />;
  if (status === 'anonymous') {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname }} />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/chats" replace />} />
      <Route element={<AppShell />}>
        <Route path="/chats" element={<ChatsPage />} />
        <Route path="/chats/:conversationId" element={<ChatsPage />} />
        <Route path="/mail" element={<MailPage />} />
        <Route path="/mail/:view" element={<MailPage />} />
        <Route path="/mail/:view/:entryId" element={<MailPage />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/characters" element={<CharactersPage />} />
        <Route path="/characters/:characterId" element={<CharactersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {isAdmin && <Route path="/admin" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="/chats" replace />} />
      </Route>
    </Routes>
  );
}
