import clsx from 'clsx';
import { ChevronLeft, ChevronRight, CreditCard, Lock, Pencil, Plus, Receipt, Trash2, Unlock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccountSelect } from '../components/AccountSelect';
import { AmountInput } from '../components/AmountInput';
import { TransactionList } from '../components/Transactions';
import { VirtualCardView } from '../components/VirtualCardView';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, KeyValue, Modal, PageHeader, Progress, Segmented, Switch, TextInput } from '../components/ui';
import { createCard, deleteCard, setCardLock, updateCard, type CardInput } from '../domain/cards';
import { monthKey } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import type { CardStyle, VirtualCard } from '../domain/schema';
import { cardMonthSpent } from '../domain/selectors';
import { useActiveAccounts, useBankState, useMoney, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';

const THEMES: { name: string; color: string; accent: string }[] = [
  { name: 'Violet', color: '#7656F6', accent: '#4930B5' },
  { name: 'Lavande', color: '#B9A7FF', accent: '#7656F6' },
  { name: 'Nuit', color: '#101014', accent: '#4930B5' },
  { name: 'Océan', color: '#4285F4', accent: '#4930B5' },
  { name: 'Menthe', color: '#26B879', accent: '#0E7C66' },
  { name: 'Corail', color: '#E44F62', accent: '#7656F6' },
  { name: 'Ambre', color: '#F3A642', accent: '#E44F62' },
  { name: 'Ivoire', color: '#F7F7FB', accent: '#E9E3FF' },
];
const STYLES: { value: CardStyle; label: string }[] = [
  { value: 'gradient', label: 'Dégradé' },
  { value: 'aurora', label: 'Aurore' },
  { value: 'metal', label: 'Métal' },
  { value: 'minimal', label: 'Uni' },
];
const AVATARS = ['', '🦄', '🚀', '🎮', '✈️', '🌙', '💎', '🐱', '🔥', '🌸'];

function CardForm({ card, onClose }: { card?: VirtualCard; onClose: () => void }) {
  const accounts = useActiveAccounts();
  const profile = useBank((s) => s.state.profile);
  const act = useBank((s) => s.act);
  const [form, setForm] = useState<Omit<CardInput, 'monthlyLimit'>>(() =>
    card
      ? { name: card.name, accountId: card.accountId, color: card.color, accent: card.accent, style: card.style, avatar: card.avatar, locked: card.locked }
      : { name: '', accountId: accounts[0]?.id ?? '', color: '#7656F6', accent: '#4930B5', style: 'gradient', avatar: null, locked: false },
  );
  const [limit, setLimit] = useState(card?.monthlyLimit ? centsToInput(card.monthlyLimit) : '');
  const [error, setError] = useState<{ name?: string; limit?: string; form?: string }>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof error = {};
    if (!form.name.trim()) errs.name = 'Donnez un nom à la carte.';
    let monthlyLimit: number | null = null;
    if (limit.trim()) {
      const p = parseAmount(limit);
      if (!p.ok) errs.limit = p.error;
      else monthlyLimit = p.cents;
    }
    setError(errs);
    if (Object.keys(errs).length) return;
    const input: CardInput = { ...form, monthlyLimit };
    const res = card ? act((s, ctx) => updateCard(s, ctx, card.id, input), { quietError: true }) : act((s, ctx) => createCard(s, ctx, input), { quietError: true });
    if (res.ok) onClose();
    else setError({ form: res.error });
  };
  const preview = { ...form, name: form.name || 'Ma carte', holderName: profile.holderName, demoId: card?.demoId ?? 'DEMO 0000 0000', createdAt: card?.createdAt ?? new Date().toISOString().slice(0, 10) };
  return (
    <Modal open onClose={onClose} title={card ? 'Modifier la carte' : 'Nouvelle carte de démonstration'} size="lg" description="Identifiant fictif sans valeur, non rattaché à un réseau de paiement.">
      <form onSubmit={submit} className="grid gap-6 md:grid-cols-2" noValidate>
        <div className="md:order-2">
          <VirtualCardView card={preview} flippable={false} tilt={false} className="mx-auto" />
          <p className="mt-3 text-center text-xs text-muted">Aperçu en direct</p>
        </div>
        <div className="space-y-4">
          <Field label="Nom de la carte" error={error.name} htmlFor="card-name">
            <TextInput id="card-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={32} placeholder="Ex. Achats en ligne" invalid={!!error.name} />
          </Field>
          <fieldset>
            <legend className="label">Couleur et dégradé</legend>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  title={t.name}
                  aria-label={`Thème ${t.name}`}
                  aria-pressed={form.color === t.color && form.accent === t.accent}
                  onClick={() => setForm((f) => ({ ...f, color: t.color, accent: t.accent }))}
                  className={clsx('h-10 w-10 rounded-xl border-2 transition', form.color === t.color && form.accent === t.accent ? 'scale-110 border-ink' : 'border-line')}
                  style={{ background: `linear-gradient(135deg, ${t.color}, ${t.accent})` }}
                />
              ))}
            </div>
          </fieldset>
          <div>
            <span className="label">Style</span>
            <Segmented label="Style de carte" value={form.style} onChange={(style) => setForm((f) => ({ ...f, style }))} options={STYLES} size="sm" />
          </div>
          <fieldset>
            <legend className="label">Avatar (facultatif)</legend>
            <div className="flex flex-wrap gap-1.5">
              {AVATARS.map((a) => (
                <button key={a || 'none'} type="button" onClick={() => setForm((f) => ({ ...f, avatar: a || null }))} aria-pressed={(form.avatar ?? '') === a} className={clsx('flex h-9 w-9 items-center justify-center rounded-xl border text-lg', (form.avatar ?? '') === a ? 'border-brand bg-brand-soft' : 'border-line')}>
                  {a || <span className="text-xs text-muted">∅</span>}
                </button>
              ))}
            </div>
          </fieldset>
          <AccountSelect value={form.accountId} onChange={(accountId) => setForm((f) => ({ ...f, accountId }))} label="Compte fictif associé" />
          <AmountInput value={limit} onChange={setLimit} label="Plafond mensuel de test (facultatif)" error={error.limit} hint="Laissez vide pour aucun plafond." />
          <Switch checked={form.locked} onChange={(locked) => setForm((f) => ({ ...f, locked }))} label="Carte verrouillée" description="Bloque toute nouvelle dépense simulée." />
          {error.form && <p className="text-sm font-medium text-danger">{error.form}</p>}
          <Button type="submit" block size="lg">
            {card ? 'Enregistrer' : 'Créer la carte'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Cards() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const open = useUi((s) => s.openModal);
  const [params, setParams] = useSearchParams();
  const cards = useMemo(() => state.cards.filter((c) => !c.deletedAt), [state.cards]);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState<VirtualCard | 'new' | null>(params.get('nouvelle') ? 'new' : null);
  const [deleting, setDeleting] = useState<VirtualCard | null>(null);
  const [lockAnim, setLockAnim] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const card = cards[Math.min(index, cards.length - 1)];

  useEffect(() => {
    if (params.get('nouvelle')) {
      setEditing('new');
      params.delete('nouvelle');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  // Balayage : la carte active n'est mise à jour qu'une fois le défilement stabilisé,
  // sinon les positions intermédiaires d'un défilement animé changeraient la carte ciblée.
  const settle = useRef<ReturnType<typeof setTimeout>>();
  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = scroller.current;
      if (!el) return;
      setIndex(Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
    }, 120);
  };
  useEffect(() => () => clearTimeout(settle.current), []);
  const goTo = (i: number) => {
    const el = scroller.current;
    const bounded = Math.max(0, Math.min(cards.length - 1, i));
    setIndex(bounded);
    el?.scrollTo({ left: bounded * el.clientWidth, behavior: 'smooth' });
  };

  const txs = useMemo(() => (card ? state.transactions.filter((t) => t.cardId === card.id) : []), [state.transactions, card]);
  const spent = card ? cardMonthSpent(state, card.id, monthKey(today)) : 0;
  const account = card ? state.accounts.find((a) => a.id === card.accountId) : undefined;

  return (
    <div>
      <PageHeader title="Cartes virtuelles" icon={CreditCard} subtitle="Cartes de démonstration sans valeur, utilisables uniquement dans la simulation." actions={<Button icon={Plus} onClick={() => setEditing('new')}>Nouvelle carte</Button>} />
      {!card ? (
        <Card>
          <EmptyState icon={CreditCard} title="Aucune carte de démonstration" action={<Button icon={Plus} onClick={() => setEditing('new')}>Créer ma première carte</Button>}>
            Créez une carte fictive personnalisée pour simuler des dépenses.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="min-w-0 lg:col-span-2">
            <div className="relative">
              <div ref={scroller} onScroll={onScroll} className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none" aria-label="Carrousel de cartes">
                {cards.map((c) => (
                  <div key={c.id} className="flex w-full shrink-0 snap-center justify-center px-1 py-3">
                    <VirtualCardView card={c} className={lockAnim && c.id === card.id ? 'animate-shake' : undefined} />
                  </div>
                ))}
              </div>
              {cards.length > 1 && (
                <div className="mt-2 flex items-center justify-center gap-3">
                  <IconButton icon={ChevronLeft} label="Carte précédente" onClick={() => goTo(index - 1)} disabled={index === 0} />
                  <div className="flex gap-1.5">
                    {cards.map((c, i) => (
                      <button key={c.id} type="button" onClick={() => goTo(i)} aria-label={`Carte ${i + 1}`} className={clsx('h-2 rounded-full transition-all', i === index ? 'w-6 bg-brand' : 'w-2 bg-line')} />
                    ))}
                  </div>
                  <IconButton icon={ChevronRight} label="Carte suivante" onClick={() => goTo(index + 1)} disabled={index >= cards.length - 1} />
                </div>
              )}
              <p className="mt-2 text-center text-xs text-muted">Touchez la carte pour la retourner · balayez pour changer</p>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  const res = act((s, ctx) => setCardLock(s, ctx, card.id, !card.locked));
                  if (res.ok) {
                    setLockAnim(true);
                    setTimeout(() => setLockAnim(false), 450);
                  }
                }}
                className="card flex flex-col items-center gap-1.5 p-3 text-xs font-semibold"
              >
                {card.locked ? <Unlock size={20} className="text-ok" aria-hidden /> : <Lock size={20} className="text-brand-ink" aria-hidden />}
                {card.locked ? 'Déverrouiller' : 'Verrouiller'}
              </button>
              <button type="button" onClick={() => setEditing(card)} className="card flex flex-col items-center gap-1.5 p-3 text-xs font-semibold">
                <Pencil size={20} className="text-brand-ink" aria-hidden />
                Modifier
              </button>
              <button type="button" onClick={() => open('expense', { cardId: card.id })} className="card flex flex-col items-center gap-1.5 p-3 text-xs font-semibold">
                <Receipt size={20} className="text-brand-ink" aria-hidden />
                Dépense
              </button>
              <button type="button" onClick={() => setDeleting(card)} className="card flex flex-col items-center gap-1.5 p-3 text-xs font-semibold">
                <Trash2 size={20} className="text-danger" aria-hidden />
                Supprimer
              </button>
            </div>
          </div>
          <div className="min-w-0 space-y-6 lg:col-span-3">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="truncate text-xl font-bold">{card.name}</h2>
                {card.locked ? <Badge tone="danger"><Lock size={12} /> Verrouillée</Badge> : <Badge tone="ok">Active</Badge>}
              </div>
              <dl className="mt-3 divide-y divide-line">
                <KeyValue label="Compte associé" value={account?.name ?? '—'} />
                <KeyValue label="Identifiant de démonstration" value={<span className="font-mono">{card.demoId}</span>} />
                <KeyValue label="Dépenses simulées ce mois" value={money(spent)} />
                <KeyValue label="Plafond mensuel de test" value={card.monthlyLimit ? money(card.monthlyLimit) : 'Aucun'} />
              </dl>
              {card.monthlyLimit && <Progress className="mt-3" value={(spent / card.monthlyLimit) * 100} color={spent > card.monthlyLimit * 0.9 ? 'rgb(var(--danger))' : undefined} label="Consommation du plafond" />}
            </Card>
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 text-lg font-bold">Transactions de la carte</h2>
              <TransactionList txs={txs} empty={<EmptyState icon={Receipt} title="Aucune dépense avec cette carte" action={<Button variant="soft" onClick={() => open('expense', { cardId: card.id })}>Simuler une dépense</Button>} />} />
            </Card>
          </div>
        </div>
      )}
      {editing && <CardForm card={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        tone="danger"
        title="Supprimer la carte ?"
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (!deleting) return;
          const res = act((s, ctx) => deleteCard(s, ctx, deleting.id));
          if (res.ok) {
            setDeleting(null);
            setIndex(0);
          }
        }}
      >
        La carte « {deleting?.name} » ne pourra plus être utilisée. Ses transactions restent dans l’historique.
      </ConfirmDialog>
    </div>
  );
}
