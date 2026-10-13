import { Loader2, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/layout/AppShell';
import { errorText, post } from '../lib/api';
import { useStore } from '../store/store';

export function LoginPage() {
  const [username, setUsername] = useState('moi');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bootstrap = useStore((s) => s.bootstrap);
  const navigate = useNavigate();

  return (
    <div className="h-app flex items-center justify-center bg-bg p-4">
      <form
        className="card w-full max-w-sm p-6 shadow-2xl"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await post('/auth/login', { username, password });
            await bootstrap();
            navigate('/chats', { replace: true });
          } catch (err) {
            setError(errorText(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mb-6 flex items-center gap-3">
          <Logo size={44} />
          <div>
            <h1 className="text-xl font-semibold">Cercle</h1>
            <p className="text-sm text-muted">Votre messagerie multi-personnages</p>
          </div>
        </div>
        <label className="label" htmlFor="username">
          Identifiant
        </label>
        <input id="username" className="input mb-3" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        <label className="label" htmlFor="password">
          Mot de passe
        </label>
        <input
          id="password"
          type="password"
          className="input mb-4"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && (
          <p className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <button className="btn-primary w-full py-2.5" disabled={busy || !password}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Se connecter
        </button>
        <p className="mt-4 text-center text-xs text-faint">Identifiants définis par APP_USERNAME / APP_PASSWORD (voir README).</p>
      </form>
    </div>
  );
}
