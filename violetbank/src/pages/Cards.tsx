import clsx from 'clsx';
import { ChevronLeft, ChevronRight, CreditCard, Lock, Pencil, Plus, Receipt, RefreshCw, Trash2, Unlock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccountSelect } from '../components/AccountSelect';
import { RoundActions, Widget } from '../components/Hero';
import { AmountInput } from '../components/AmountInput';
import { TransactionList } from '../components/Transactions';
import { VirtualCardView } from '../components/VirtualCardView';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, KeyValue, Modal, PageHeader, Progress, Segmented, Switch, TextInput } from '../components/ui';
import { createCard, deleteCard, demoExpiry, regenerateCardId, setCardLock, updateCard, type CardInput } from '../domain/cards';
import { monthKey } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import type { CardKind, CardStyle, VirtualCard } from '../domain/schema';
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
  const [kind, setKind] = useState<CardKind>(card?.kind ?? 'standard');
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
    const input: CardInput = { ...form, monthlyLimit, kind };
    const res = card ? act((s, ctx) => updateCard(s, ctx, card.id, input), { quietError: true }) : act((s, ctx) => createCard(s, ctx, input), { quietError: true });
    if (res.ok) onClose();
    else setError({ form: res.error });
  };
  const preview = { ...form, kind, name: form.name || 'Ma carte', holderName: profile.holderName, demoId: card?.demoId ?? 'DEMO 0000 0000', createdAt: card?.createdAt ?? new Date().toISOString().slice(0, 10) };
  return (
    <Modal open onClose={onClose} title={card ? 'Modifier la carte' : 'Nouvelle carte de démonstration'} size="lg" description="Identifiant fictif sans valeur, non rattaché à un réseau de paiement.">
      <form onSubmit={submit} className="grid gap-6 md:grid-cols-2" noValidate>
        <div className="md:order-2">
          <VirtualCardView card={preview} flippable={false} tilt={false} className="mx-auto" />
          <p className="mt-3 text-center text-xs text-muted">Aperçu en direct</p>
        </div>
        <div className="space-y-4">
          {!card && (
            <div>
              <span className="label">Type de carte</span>
              <Segmented label="Type de carte" value={kind} onChange={setKind} options={[{ value: 'standard', label: 'Standard' }, { value: 'disposable', label: 'Jetable' }]} />
              <p className="mt-1.5 text-xs text-muted">{kind === 'disposable' ? 'L’identifiant de démonstration est régénéré après chaque dépense simulée.' : 'Identifiant de démonstration fixe, régénérable à la demande.'}</p>
            </div>
          )}
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

  const toggleLock = () => {
    if (!card) return;
    const res = act((s, ctx) => setCardLock(s, ctx, card.id, !card.locked));
    if (res.ok) {
      setLockAnim(true);
      setTimeout(() => setLockAnim(false), 450);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <section className="pb-6 pt-2 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight">Cartes</h1>
            <p className="text-sm text-white/80">Cartes de démonstration sans valeur, utilisables uniquement dans la simulation.</p>
          </div>
          <button type="button" onClick={() => setEditing('new')} aria-label="Nouvelle carte" title="Nouvelle carte" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/25 backdrop-blur transition hover:bg-white/35 active:scale-95">
            <Plus size={24} aria-hidden />
          </button>
        </div>
        {card && (
          <>
            <div ref={scroller} onScroll={onScroll} className="-mx-1 mt-4 flex snap-x snap-mandatory overflow-x-auto scrollbar-none" aria-label="Carrousel de cartes">
              {cards.map((c) => (
                <div key={c.id} className="flex w-full shrink-0 snap-center justify-center px-1 py-3">
                  <VirtualCardView card={c} className={lockAnim && c.id === card.id ? 'animate-shake' : undefined} />
                </div>
              ))}
            </div>
            {cards.length > 1 && (
              <div className="mt-1 flex items-center justify-center gap-3">
                <IconButton icon={ChevronLeft} label="Carte précédente" onClick={() => goTo(index - 1)} disabled={index === 0} className="text-white hover:bg-white/15" />
                <div className="flex gap-1.5">
                  {cards.map((c, i) => (
                    <button key={c.id} type="button" onClick={() => goTo(i)} aria-label={`Carte ${i + 1}`} className={clsx('h-2 rounded-full transition-all', i === index ? 'w-6 bg-white' : 'w-2 bg-white/40')} />
                  ))}
                </div>
                <IconButton icon={ChevronRight} label="Carte suivante" onClick={() => goTo(index + 1)} disabled={index >= cards.length - 1} className="text-white hover:bg-white/15" />
              </div>
            )}
            <div className="mt-3 text-center">
              <h2 className="text-xl font-bold">{card.name}</h2>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-sm text-white/85">
                <span>{account?.name ?? '—'}</span>
                <span aria-hidden>·</span>
                <span className="font-mono">··{card.demoId.slice(-4)}</span>
                {card.kind === 'disposable' && <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">Jetable</span>}
                <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', card.locked ? 'bg-[#E44F62]/80' : 'bg-white/20')}>{card.locked ? 'Verrouillée' : 'Active'}</span>
              </div>
              <p className="mt-1 text-xs text-white/70">Touchez la carte pour la retourner · balayez pour changer</p>
            </div>
            <div className="mt-6">
              <RoundActions
                actions={[
                  { label: card.locked ? 'Déverrouiller' : 'Verrouiller', icon: card.locked ? Unlock : Lock, onClick: toggleLock, tone: card.locked ? 'active' : 'default' },
                  { label: 'Modifier', icon: Pencil, onClick: () => setEditing(card) },
                  { label: 'Dépense', icon: Receipt, onClick: () => open('expense', { cardId: card.id }) },
                  { label: 'Supprimer', icon: Trash2, onClick: () => setDeleting(card), tone: 'danger' },
                ]}
              />
            </div>
          </>
        )}
      </section>
      {!card ? (
        <Widget>
          <EmptyState icon={CreditCard} title="Aucune carte de démonstration" action={<Button icon={Plus} onClick={() => setEditing('new')}>Créer ma première carte</Button>}>
            Créez une carte fictive personnalisée pour simuler des dépenses.
          </EmptyState>
        </Widget>
      ) : (
        <div className="space-y-4">
            <Widget title="Détails de la carte" action={card.kind === 'disposable' ? <Badge tone="brand">Jetable</Badge> : undefined}>
              <dl className="divide-y divide-line">
                <KeyValue label="Compte associé" value={account?.name ?? '—'} />
                <KeyValue label="Identifiant de démonstration" value={<span className="font-mono">{card.demoId}</span>} />
                <KeyValue label="Expiration fictive" value={demoExpiry(card)} />
                {card.kind === 'disposable' && <KeyValue label="Identifiants régénérés" value={card.regenerations} />}
                <KeyValue label="Dépenses simulées ce mois" value={money(spent)} />
                <KeyValue label="Plafond mensuel de test" value={card.monthlyLimit ? money(card.monthlyLimit) : 'Aucun'} />
              </dl>
              {card.monthlyLimit && <Progress className="mt-3" value={(spent / card.monthlyLimit) * 100} color={spent > card.monthlyLimit * 0.9 ? 'rgb(var(--danger))' : undefined} label="Consommation du plafond" />}
              <Button className="mt-4 rounded-full" size="sm" variant="secondary" icon={RefreshCw} onClick={() => act((s, ctx) => regenerateCardId(s, ctx, card.id))}>
                Régénérer l’identifiant
              </Button>
            </Widget>
            <Widget title="Transactions de la carte">
              <TransactionList txs={txs} empty={<EmptyState icon={Receipt} title="Aucune dépense avec cette carte" action={<Button variant="soft" onClick={() => open('expense', { cardId: card.id })}>Simuler une dépense</Button>} />} />
            </Widget>
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
