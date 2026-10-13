import clsx from 'clsx';
import { Brain, Check, Pencil, Plus, Send, Trash2, X, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { del, errorText, get, patch, post } from '../../lib/api';
import { formatCountdown, formatDuration } from '../../lib/format';
import type { AiMode, Character, Memory } from '../../lib/types';
import { useStore } from '../../store/store';
import { Avatar, STATUS_LABEL } from '../ui/Avatar';
import { ConfirmDialog } from '../ui/Modal';
import { Toggle } from '../ui/Toggle';

export const AI_MODE_LABELS: Record<AiMode, { label: string; help: string }> = {
  off: { label: 'Désactivée', help: 'L’IA ne répond jamais à votre place.' },
  suggest: { label: 'Suggestion', help: 'L’IA prépare une réponse que vous validez, modifiez ou supprimez.' },
  auto: { label: 'Automatique', help: 'L’IA répond après le délai si vous n’avez pas répondu.' },
  auto_with_exceptions: {
    label: 'Automatique avec exceptions',
    help: 'Réponse automatique, sauf sujets sensibles, ambigus ou exclus : confirmation demandée.',
  },
};

const MEMORY_KIND_LABEL: Record<Memory['kind'], string> = {
  fact: 'Fait',
  preference: 'Préférence',
  topic: 'Sujet',
  project: 'Projet',
  question: 'Question',
  event: 'Événement',
  pinned: 'À retenir',
};

export async function updateCharacter(id: string, body: Record<string, unknown>) {
  const { character } = await patch<{ character: Character }>(`/characters/${id}`, body);
  useStore.setState((s) => ({ characters: { ...s.characters, [character.id]: character } }));
  return character;
}

function AiSettingsEditor({ character }: { character: Character }) {
  const settings = useStore((s) => s.settings);
  const pushToast = useStore((s) => s.pushToast);
  const [delay, setDelay] = useState(String(character.ai.delaySeconds));
  const [topics, setTopics] = useState(character.ai.excludedTopics.join(', '));
  const [style, setStyle] = useState(character.ai.replyStyle);
  useEffect(() => {
    setDelay(String(character.ai.delaySeconds));
    setTopics(character.ai.excludedTopics.join(', '));
    setStyle(character.ai.replyStyle);
  }, [character.id, character.ai.delaySeconds, character.ai.excludedTopics, character.ai.replyStyle]);

  const save = async (ai: Record<string, unknown>) => {
    try {
      await updateCharacter(character.id, { ai });
    } catch (err) {
      pushToast({ kind: 'error', title: 'Paramètres IA non enregistrés', body: errorText(err) });
    }
  };
  const seconds = Number(delay);
  const effective = settings?.simulationSpeed === 'demo' && Number.isFinite(seconds) ? seconds / settings.demoDivisor : null;

  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor="ai-mode">
          Réponse IA à ma place
        </label>
        <select id="ai-mode" data-testid="ai-mode" className="input" value={character.ai.mode} onChange={(e) => void save({ mode: e.target.value })}>
          {(Object.keys(AI_MODE_LABELS) as AiMode[]).map((m) => (
            <option key={m} value={m}>
              {AI_MODE_LABELS[m].label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">{AI_MODE_LABELS[character.ai.mode].help}</p>
      </div>
      {character.ai.mode !== 'off' && (
        <>
          <div>
            <label className="label" htmlFor="ai-delay">
              Délai avant réponse (secondes)
            </label>
            <div className="flex gap-2">
              <input
                id="ai-delay"
                data-testid="ai-delay"
                className="input"
                type="number"
                min={5}
                max={604800}
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                onBlur={() => Number.isInteger(seconds) && seconds >= 5 && seconds !== character.ai.delaySeconds && void save({ delaySeconds: seconds })}
              />
              {[60, 120, 300].map((s) => (
                <button key={s} className="btn-outline shrink-0 px-2 text-xs" onClick={() => void save({ delaySeconds: s })}>
                  {formatDuration(s)}
                </button>
              ))}
            </div>
            {effective !== null && <p className="mt-1 text-xs text-warn">Mode démo : délai effectif ≈ {formatDuration(effective)}.</p>}
          </div>
          {character.ai.mode === 'auto_with_exceptions' && (
            <div>
              <label className="label" htmlFor="ai-topics">
                Sujets exclus (séparés par des virgules)
              </label>
              <input
                id="ai-topics"
                className="input"
                value={topics}
                placeholder="politique, travail…"
                onChange={(e) => setTopics(e.target.value)}
                onBlur={() =>
                  void save({
                    excludedTopics: topics
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .slice(0, 30),
                  })
                }
              />
            </div>
          )}
          <div>
            <label className="label" htmlFor="ai-style">
              Consignes de style pour cette conversation
            </label>
            <textarea
              id="ai-style"
              className="input min-h-[60px]"
              value={style}
              maxLength={600}
              placeholder="Ex. : rester bref, tutoyer, pas d’emoji…"
              onChange={(e) => setStyle(e.target.value)}
              onBlur={() => style !== character.ai.replyStyle && void save({ replyStyle: style })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MemoryList({ character }: { character: Character }) {
  const version = useStore((s) => s.memoryVersion[character.id] ?? 0);
  const pushToast = useStore((s) => s.pushToast);
  const [items, setItems] = useState<Memory[] | null>(null);
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    let alive = true;
    get<{ memories: Memory[] }>(`/characters/${character.id}/memories`)
      .then((r) => alive && setItems(r.memories))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [character.id, version]);

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      pushToast({ kind: 'error', title: 'Mémoire', body: errorText(err) });
    }
  };

  return (
    <div>
      <ul className="space-y-1.5" data-testid="memory-list">
        {items === null && <li className="text-xs text-muted">Chargement…</li>}
        {items?.length === 0 && <li className="text-xs text-muted">Aucun souvenir pour l’instant. {character.firstName} retient ce que vous lui confiez.</li>}
        {items?.map((m) => (
          <li key={m.id} className="group flex items-start gap-2 rounded-xl bg-raised/60 px-2.5 py-2 text-sm">
            <span className="mt-0.5 shrink-0 rounded-md bg-panel px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted">{MEMORY_KIND_LABEL[m.kind]}</span>
            {editing?.id === m.id ? (
              <input
                className="input py-1 text-sm"
                autoFocus
                value={editing.text}
                onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void act(() => patch(`/memories/${m.id}`, { content: editing.text })).then(() => setEditing(null));
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
            ) : (
              <span className="min-w-0 flex-1 break-words">{m.content}</span>
            )}
            <span className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
              {editing?.id === m.id ? (
                <>
                  <button className="icon-btn h-7 w-7" aria-label="Valider" onClick={() => void act(() => patch(`/memories/${m.id}`, { content: editing.text })).then(() => setEditing(null))}>
                    <Check size={14} />
                  </button>
                  <button className="icon-btn h-7 w-7" aria-label="Annuler" onClick={() => setEditing(null)}>
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button className="icon-btn h-7 w-7" aria-label="Modifier le souvenir" onClick={() => setEditing({ id: m.id, text: m.content })}>
                    <Pencil size={13} />
                  </button>
                  <button className="icon-btn h-7 w-7 hover:text-danger" aria-label="Supprimer le souvenir" onClick={() => void act(() => del(`/memories/${m.id}`))}>
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!adding.trim()) return;
          void act(() => post(`/characters/${character.id}/memories`, { content: adding.trim(), kind: 'pinned' })).then(() => setAdding(''));
        }}
      >
        <input className="input py-1.5 text-sm" placeholder="Ajouter un souvenir…" value={adding} maxLength={300} onChange={(e) => setAdding(e.target.value)} />
        <button className="btn-outline shrink-0 px-2.5" aria-label="Ajouter le souvenir" disabled={!adding.trim()}>
          <Plus size={16} />
        </button>
      </form>
      {Boolean(items?.length) && (
        <button className="mt-2 text-xs text-danger hover:underline" onClick={() => setConfirmReset(true)}>
          Réinitialiser la mémoire de {character.firstName}
        </button>
      )}
      <ConfirmDialog
        open={confirmReset}
        title="Réinitialiser la mémoire"
        message={`Tous les souvenirs de ${character.fullName} seront définitivement effacés.`}
        confirmLabel="Réinitialiser"
        danger
        onClose={() => setConfirmReset(false)}
        onConfirm={() => act(() => del(`/characters/${character.id}/memories`, { 'X-Confirm': 'RESET_MEMORY' }))}
      />
    </div>
  );
}

export function InfoPanel({ conversationId, onClose, className }: { conversationId: string; onClose(): void; className?: string }) {
  const conversation = useStore((s) => s.conversations[conversationId]);
  const character = useStore((s) => (conversation ? s.characters[conversation.characterId] : undefined));
  const me = useStore((s) => s.me);
  const pushToast = useStore((s) => s.pushToast);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!conversation || !character) return null;

  const toggleAutomation = (key: 'incomingEnabled' | 'replyEnabled', value: boolean) =>
    updateCharacter(character.id, { automation: { [key]: value } }).catch((err) => pushToast({ kind: 'error', title: 'Erreur', body: errorText(err) }));

  return (
    <aside className={clsx('scroll-thin flex h-full flex-col overflow-y-auto border-l border-line bg-panel', className)} aria-label={`Informations sur ${character.fullName}`} data-testid="info-panel">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">Informations</span>
        <button className="icon-btn h-8 w-8" aria-label="Masquer les informations" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-col items-center px-5 pb-4 pt-2 text-center">
        <Avatar character={character} size={88} showStatus />
        <h2 className="mt-3 text-lg font-semibold">{character.fullName}</h2>
        <div className="text-xs text-muted">{character.isActive ? STATUS_LABEL[character.status] : 'Désactivé'}</div>
        {character.description && <p className="mt-2 text-sm text-muted">{character.description}</p>}
      </div>
      <div className="space-y-5 px-4 pb-6">
        {character.interests.length > 0 && (
          <div>
            <div className="label">Centres d’intérêt</div>
            <div className="flex flex-wrap gap-1.5">
              {character.interests.map((i) => (
                <span key={i} className="chip">
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}
        {character.personality && (
          <div>
            <div className="label">Personnalité</div>
            <p className="text-sm text-muted">{character.personality}</p>
          </div>
        )}
        {(conversation.pendingAiReply || conversation.pendingCharacterReply) && (
          <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs">
            {conversation.pendingCharacterReply && (
              <div>
                {character.firstName} répond dans {formatCountdown(conversation.pendingCharacterReply.runAt - now)}
              </div>
            )}
            {conversation.pendingAiReply && <div>Réponse IA programmée dans {formatCountdown(conversation.pendingAiReply.runAt - now)}</div>}
          </div>
        )}
        <div className="space-y-3 rounded-2xl border border-line p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Zap size={15} className="text-accent" /> Conversation
          </div>
          <Toggle checked={character.automation.replyEnabled} onChange={(v) => void toggleAutomation('replyEnabled', v)} label={`${character.firstName} me répond`} />
          <Toggle
            checked={character.automation.incomingEnabled}
            onChange={(v) => void toggleAutomation('incomingEnabled', v)}
            label="Messages spontanés"
            description={`Entre ${character.automation.incomingMinMinutes} et ${character.automation.incomingMaxMinutes} min`}
          />
          {me?.isAdmin && (
            <button
              className="btn-outline w-full text-xs"
              data-testid="simulate-incoming"
              onClick={() =>
                post('/admin/simulate/incoming', { characterId: character.id }).catch((err) => pushToast({ kind: 'error', title: 'Simulation impossible', body: errorText(err) }))
              }
            >
              <Send size={14} /> Recevoir un message maintenant
            </button>
          )}
        </div>
        <div className="space-y-3 rounded-2xl border border-line p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Brain size={15} className="text-accent" /> Intelligence artificielle
          </div>
          <AiSettingsEditor character={character} />
        </div>
        <div>
          <div className="label">Souvenirs de {character.firstName}</div>
          <MemoryList character={character} />
        </div>
        <Link to={`/characters/${character.id}`} className="btn-outline w-full">
          <Pencil size={15} /> Modifier le personnage
        </Link>
      </div>
    </aside>
  );
}
