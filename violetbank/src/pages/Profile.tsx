import { User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, Button, Card, Field, KeyValue, PageHeader, TextInput } from '../components/ui';
import { formatDate } from '../domain/dates';
import { dashboardSummary } from '../domain/selectors';
import { useBankState, useMoney, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';
import { ColorPicker } from './Accounts';

const AVATARS = ['🦄', '🦊', '🐼', '🐱', '🚀', '🌙', '🎮', '🌸', '💎', '🐙', '🦉', '🍀'];

export default function Profile() {
  const state = useBankState();
  const update = useBank((s) => s.update);
  const toast = useUi((s) => s.toast);
  const money = useMoney();
  const today = useToday();
  const [form, setForm] = useState(state.profile);
  const [error, setError] = useState<string | null>(null);
  const summary = dashboardSummary(state, today);
  const firstTx = state.transactions[state.transactions.length - 1];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const displayName = form.displayName.trim().slice(0, 40);
    const holderName = form.holderName.trim().toUpperCase().slice(0, 40);
    if (!displayName || !holderName) return setError('Le nom affiché et le nom de titulaire fictif sont requis.');
    setError(null);
    update((s) => ({ ...s, profile: { ...form, displayName, holderName }, cards: s.cards.map((c) => ({ ...c, holderName })) }));
    toast('success', 'Profil mis à jour');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Profil" icon={User} subtitle="Profil de démonstration : n’utilisez aucune donnée personnelle réelle." />
      <div className="grid gap-6 md:grid-cols-5">
        <Card className="flex flex-col items-center p-6 text-center md:col-span-2">
          <Avatar emoji={form.avatarEmoji} color={form.avatarColor} size={96} />
          <p className="mt-4 text-xl font-bold">{form.displayName || '—'}</p>
          <p className="font-mono text-sm text-muted">{state.profile.demoHandle}</p>
          <dl className="mt-5 w-full divide-y divide-line text-left">
            <KeyValue label="Disponible fictif" value={money(summary.available, { sensitive: true })} />
            <KeyValue label="Cartes" value={summary.cardCount} />
            <KeyValue label="Opérations" value={summary.txCount} />
            <KeyValue label="Première opération" value={firstTx ? formatDate(firstTx.date) : '—'} />
          </dl>
        </Card>
        <Card className="p-6 md:col-span-3">
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
            <Button type="submit" block size="lg">
              Enregistrer le profil
            </Button>
            <p className="text-center text-sm text-muted">
              Thème, devise et préférences : <Link to="/parametres" className="font-semibold text-brand-ink">Paramètres</Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
