import clsx from 'clsx';
import { Activity, Bot, Database, Download, Pause, Play, PlayCircle, RefreshCw, RotateCcw, Send, Server, Wifi, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Section } from '../components/ui/Empty';
import { ConfirmDialog } from '../components/ui/Modal';
import { api, errorText, get, post } from '../lib/api';
import { formatCountdown, formatFull } from '../lib/format';
import type { AiStatus, GlobalSettings, ProviderInfo, Task } from '../lib/types';
import { useStore } from '../store/store';

interface AdminStatus {
  server: { uptimeMs: number; env: string; node: string; time: number };
  database: { ok: boolean; file: string };
  scheduler: { running: boolean; paused: boolean; lastTickAt: number | null; inFlight: number; processed: number; failures: number };
  tasks: Record<string, number>;
  realtime: { clients: number };
  ai: { status: AiStatus; providers: ProviderInfo[]; usage: { day: string; calls: number; errors: number; inputTokens: number; outputTokens: number; limit: number } };
  settings: GlobalSettings;
  recentErrors: Array<{ id: number; scope: string; message: string; created_at: number }>;
}

interface LogRow {
  id: number;
  level: string;
  scope: string;
  message: string;
  data: string | null;
  createdAt: number;
}

const TASK_LABEL: Record<Task['type'], string> = {
  character_reply: 'Réponse du personnage',
  character_initiate: 'Message spontané',
  character_part: 'Suite de rafale',
  ai_reply: 'Réponse IA à ma place',
};

