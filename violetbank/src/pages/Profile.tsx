import { Bell, BookOpen, ChartPie, ChevronRight, CircleHelp, FileClock, HandCoins, History, LayoutGrid, PiggyBank, RotateCcw, Settings, Target, Users, type LucideIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Hero, RoundActions, Widget } from '../components/Hero';
import { Wordmark } from '../components/Logo';
import { Avatar, Button, Field, TextInput } from '../components/ui';
import { formatDate } from '../domain/dates';
import { dashboardSummary } from '../domain/selectors';
import { useBankState, useMoney, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';
import { ColorPicker } from './Accounts';

const AVATARS = ['🦄', '🦊', '🐼', '🐱', '🚀', '🌙', '🎮', '🌸', '💎', '🐙', '🦉', '🍀'];

function MenuRow({ to, icon: I, label, hint, badge }: { to: string; icon: LucideIcon; label: string; hint?: string; badge?: number }) {
  return (
    <Link to={to} className="flex min-h-[56px] items-center gap-4 rounded-2xl py-2 transition hover:bg-raised/60">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised text-ink">
        <I size={20} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold">{label}</span>
        {hint && <span className="block truncate text-sm text-muted">{hint}</span>}
      </span>
      {badge ? <span className="num rounded-full bg-danger px-2 text-xs font-bold leading-5 text-white">{badge}</span> : null}
      <ChevronRight size={19} className="shrink-0 text-muted" aria-hidden />
    </Link>
  );
}

export default function Profile() {
  const state = useBankState();
  const update = useBank((s) => s.update);
  const toast = useUi((s) => s.toast);
  const setMore = useUi((s) => s.setMoreOpen);
  const money = useMoney();
  const today = useToday();
  const [form, setForm] = useState(state.profile);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const summary = dashboardSummary(state, today);
  const unread = state.notifications.filter((n) => !n.read).length;
  const firstTx = state.transactions[state.transactions.length - 1];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const displayName = form.displayName.trim().slice(0, 40);
    const holderName = form.holderName.trim().toUpperCase().slice(0, 40);
    if (!displayName || !holderName) return setError('Le nom affiché et le nom de titulaire fictif sont requis.');
    setError(null);
    update((s) => ({ ...s, profile: { ...form, displayName, holderName }, cards: s.cards.map((c) => ({ ...c, holderName })) }));
    toast('success', 'Profil mis à jour');
    setEditing(false);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Hero title="Profil" eyebrow={<Wordmark onDark className="text-[13px] text-white/90" />} className="min-h-[340px]">
        <button type="button" onClick={() => setEditing(true)} className="mt-4 rounded-full ring-4 ring-white/25 transition active:scale-95" aria-label="Modifier l’avatar et le profil">
          <Avatar emoji={state.profile.avatarEmoji} color="#FFFFFF" size={88} />
        </button>
        <p className="mt-3 text-2xl font-extrabold">{state.profile.displayName}</p>
        <p className="font-mono text-sm text-white/80">{state.profile.demoHandle}</p>
        <p className="num mt-1 text-sm text-white/75">
          {money(summary.available, { sensitive: true })} disponibles · {summary.cardCount} cartes · {summary.txCount} opérations
        </p>
        <div className="mt-6 w-full pb-6">
          <RoundActions
            actions={[
              { label: 'Prêts', icon: HandCoins, to: '/prets' },
              { label: 'Statistiques', icon: ChartPie, to: '/statistiques' },
              { label: 'Budgets', icon: Target, to: '/budgets' },
              { label: 'Coffres', icon: PiggyBank, to: '/coffres' },
            ]}
          />
        </div>
      </Hero>

      <div className="space-y-4">
        <Widget>
          <MenuRow to="/notifications" icon={Bell} label="Notifications" hint="Opérations, prêts, budgets, épargne" badge={unread} />
          <MenuRow to="/parametres" icon={Settings} label="Paramètres" hint="Thème, animations, devise, règles des prêts" />
          <MenuRow to="/historique" icon={History} label="Historique des transactions" hint={firstTx ? `Depuis le ${formatDate(firstTx.date)}` : 'Aucune opération'} />
          <MenuRow to="/contacts" icon={Users} label="Contacts fictifs" />
          <MenuRow to="/journal" icon={FileClock} label="Journal de simulation" />
          <MenuRow to="/reinitialisation" icon={RotateCcw} label="Données de démonstration" hint="Sauvegarde, restauration, réinitialisation" />
          <MenuRow to="/aide" icon={CircleHelp} label="Centre d’aide" />
          <button type="button" onClick={() => setMore(true)} className="flex min-h-[56px] w-full items-center gap-4 rounded-2xl py-2 text-left transition hover:bg-raised/60">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised">
              <LayoutGrid size={20} aria-hidden />
            </span>
            <span className="flex-1 text-[16px] font-semibold">Toutes les rubriques</span>
            <ChevronRight size={19} className="text-muted" aria-hidden />
          </button>
        </Widget>

        <Widget title="Mon profil de démonstration" action={!editing ? <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Modifier</Button> : undefined}>
          {editing ? (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Nom affiché" htmlFor="p-name" error={error}>
                <TextInput id="p-name" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} maxLength={40} />
              </Field>
              <Field label="Nom de titulaire fictif (cartes)" htmlFor="p-holder" hint="Affiché en majuscules sur les cartes de démonstration.">
                <TextInput id="p-holder" value={form.holderName} onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))} maxLength={40} />
              </Field>
              <fieldset>
                <legend className="label">Avatar</legend>
                <div className="flex flex-wrap gap-1.5">
                  {AVATARS.map((a) => (
                    <button key={a} type="button" aria-pressed={form.avatarEmoji === a} onClick={() => setForm((f) => ({ ...f, avatarEmoji: a }))} className={`flex h-11 w-11 items-center justify-center rounded-xl border text-2xl ${form.avatarEmoji === a ? 'border-brand bg-brand-soft' : 'border-line'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </fieldset>
              <ColorPicker value={form.avatarColor} onChange={(avatarColor) => setForm((f) => ({ ...f, avatarColor }))} label="Couleur de l’avatar" />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" block onClick={() => { setForm(state.profile); setEditing(false); }}>
                  Annuler
                </Button>
                <Button type="submit" block>
                  Enregistrer le profil
                </Button>
              </div>
            </form>
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Nom affiché</dt><dd className="font-semibold">{state.profile.displayName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Titulaire fictif</dt><dd className="font-semibold">{state.profile.holderName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Identifiant démo</dt><dd className="font-mono">{state.profile.demoHandle}</dd></div>
            </dl>
          )}
        </Widget>
        <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-xs text-muted">
          <BookOpen size={13} aria-hidden /> VIOLETBANK est une simulation : aucun compte réel, aucun paiement réel.
        </p>
      </div>
    </div>
  );
}
