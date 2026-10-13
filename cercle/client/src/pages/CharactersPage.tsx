import clsx from 'clsx';
import { MessageCircle, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AI_MODE_LABELS, updateCharacter } from '../components/info/InfoPanel';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar, STATUS_LABEL } from '../components/ui/Avatar';
import { Section } from '../components/ui/Empty';
import { ConfirmDialog } from '../components/ui/Modal';
import { Toggle } from '../components/ui/Toggle';
import { ApiError, del, errorText, post } from '../lib/api';
import type { AiMode, Automation, AiSettings, Character, CharacterStatus } from '../lib/types';
import { useStore } from '../store/store';

type FormState = Omit<Character, 'id' | 'fullName' | 'createdAt' | 'updatedAt'>;

const DEFAULT_FORM: FormState = {
  firstName: '',
  lastName: '',
  avatarColor: '#6366f1',
  avatarEmoji: '',
  avatarUrl: null,
  description: '',
  personality: '',
  interests: [],
  languageStyle: '',
  status: 'online',
  isActive: true,
  automation: {
    incomingEnabled: true,
    incomingMinMinutes: 20,
    incomingMaxMinutes: 90,
    burstMax: 1,
    followupEnabled: false,
    followupAfterMinutes: 30,
    replyEnabled: true,
    replyDelayMinSeconds: 4,
    replyDelayMaxSeconds: 18,
  },
  ai: { mode: 'off', delaySeconds: 120, excludedTopics: [], replyStyle: '' },
};

