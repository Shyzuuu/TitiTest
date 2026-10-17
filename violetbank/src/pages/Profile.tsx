import clsx from 'clsx';
import {
  Bell, BookOpen, ChartPie, Check, ChevronRight, CircleHelp, Copy, FileClock, HandCoins, History, KeyRound, LayoutGrid, Lock, Pencil, PiggyBank, RotateCcw, Settings, ShieldCheck, Target, Users, type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Hero, RoundActions, Widget } from '../components/Hero';
import { APP_AUTHOR, APP_VERSION, Credit, LogoMark, Wordmark } from '../components/Logo';
import { PinPad } from '../components/PinPad';
import { Avatar, Button, Field, Modal, StatTile, Switch, TextArea, TextInput } from '../components/ui';
import { formatDate } from '../domain/dates';
import type { Plan } from '../domain/schema';
import { dashboardSummary, isActiveLoan } from '../domain/selectors';
import { achievements, monthSavingsRate } from '../lib/achievements';
import { createLock, PIN_LENGTH } from '../lib/appLock';
import { useBankState, useMoney, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';
import { ColorPicker } from './Accounts';
import { CreditCard, Wallet, TrendingUp } from 'lucide-react';

const AVATARS = ['🦄', '🦊', '🐼', '🐱', '🚀', '🌙', '🎮', '🌸', '💎', '🐙', '🦉', '🍀', '👑', '🔥', '⚡', '🎧'];

/** Formules fictives : uniquement visuelles, sans prix ni avantage réel. */
export const PLANS: { key: Plan; name: string; desc: string; gradient: string }[] = [
  { key: 'essentiel', name: 'Essentiel', desc: 'La formule de base de la simulation.', gradient: 'linear-gradient(135deg,#9C80FF,#4C32B8)' },
  { key: 'amethyste', name: 'Améthyste', desc: 'Reflets violets profonds.', gradient: 'linear-gradient(135deg,#B06AF2,#5B2BB8)' },
  { key: 'orchidee', name: 'Orchidée', desc: 'Dégradé rose orchidée.', gradient: 'linear-gradient(135deg,#F07AC0,#7656F6)' },
  { key: 'nuit', name: 'Nuit violette', desc: 'Noir mat et violet néon.', gradient: 'linear-gradient(135deg,#2B1C6E,#101014)' },
];

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

function PinSetup({ onClose }: { onClose: () => void }) {
  const update = useBank((s) => s.update);
  const toast = useUi((s) => s.toast);
  const setUnlocked = useUi((s) => s.setUnlocked);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState(false);
  const confirming = first.length === PIN_LENGTH;
  const onSecond = (v: string) => {
    setSecond(v);
    if (v.length !== PIN_LENGTH) return;
    if (v !== first) {
      setError(true);
      setTimeout(() => {
        setError(false);
        setFirst('');
        setSecond('');
      }, 500);
      return;
    }
    void createLock(v).then((lock) => {
      update((s) => ({ ...s, settings: { ...s.settings, appLock: lock } }));
      setUnlocked(true);
      toast('success', 'Code d’accès activé', 'Il sera demandé à l’ouverture de VBanque.');
      onClose();
    });
  };
  return (
    <Modal open onClose={onClose} title={confirming ? 'Confirmez le code' : 'Choisissez un code'} description={`${PIN_LENGTH} chiffres, demandés à l’ouverture de l’application. Verrou de démonstration, pas une protection bancaire.`} size="sm">
      <div className="py-2">
        {confirming ? <PinPad key="2" value={second} onChange={onSecond} error={error} /> : <PinPad key="1" value={first} onChange={setFirst} />}
        {error && <p className="mt-4 text-center text-sm font-medium text-danger">Les deux codes ne correspondent pas, recommencez.</p>}
      </div>
    </Modal>
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
  const [pinSetup, setPinSetup] = useState(false);
  const summary = useMemo(() => dashboardSummary(state, today), [state, today]);
  const badges = useMemo(() => achievements(state, today), [state, today]);
  const savingsRate = useMemo(() => monthSavingsRate(state, today), [state, today]);
  const unread = state.notifications.filter((n) => !n.read).length;
  const firstTx = state.transactions[state.transactions.length - 1];
  const memberSince = state.profile.joinedAt ?? firstTx?.date ?? null;
  const plan = PLANS.find((p) => p.key === state.profile.plan) ?? PLANS[0]!;
  const activeLoans = state.loans.filter(isActiveLoan).length;
  const net = summary.available + summary.inVaults - summary.loanOutstanding;

  const copyHandle = async () => {
    try {
      await navigator.clipboard.writeText(state.profile.demoHandle);
      toast('success', 'Identifiant copié');
    } catch {
      toast('error', 'Copie impossible', 'Le presse-papiers n’est pas accessible.');
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const displayName = form.displayName.trim().slice(0, 40);
    const holderName = form.holderName.trim().toUpperCase().slice(0, 40);
    if (!displayName || !holderName) return setError('Le nom affiché et le nom de titulaire fictif sont requis.');
    setError(null);
    update((s) => ({ ...s, profile: { ...s.profile, ...form, displayName, holderName, bio: form.bio.trim().slice(0, 140) }, cards: s.cards.map((c) => ({ ...c, holderName })) }));
    toast('success', 'Profil mis à jour');
    setEditing(false);
  };
  const startEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => document.getElementById('profil-edition')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const setPlan = (key: Plan) => {
    update((s) => ({ ...s, profile: { ...s.profile, plan: key } }));
    toast('success', `Formule « ${PLANS.find((p) => p.key === key)?.name} » appliquée`, 'Formule fictive, purement visuelle.');
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Hero title="Profil" eyebrow={<span className="flex flex-col items-center leading-tight"><Wordmark onDark className="text-[17px] text-white" /><Credit className="text-white" /></span>} className="min-h-[380px]">
        <div className="relative mt-4">
          <span className="block rounded-full p-1" style={{ background: plan.gradient }}>
            <span className="block rounded-full bg-[#2B1C6E]/40 p-1">
              <Avatar emoji={state.profile.avatarEmoji} color="#FFFFFF" size={92} />
            </span>
          </span>
          <button type="button" onClick={startEdit} aria-label="Modifier le profil" className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-deep shadow-lift transition active:scale-95">
            <Pencil size={16} aria-hidden />
          </button>
        </div>
        <p className="mt-3 text-[26px] font-extrabold leading-tight">{state.profile.displayName}</p>
        <button type="button" onClick={() => void copyHandle()} className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-sm text-white/85 hover:text-white">
          {state.profile.demoHandle} <Copy size={13} aria-hidden />
        </button>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
          <span className="rounded-full px-3 py-1 text-white" style={{ background: plan.gradient }}>
            Formule {plan.name}
          </span>
          {memberSince && <span className="rounded-full bg-white/20 px-3 py-1">Membre depuis {formatDate(memberSince)}</span>}
        </div>
        {state.profile.bio && <p className="mt-3 max-w-sm text-sm text-white/85">« {state.profile.bio} »</p>}
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
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Patrimoine net fictif" value={money(net, { sensitive: true })} icon={Wallet} hint="Comptes + coffres − dette" />
          <StatTile label="Taux d’épargne du mois" value={savingsRate === null ? '—' : `${savingsRate} %`} icon={TrendingUp} tone={savingsRate !== null && savingsRate < 0 ? 'danger' : 'ok'} hint="Entrées non dépensées" />
          <StatTile label="Cartes actives" value={state.cards.filter((c) => !c.deletedAt && !c.locked).length} icon={CreditCard} tone="brand" to="/cartes" hint={`${summary.cardCount} au total`} />
          <StatTile label="Prêts fictifs actifs" value={activeLoans} icon={HandCoins} tone="warn" to="/prets" hint={money(summary.loanOutstanding) + ' restant dû'} />
        </div>

        <Widget title={`Badges · ${badges.filter((b) => b.unlocked).length}/${badges.length}`}>
          <ul className="grid grid-cols-3 gap-3">
            {badges.map((b) => (
              <li key={b.key} className={clsx('flex flex-col items-center rounded-2xl p-3 text-center transition', b.unlocked ? 'bg-brand-soft' : 'bg-raised/60 opacity-60')} title={b.hint}>
                <span className={clsx('text-3xl', !b.unlocked && 'grayscale')} aria-hidden>
                  {b.emoji}
                </span>
                <span className="mt-1 text-xs font-bold leading-tight">{b.label}</span>
                <span className="mt-0.5 text-[10px] leading-tight text-muted">{b.unlocked ? 'Obtenu' : b.hint}</span>
              </li>
            ))}
          </ul>
        </Widget>

        <Widget title="Formule fictive">
          <div className="grid grid-cols-2 gap-3">
            {PLANS.map((p) => {
              const active = p.key === state.profile.plan;
              return (
                <button key={p.key} type="button" onClick={() => setPlan(p.key)} aria-pressed={active} className={clsx('relative overflow-hidden rounded-2xl p-4 text-left text-white transition active:scale-[.98]', active ? 'ring-4 ring-brand/40' : 'opacity-90 hover:opacity-100')} style={{ background: p.gradient }}>
                  {active && <Check size={18} className="absolute right-3 top-3" aria-label="Formule actuelle" />}
                  <span className="block font-bold">{p.name}</span>
                  <span className="mt-1 block text-xs text-white/80">{p.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Aucune formule n’a de prix ni d’avantage réel : elles changent seulement l’apparence de votre profil.</p>
        </Widget>

        <Widget title="Sécurité et confidentialité">
          <div className="flex min-h-[56px] items-center gap-4 py-1">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised">{state.settings.appLock ? <ShieldCheck size={20} className="text-ok" aria-hidden /> : <Lock size={20} aria-hidden />}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Code d’accès</span>
              <span className="block text-sm text-muted">{state.settings.appLock ? `Activé · ${PIN_LENGTH} chiffres demandés à l’ouverture` : 'Désactivé'}</span>
            </span>
            {state.settings.appLock ? (
              <Button size="sm" variant="secondary" onClick={() => update((s) => ({ ...s, settings: { ...s.settings, appLock: null } }))}>
                Désactiver
              </Button>
            ) : (
              <Button size="sm" icon={KeyRound} onClick={() => setPinSetup(true)}>
                Activer
              </Button>
            )}
          </div>
          {state.settings.appLock && (
            <button type="button" onClick={() => setPinSetup(true)} className="mb-1 ml-[60px] text-sm font-semibold text-brand-ink hover:underline">
              Changer le code
            </button>
          )}
          <div className="divide-y divide-line">
            <Switch checked={state.settings.balanceHidden} onChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, balanceHidden: v } }))} label="Masquer les soldes" description="Les montants sensibles sont remplacés par ••••." />
            <Switch checked={state.settings.notifications} onChange={(v) => update((s) => ({ ...s, settings: { ...s.settings, notifications: v } }))} label="Notifications internes" description="Aucun SMS ni e-mail n’est envoyé." />
          </div>
        </Widget>

        <div id="profil-edition" className="scroll-mt-28" />
        <Widget title="Mon profil de démonstration" action={!editing ? <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Modifier</Button> : undefined}>
          {editing ? (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Nom affiché" htmlFor="p-name" error={error}>
                <TextInput id="p-name" value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} maxLength={40} />
              </Field>
              <Field label="Nom de titulaire fictif (cartes)" htmlFor="p-holder" hint="Affiché en majuscules sur les cartes de démonstration.">
                <TextInput id="p-holder" value={form.holderName} onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))} maxLength={40} />
              </Field>
              <Field label="Bio (facultatif)" htmlFor="p-bio" hint={`${form.bio.length}/140`}>
                <TextArea id="p-bio" value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} maxLength={140} placeholder="Ex. J’économise pour un nouveau PC 💻" />
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
                  Enregistrer
                </Button>
              </div>
            </form>
          ) : (
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted">Nom affiché</dt><dd className="font-semibold">{state.profile.displayName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Titulaire fictif</dt><dd className="font-semibold">{state.profile.holderName}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Identifiant démo</dt><dd className="font-mono">{state.profile.demoHandle}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Bio</dt><dd className="text-right">{state.profile.bio || '—'}</dd></div>
            </dl>
          )}
        </Widget>

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

        <Widget title="À propos">
          <div className="flex items-center gap-4">
            <LogoMark size={64} />
            <div className="min-w-0">
              <Wordmark className="text-2xl" />
              <p className="text-sm text-muted">Version {APP_VERSION}</p>
            </div>
          </div>
          <p className="mt-4 text-[15px]">
            Application créée par <strong>{APP_AUTHOR}</strong>, développée et améliorée avec <strong>Claude</strong>.
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
            <BookOpen size={13} className="mt-0.5 shrink-0" aria-hidden /> VBanque est une simulation : aucun compte réel, aucune carte réelle, aucun paiement ni crédit réel.
          </p>
        </Widget>
      </div>
      {pinSetup && <PinSetup onClose={() => setPinSetup(false)} />}
    </div>
  );
}
