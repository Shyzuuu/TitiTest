import { KeyRound, Moon, Save, Sun, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Section } from '../components/ui/Empty';
import { Toggle } from '../components/ui/Toggle';
import { errorText, patch, post } from '../lib/api';
import { readString, writeString } from '../lib/storage';
import type { AiStatus, GlobalSettings, Me, ProviderInfo } from '../lib/types';
import { useStore } from '../store/store';

type Theme = 'dark' | 'light' | 'system';

export function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f3f4f8' : '#0b0d14');
}

export function SettingsPage() {
  const me = useStore((s) => s.me);
  const settings = useStore((s) => s.settings);
  const providers = useStore((s) => s.providers);
  const aiStatus = useStore((s) => s.aiStatus);
  const pushToast = useStore((s) => s.pushToast);
  const [theme, setTheme] = useState<Theme>(() => (readString('cercle:theme') as Theme) ?? 'dark');
  const [profile, setProfile] = useState({ displayName: me?.displayName ?? '', bio: me?.bio ?? '' });
  const [persona, setPersona] = useState(settings?.userPersona ?? '');
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });

  useEffect(() => setPersona(settings?.userPersona ?? ''), [settings?.userPersona]);

  const saveSettings = async (body: Partial<GlobalSettings>) => {
    try {
      const res = await patch<{ settings: GlobalSettings; aiStatus: AiStatus; providers: ProviderInfo[] }>('/settings', body);
      useStore.setState({ settings: res.settings, aiStatus: res.aiStatus, providers: res.providers });
    } catch (err) {
      pushToast({ kind: 'error', title: 'Paramètres non enregistrés', body: errorText(err) });
    }
  };

  if (!settings) return null;
  const anthropic = providers.find((p) => p.id === 'anthropic');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title="Paramètres" subtitle="Profil, apparence, automatisations et IA" />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
          <Section title="Mon profil">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Nom affiché</span>
                <input className="input" maxLength={60} value={profile.displayName} onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))} />
              </label>
              <label>
                <span className="label">Identifiant</span>
                <input className="input" value={me?.username ?? ''} disabled />
              </label>
              <label className="sm:col-span-2">
                <span className="label">Bio</span>
                <textarea className="input min-h-[60px]" maxLength={500} value={profile.bio} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} />
              </label>
            </div>
            <button
              className="btn-primary mt-3"
              disabled={!profile.displayName.trim()}
              onClick={async () => {
                try {
                  const res = await patch<{ user: Me }>('/me', profile);
                  useStore.setState({ me: res.user });
                  pushToast({ kind: 'success', title: 'Profil enregistré' });
                } catch (err) {
                  pushToast({ kind: 'error', title: 'Profil non enregistré', body: errorText(err) });
                }
              }}
            >
              <Save size={16} /> Enregistrer
            </button>
          </Section>

          <Section title="Apparence">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['dark', 'Sombre', Moon],
                  ['light', 'Clair', Sun],
                  ['system', 'Système', Monitor],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={theme === id ? 'btn border border-accent bg-accent/10 text-accent' : 'btn-outline'}
                  onClick={() => {
                    setTheme(id);
                    writeString('cercle:theme', id);
                    applyTheme(id);
                  }}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Automatisations" description="Messages spontanés, réponses des personnages et réponses IA programmées.">
            <div className="space-y-4">
              <Toggle
                checked={settings.automationPaused}
                onChange={(v) => void saveSettings({ automationPaused: v })}
                label="Suspendre toutes les automatisations"
                description="Les tâches restent en file et reprennent à la réactivation."
              />
              <div>
                <span className="label">Vitesse de simulation</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    data-testid="speed-normal"
                    className={settings.simulationSpeed === 'normal' ? 'btn border border-accent bg-accent/10 text-accent' : 'btn-outline'}
                    onClick={() => void saveSettings({ simulationSpeed: 'normal' })}
                  >
                    Normale
                  </button>
                  <button
                    data-testid="speed-demo"
                    className={settings.simulationSpeed === 'demo' ? 'btn border border-accent bg-accent/10 text-accent' : 'btn-outline'}
                    onClick={() => void saveSettings({ simulationSpeed: 'demo' })}
                  >
                    Démo rapide
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">En mode démo, tous les délais sont divisés par {settings.demoDivisor} (2 min → {Math.round(120 / settings.demoDivisor)} s).</p>
              </div>
              <label className="block max-w-xs">
                <span className="label">Facteur d’accélération démo</span>
                <input type="number" min={1} max={600} className="input" defaultValue={settings.demoDivisor} onBlur={(e) => Number(e.target.value) >= 1 && void saveSettings({ demoDivisor: Number(e.target.value) })} />
              </label>
              <label className="block max-w-xs">
                <span className="label">Réponses automatiques consécutives max.</span>
                <input type="number" min={1} max={20} className="input" defaultValue={settings.maxAutoChain} onBlur={(e) => Number(e.target.value) >= 1 && void saveSettings({ maxAutoChain: Number(e.target.value) })} />
                <span className="mt-1 block text-xs text-faint">Évite une conversation infinie entre l’IA et un personnage.</span>
              </label>
            </div>
          </Section>

          <Section title="Intelligence artificielle" description="Les appels IA sont faits uniquement par le serveur ; la clé reste dans ses variables d’environnement.">
            <div className="space-y-4">
              <div className="rounded-xl bg-raised/60 p-3 text-sm">
                <div>
                  Fournisseur actif : <strong>{aiStatus?.provider === 'anthropic' ? 'Claude (API Anthropic)' : 'Simulation locale (sans IA réelle)'}</strong>
                </div>
                <div className="text-xs text-muted">
                  État :{' '}
                  {aiStatus?.state === 'ok' ? (
                    <span className="text-ok">vérifié</span>
                  ) : aiStatus?.state === 'error' ? (
                    <span className="text-danger">erreur — {aiStatus.error}</span>
                  ) : (
                    'non vérifié (testez-le depuis l’administration)'
                  )}
                </div>
                {!anthropic?.configured && <div className="mt-1 text-xs text-muted">Pour utiliser Claude, définissez ANTHROPIC_API_KEY côté serveur (voir README).</div>}
              </div>
              <label className="block max-w-sm">
                <span className="label">Fournisseur</span>
                <select
                  className="input"
                  value={settings.aiProvider ?? ''}
                  onChange={(e) => void saveSettings({ aiProvider: (e.target.value || null) as GlobalSettings['aiProvider'] })}
                >
                  <option value="">Automatique (Claude si configuré)</option>
                  <option value="anthropic" disabled={!anthropic?.configured}>
                    Claude (API Anthropic){anthropic?.configured ? '' : ' — non configuré'}
                  </option>
                  <option value="local">Simulation locale</option>
                </select>
              </label>
              <label className="block max-w-xs">
                <span className="label">Plafond d’appels IA par jour</span>
                <input type="number" min={0} className="input" defaultValue={settings.aiDailyCallLimit} onBlur={(e) => void saveSettings({ aiDailyCallLimit: Number(e.target.value) })} />
              </label>
              <Toggle
                checked={settings.aiFallbackToLocal}
                onChange={(v) => void saveSettings({ aiFallbackToLocal: v })}
                label="Repli sur la simulation locale en cas de panne"
                description="Les personnages continuent de répondre ; une réponse à votre place n’est jamais envoyée par le repli sans validation."
              />
              <label className="block">
                <span className="label">Ma façon d’écrire (utilisée par l’IA qui répond à ma place)</span>
                <textarea className="input min-h-[70px]" maxLength={1000} value={persona} onChange={(e) => setPersona(e.target.value)} onBlur={() => persona !== settings.userPersona && void saveSettings({ userPersona: persona })} />
              </label>
            </div>
          </Section>

          <Section title="Sécurité">
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await post('/me/password', pwd);
                  pushToast({ kind: 'success', title: 'Mot de passe modifié', body: 'Reconnectez-vous.' });
                  window.location.assign('/login');
                } catch (err) {
                  pushToast({ kind: 'error', title: 'Modification impossible', body: errorText(err) });
                }
              }}
            >
              <label>
                <span className="label">Mot de passe actuel</span>
                <input type="password" className="input" autoComplete="current-password" value={pwd.currentPassword} onChange={(e) => setPwd((p) => ({ ...p, currentPassword: e.target.value }))} />
              </label>
              <label>
                <span className="label">Nouveau mot de passe (8+ caractères)</span>
                <input type="password" className="input" autoComplete="new-password" value={pwd.newPassword} onChange={(e) => setPwd((p) => ({ ...p, newPassword: e.target.value }))} />
              </label>
              <button className="btn-outline w-fit" disabled={!pwd.currentPassword || pwd.newPassword.length < 8}>
                <KeyRound size={16} /> Changer le mot de passe
              </button>
            </form>
          </Section>
        </div>
      </div>
    </div>
  );
}