const COLORS = ['#ec4899', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#6366f1', '#a855f7', '#64748b'];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

function CharacterEditor({ character }: { character: Character | null }) {
  const navigate = useNavigate();
  const pushToast = useStore((s) => s.pushToast);
  const conversations = useStore((s) => s.conversations);
  const [form, setForm] = useState<FormState>(() => (character ? { ...character } : DEFAULT_FORM));
  const [interestInput, setInterestInput] = useState('');
  const [errors, setErrors] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setForm(character ? { ...character } : DEFAULT_FORM);
    setErrors(null);
  }, [character?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setAuto = <K extends keyof Automation>(k: K, v: Automation[K]) => setForm((f) => ({ ...f, automation: { ...f.automation, [k]: v } }));
  const setAi = <K extends keyof AiSettings>(k: K, v: AiSettings[K]) => setForm((f) => ({ ...f, ai: { ...f.ai, [k]: v } }));
  const conversationId = character ? Object.values(conversations).find((c) => c.characterId === character.id)?.id : undefined;

  const addInterest = () => {
    const v = interestInput.trim();
    if (v && !form.interests.includes(v) && form.interests.length < 20) set('interests', [...form.interests, v]);
    setInterestInput('');
  };

  const save = async () => {
    setBusy(true);
    setErrors(null);
    const body = {
      firstName: form.firstName,
      lastName: form.lastName,
      avatarColor: form.avatarColor,
      avatarEmoji: form.avatarEmoji,
      avatarUrl: form.avatarUrl || null,
      description: form.description,
      personality: form.personality,
      interests: form.interests,
      languageStyle: form.languageStyle,
      status: form.status,
      isActive: form.isActive,
      automation: form.automation,
      ai: form.ai,
    };
    try {
      if (character) {
        await updateCharacter(character.id, body);
        pushToast({ kind: 'success', title: 'Personnage enregistré' });
      } else {
        const res = await post<{ character: Character; conversationId: string }>('/characters', body);
        useStore.setState((s) => ({ characters: { ...s.characters, [res.character.id]: res.character } }));
        pushToast({ kind: 'success', title: `${res.character.firstName} a rejoint vos contacts` });
        navigate(`/characters/${res.character.id}`, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const d = err.details as { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
        const msgs = [...(d.formErrors ?? []), ...Object.entries(d.fieldErrors ?? {}).map(([k, v]) => `${k} : ${v.join(', ')}`)];
        setErrors(msgs.join(' · ') || err.message);
      } else setErrors(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const preview = useMemo(() => ({ ...form, fullName: `${form.firstName} ${form.lastName}` }), [form]);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 sm:p-6">
      <div className="flex items-center gap-4">
        <Avatar character={preview} size={72} showStatus />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-semibold">{form.firstName || 'Nouveau personnage'} {form.lastName}</div>
          <div className="text-sm text-muted">{form.isActive ? STATUS_LABEL[form.status] : 'Désactivé'}</div>
        </div>
        {conversationId && (
          <Link to={`/chats/${conversationId}`} className="btn-outline">
            <MessageCircle size={16} /> Conversation
          </Link>
        )}
      </div>

      <Section title="Identité">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prénom">
            <input className="input" value={form.firstName} maxLength={40} onChange={(e) => set('firstName', e.target.value)} data-testid="character-first-name" />
          </Field>
          <Field label="Nom">
            <input className="input" value={form.lastName} maxLength={40} onChange={(e) => set('lastName', e.target.value)} />
          </Field>
          <Field label="Emoji d’avatar">
            <input className="input" value={form.avatarEmoji} maxLength={8} onChange={(e) => set('avatarEmoji', e.target.value)} placeholder="🎧" />
          </Field>
          <Field label="Statut">
            <select className="input" value={form.status} onChange={(e) => set('status', e.target.value as CharacterStatus)}>
              {(Object.keys(STATUS_LABEL) as CharacterStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Image d’avatar (URL https, facultatif)">
            <input className="input" value={form.avatarUrl ?? ''} onChange={(e) => set('avatarUrl', e.target.value || null)} placeholder="https://…" />
          </Field>
          <div>
            <span className="label">Couleur</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Couleur ${c}`}
                  className={clsx('h-8 w-8 rounded-full ring-offset-2 ring-offset-panel', form.avatarColor === c && 'ring-2 ring-ink')}
                  style={{ background: c }}
                  onClick={() => set('avatarColor', c)}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Toggle checked={form.isActive} onChange={(v) => set('isActive', v)} label="Personnage actif" description="Désactivé : plus aucun message automatique ni réponse." />
        </div>
      </Section>

      <Section title="Personnalité">
        <div className="space-y-3">
          <Field label="Description">
            <textarea className="input min-h-[70px]" maxLength={1000} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Personnalité">
            <textarea className="input min-h-[70px]" maxLength={1500} value={form.personality} onChange={(e) => set('personality', e.target.value)} />
          </Field>
          <Field label="Style de langage">
            <textarea className="input min-h-[50px]" maxLength={600} value={form.languageStyle} onChange={(e) => set('languageStyle', e.target.value)} placeholder="Messages courts, emojis, tutoiement…" />
          </Field>
          <div>
            <span className="label">Centres d’intérêt</span>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {form.interests.map((i) => (
                <span key={i} className="chip">
                  {i}
                  <button type="button" aria-label={`Retirer ${i}`} onClick={() => set('interests', form.interests.filter((x) => x !== i))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                value={interestInput}
                maxLength={40}
                placeholder="Ajouter (Entrée)"
                onChange={(e) => setInterestInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addInterest();
                  }
                }}
              />
              <button type="button" className="btn-outline" onClick={addInterest}>
                <Plus size={16} />
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Messages entrants" description="Messages spontanés et réponses du personnage. En mode démo, les délais sont divisés.">
        <div className="space-y-4">
          <Toggle checked={form.automation.replyEnabled} onChange={(v) => setAuto('replyEnabled', v)} label="Répond à mes messages" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Délai de réponse min. (s)">
              <input type="number" min={0} className="input" value={form.automation.replyDelayMinSeconds} onChange={(e) => setAuto('replyDelayMinSeconds', Number(e.target.value))} />
            </Field>
            <Field label="Délai de réponse max. (s)">
              <input type="number" min={0} className="input" value={form.automation.replyDelayMaxSeconds} onChange={(e) => setAuto('replyDelayMaxSeconds', Number(e.target.value))} />
            </Field>
          </div>
          <Toggle checked={form.automation.incomingEnabled} onChange={(v) => setAuto('incomingEnabled', v)} label="M’écrit spontanément" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Intervalle min. (min)">
              <input type="number" min={0.2} step={0.1} className="input" value={form.automation.incomingMinMinutes} onChange={(e) => setAuto('incomingMinMinutes', Number(e.target.value))} />
            </Field>
            <Field label="Intervalle max. (min)">
              <input type="number" min={0.2} step={0.1} className="input" value={form.automation.incomingMaxMinutes} onChange={(e) => setAuto('incomingMaxMinutes', Number(e.target.value))} />
            </Field>
            <Field label="Messages par rafale">
              <input type="number" min={1} max={5} className="input" value={form.automation.burstMax} onChange={(e) => setAuto('burstMax', Number(e.target.value))} />
            </Field>
          </div>
          <Toggle checked={form.automation.followupEnabled} onChange={(v) => setAuto('followupEnabled', v)} label="Relance si une question reste sans réponse" />
          {form.automation.followupEnabled && (
            <Field label="Relance après (min)">
              <input type="number" min={0.5} className="input max-w-[200px]" value={form.automation.followupAfterMinutes} onChange={(e) => setAuto('followupAfterMinutes', Number(e.target.value))} />
            </Field>
          )}
        </div>
      </Section>

      <Section title="Réponse IA à ma place">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Mode" hint={AI_MODE_LABELS[form.ai.mode].help}>
            <select className="input" value={form.ai.mode} onChange={(e) => setAi('mode', e.target.value as AiMode)}>
              {(Object.keys(AI_MODE_LABELS) as AiMode[]).map((m) => (
                <option key={m} value={m}>
                  {AI_MODE_LABELS[m].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Délai (secondes)">
            <input type="number" min={5} className="input" value={form.ai.delaySeconds} onChange={(e) => setAi('delaySeconds', Number(e.target.value))} />
          </Field>
          <Field label="Sujets exclus (virgules)">
            <input
              className="input"
              value={form.ai.excludedTopics.join(', ')}
              onChange={(e) => setAi('excludedTopics', e.target.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 30))}
            />
          </Field>
          <Field label="Consignes de style">
            <input className="input" maxLength={600} value={form.ai.replyStyle} onChange={(e) => setAi('replyStyle', e.target.value)} />
          </Field>
        </div>
      </Section>

      {errors && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {errors}
        </p>
      )}
      <div className="sticky bottom-0 -mx-3 flex flex-wrap gap-2 border-t border-line bg-bg/95 px-3 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <button className="btn-primary" disabled={busy || !form.firstName.trim()} onClick={() => void save()} data-testid="character-save">
          <Save size={16} /> {character ? 'Enregistrer' : 'Créer le personnage'}
        </button>
        {character && (
          <button className="btn-danger ml-auto" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Supprimer
          </button>
        )}
      </div>
      {character && (
        <ConfirmDialog
          open={confirmDelete}
          title={`Supprimer ${character.fullName}`}
          message="Le personnage, sa conversation, sa mémoire et ses éléments de boîte mail seront définitivement supprimés. Pour simplement l’arrêter, désactivez-le."
          confirmLabel="Supprimer définitivement"
          requireText={character.firstName}
          danger
          onClose={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await del(`/characters/${character.id}`, { 'X-Confirm': 'DELETE_CHARACTER' });
            navigate('/characters');
          }}
        />
      )}
    </div>
  );
}

export function CharactersPage() {
  const { characterId } = useParams();
  const characters = useStore((s) => s.characters);
  const list = Object.values(characters).sort((a, b) => a.createdAt - b.createdAt);
  const isNew = characterId === 'new';
  const current = characterId && !isNew ? characters[characterId] ?? null : null;
  const editing = isNew || Boolean(current);

  return (
    <div className="flex min-h-0 flex-1">
      <div className={clsx('min-h-0 w-full shrink-0 flex-col border-r border-line bg-panel md:w-80', editing ? 'hidden md:flex' : 'flex')}>
        <PageHeader
          title="Personnages"
          subtitle={`${list.length} au total, ${list.filter((c) => c.isActive).length} actifs`}
          actions={
            <Link to="/characters/new" className="btn-primary py-1.5 text-xs" data-testid="new-character">
              <Plus size={15} /> Créer
            </Link>
          }
        />
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">
          {list.map((c) => (
            <Link
              key={c.id}
              to={`/characters/${c.id}`}
              className={clsx('flex items-center gap-3 rounded-2xl px-3 py-2.5', c.id === characterId ? 'bg-accent/15' : 'hover:bg-raised')}
            >
              <Avatar character={c} size={40} showStatus />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.fullName}</span>
                <span className="block truncate text-xs text-muted">
                  {c.isActive ? `IA : ${AI_MODE_LABELS[c.ai.mode].label}` : 'Désactivé'}
                  {c.isActive && c.automation.incomingEnabled ? ' · spontané' : ''}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <div className={clsx('min-h-0 min-w-0 flex-1 flex-col', editing ? 'flex' : 'hidden md:flex')}>
        {editing ? (
          <>
            <PageHeader title={isNew ? 'Nouveau personnage' : current!.fullName} back="/characters" />
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
              <CharacterEditor character={current} />
            </div>
          </>
        ) : characterId ? (
          <div className="p-8 text-center text-sm text-muted">Personnage introuvable.</div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted">
            Sélectionnez un personnage pour le modifier, ou créez-en un nouveau. Le nombre de personnages n’est pas limité.
          </div>
        )}
      </div>
    </div>
  );
}