const STATUS_STYLE: Record<Task['status'], string> = {
  pending: 'bg-accent/15 text-accent',
  running: 'bg-warn/15 text-warn',
  done: 'bg-ok/15 text-ok',
  cancelled: 'bg-raised text-muted',
  superseded: 'bg-raised text-muted',
  failed: 'bg-danger/15 text-danger',
};

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'danger' }) {
  return (
    <div className="card flex items-start gap-3 p-4">
      <div className={clsx('rounded-xl p-2', tone === 'ok' ? 'bg-ok/15 text-ok' : tone === 'danger' ? 'bg-danger/15 text-danger' : tone === 'warn' ? 'bg-warn/15 text-warn' : 'bg-raised text-accent')}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="truncate text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const characters = useStore((s) => s.characters);
  const pushToast = useStore((s) => s.pushToast);
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskFilter, setTaskFilter] = useState<string>('pending');
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logLevel, setLogLevel] = useState('');
  const [testing, setTesting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [simulateFor, setSimulateFor] = useState('');
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    try {
      const [s, t, l] = await Promise.all([
        get<AdminStatus>('/admin/status'),
        get<{ tasks: Task[] }>('/admin/tasks', { status: taskFilter || undefined, limit: 200 }),
        get<{ logs: LogRow[] }>('/admin/logs', { level: logLevel || undefined, limit: 150 }),
      ]);
      setStatus(s);
      setTasks(t.tasks);
      setLogs(l.logs);
      useStore.setState({ aiStatus: s.ai.status, settings: s.settings });
    } catch (err) {
      pushToast({ kind: 'error', title: 'Administration indisponible', body: errorText(err) });
    }
  }, [taskFilter, logLevel, pushToast]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 4000);
    const c = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(t);
      clearInterval(c);
    };
  }, [refresh]);

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) pushToast({ kind: 'success', title: success });
      await refresh();
    } catch (err) {
      pushToast({ kind: 'error', title: 'Action impossible', body: errorText(err) });
    }
  };

  const exportData = async () => {
    try {
      const data = await api<unknown>('GET', '/admin/export', { timeoutMs: 60_000 });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cercle-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      pushToast({ kind: 'error', title: 'Export impossible', body: errorText(err) });
    }
  };

  const ai = status?.ai.status;
  const paused = status?.settings.automationPaused;
  const charName = (id: string | null) => (id ? characters[id]?.fullName ?? id.slice(0, 10) : '—');

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Administration"
        subtitle="État réel du serveur, des tâches et des services"
        actions={
          <button className="icon-btn" aria-label="Rafraîchir" onClick={() => void refresh()}>
            <RefreshCw size={18} />
          </button>
        }
      />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-6">
          {status && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={<Server size={18} />} label="Serveur" value={`En ligne · ${Math.round(status.server.uptimeMs / 60000)} min · ${status.server.node}`} tone="ok" />
              <Stat icon={<Database size={18} />} label="Base de données" value={status.database.ok ? 'Opérationnelle (SQLite)' : 'Erreur'} tone={status.database.ok ? 'ok' : 'danger'} />
              <Stat
                icon={<Activity size={18} />}
                label="Planificateur"
                value={paused ? 'Suspendu' : status.scheduler.running ? `Actif · ${status.scheduler.processed} traitées` : 'Arrêté'}
                tone={paused ? 'warn' : status.scheduler.running ? 'ok' : 'danger'}
              />
              <Stat icon={<Wifi size={18} />} label="Temps réel" value={`${status.realtime.clients} client(s) connecté(s)`} />
            </div>
          )}

          <Section
            title="Fournisseur IA"
            description="L’état « vérifié » n’est affiché qu’après un appel de test réussi."
            actions={
              <button
                className="btn-outline"
                disabled={testing}
                data-testid="ai-test"
                onClick={async () => {
                  setTesting(true);
                  await run(() => post('/admin/ai/test'));
                  setTesting(false);
                }}
              >
                <Bot size={16} /> {testing ? 'Test en cours…' : 'Tester le fournisseur'}
              </button>
            }
          >
            {ai && status && (
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <div className="label">Fournisseur</div>
                  {ai.provider === 'anthropic' ? `Claude (${status.ai.providers.find((p) => p.id === 'anthropic')?.model})` : 'Simulation locale (aucune IA réelle)'}
                </div>
                <div>
                  <div className="label">État</div>
                  <span data-testid="ai-state" className={ai.state === 'ok' ? 'text-ok' : ai.state === 'error' ? 'text-danger' : 'text-muted'}>
                    {ai.state === 'ok' ? `Vérifié (${ai.latencyMs} ms)` : ai.state === 'error' ? `Erreur : ${ai.error}` : 'Non vérifié'}
                  </span>
                  {ai.checkedAt && <div className="text-xs text-faint">{formatFull(ai.checkedAt)}</div>}
                </div>
                <div>
                  <div className="label">Consommation du jour</div>
                  {status.ai.usage.calls} / {status.ai.usage.limit} appels · {status.ai.usage.errors} erreur(s)
                  <div className="text-xs text-faint">
                    {status.ai.usage.inputTokens} jetons entrée · {status.ai.usage.outputTokens} sortie
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Section title="Actions">
            <div className="flex flex-wrap gap-2">
              <button className={paused ? 'btn-primary' : 'btn-outline'} data-testid="toggle-automation" onClick={() => void run(() => post('/admin/automation', { paused: !paused }), paused ? 'Automatisations reprises' : 'Automatisations suspendues')}>
                {paused ? <Play size={16} /> : <Pause size={16} />} {paused ? 'Reprendre les automatisations' : 'Suspendre les automatisations'}
              </button>
              <button className="btn-outline" onClick={() => void exportData()}>
                <Download size={16} /> Exporter les données
              </button>
              <button className="btn-danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={16} /> Réinitialiser la démonstration
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <label className="min-w-[200px] flex-1 sm:max-w-xs">
                <span className="label">Simuler un message entrant</span>
                <select className="input" value={simulateFor} onChange={(e) => setSimulateFor(e.target.value)} data-testid="simulate-select">
                  <option value="">Choisir un personnage</option>
                  {Object.values(characters)
                    .filter((c) => c.isActive)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                </select>
              </label>
              <button className="btn-primary" disabled={!simulateFor} data-testid="simulate-button" onClick={() => void run(() => post('/admin/simulate/incoming', { characterId: simulateFor }), 'Message entrant déclenché')}>
                <Send size={16} /> Déclencher
              </button>
            </div>
          </Section>

          <Section
            title="Tâches automatiques"
            actions={
              <select className="input w-auto py-1.5 text-xs" value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} aria-label="Filtrer les tâches">
                <option value="pending">En attente</option>
                <option value="running">En cours</option>
                <option value="done">Terminées</option>
                <option value="failed">En échec</option>
                <option value="superseded">Remplacées</option>
                <option value="cancelled">Annulées</option>
                <option value="">Toutes</option>
              </select>
            }
          >
            {status && (
              <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
                {Object.entries(status.tasks).map(([k, n]) => (
                  <span key={k} className={clsx('rounded-full px-2 py-0.5', STATUS_STYLE[k as Task['status']] ?? 'bg-raised')}>
                    {k} : {n}
                  </span>
                ))}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-faint">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Personnage</th>
                    <th className="py-2 pr-3 font-medium">Échéance</th>
                    <th className="py-2 pr-3 font-medium">État</th>
                    <th className="py-2 pr-3 font-medium">Essais</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-t border-line align-top">
                      <td className="py-2 pr-3">{TASK_LABEL[t.type]}</td>
                      <td className="py-2 pr-3">{charName(t.characterId)}</td>
                      <td className="py-2 pr-3 text-muted">
                        {t.status === 'pending' ? `dans ${formatCountdown(t.runAt - now)}` : formatFull(t.updatedAt)}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={clsx('rounded-full px-2 py-0.5 text-xs', STATUS_STYLE[t.status])}>{t.status}</span>
                        {t.lastError && <div className="mt-1 max-w-xs text-xs text-danger">{t.lastError}</div>}
                        {t.result && 'reason' in t.result && <div className="mt-1 text-xs text-faint">{String(t.result.reason)}</div>}
                      </td>
                      <td className="py-2 pr-3 text-muted">
                        {t.attempts}/{t.maxAttempts}
                      </td>
                      <td className="py-2 text-right">
                        {t.status === 'pending' && (
                          <span className="inline-flex gap-1">
                            <button className="icon-btn h-8 w-8" title="Exécuter maintenant" aria-label="Exécuter maintenant" onClick={() => void run(() => post(`/admin/tasks/${t.id}/run-now`))}>
                              <PlayCircle size={16} />
                            </button>
                            <button className="icon-btn h-8 w-8 hover:text-danger" title="Annuler" aria-label="Annuler la tâche" onClick={() => void run(() => post(`/admin/tasks/${t.id}/cancel`))}>
                              <XCircle size={16} />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted">
                        Aucune tâche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Journaux techniques"
            actions={
              <select className="input w-auto py-1.5 text-xs" value={logLevel} onChange={(e) => setLogLevel(e.target.value)} aria-label="Niveau de journal">
                <option value="">Tous</option>
                <option value="info">Info</option>
                <option value="warn">Avertissements</option>
                <option value="error">Erreurs</option>
              </select>
            }
          >
            <div className="scroll-thin max-h-96 space-y-1 overflow-y-auto font-mono text-xs">
              {logs.map((l) => (
                <div key={l.id} className="flex gap-2 rounded-lg px-2 py-1 hover:bg-raised">
                  <span className="shrink-0 text-faint">{new Date(l.createdAt).toLocaleTimeString('fr-FR')}</span>
                  <span className={clsx('w-12 shrink-0 uppercase', l.level === 'error' ? 'text-danger' : l.level === 'warn' ? 'text-warn' : 'text-accent')}>{l.level}</span>
                  <span className="shrink-0 text-muted">{l.scope}</span>
                  <span className="min-w-0 break-words">
                    {l.message}
                    {l.data && <span className="block text-faint">{l.data}</span>}
                  </span>
                </div>
              ))}
              {logs.length === 0 && <div className="py-4 text-center text-muted">Aucun journal.</div>}
            </div>
          </Section>
        </div>
      </div>
      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser les données de démonstration"
        message="Toutes les conversations, messages, souvenirs, notifications, tâches et personnages seront supprimés puis recréés. Exportez d’abord vos données si besoin."
        confirmLabel="Tout réinitialiser"
        requireText="RESET"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => run(() => post('/admin/reset', {}, { 'X-Confirm': 'RESET_DEMO' }), 'Démonstration réinitialisée')}
      />
    </div>
  );
}
