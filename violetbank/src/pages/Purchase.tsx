import clsx from 'clsx';
import { ArrowLeft, Check, Lock, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AccountSelect } from '../components/AccountSelect';
import { AmountInput } from '../components/AmountInput';
import { Icon } from '../components/Icon';
import { Button, Callout, Card, Field, KeyValue, PageHeader, SuccessCheck, TextInput } from '../components/ui';
import { recordExpense } from '../domain/accounts';
import { getCategory, spendingCategories } from '../domain/categories';
import { monthKey } from '../domain/dates';
import { parseAmount } from '../domain/money';
import { cardMonthSpent } from '../domain/selectors';
import { useActiveAccounts, useBalances, useBankState, useBusy, useMoney, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';

/** Commerçants imaginaires par catégorie : aucune enseigne réelle. */
const MERCHANTS: Record<string, string[]> = {
  food: ['Marché Lavande', 'Boulangerie du Coin', 'Sushi Violette', 'Épicerie Démo'],
  gaming: ['Store Jeux Démo', 'Arcade Prisme', 'Pass Gaming Fictif'],
  shopping: ['Boutique Violette', 'Mode Démo', 'Librairie Test'],
  transport: ['Métro Démo', 'Trottinette Test', 'Train Fictif'],
  subscriptions: ['Streaming Démo', 'Musique Fictive', 'Cloud Test'],
  leisure: ['Cinéma Démo', 'Escalade Test', 'Concert Fictif'],
  computer: ['Composants Démo', 'Accessoires Tech Test'],
  other: ['Commerce Démo'],
};

type Step = 'category' | 'merchant' | 'details' | 'review' | 'done';

export default function Purchase() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const balances = useBalances();
  const accounts = useActiveAccounts();
  const act = useBank((s) => s.act);
  const { busy, run } = useBusy(700);
  const cards = useMemo(() => state.cards.filter((c) => !c.deletedAt), [state.cards]);
  const categories = spendingCategories(state.customCategories).filter((c) => !['loan_repayment', 'transfer', 'cash'].includes(c.key));
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState('');
  const [merchant, setMerchant] = useState('');
  const [cardId, setCardId] = useState(cards.find((c) => !c.locked)?.id ?? '');
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const card = cards.find((c) => c.id === cardId);
  const debitAccount = card ? card.accountId : accountId;
  const available = balances.accounts.get(debitAccount) ?? 0;
  const parsed = parseAmount(amount);
  const cat = getCategory(category || 'other', state.customCategories);
  const limitLeft = card?.monthlyLimit ? card.monthlyLimit - cardMonthSpent(state, card.id, monthKey(today)) : null;

  const toReview = () => {
    if (!parsed.ok) return setError(parsed.error);
    if (card?.locked) return setError(`La carte « ${card.name} » est verrouillée : le paiement serait refusé.`);
    if (parsed.cents > available) return setError(`Solde insuffisant : ${money(available)} disponibles.`);
    if (limitLeft !== null && parsed.cents > limitLeft) return setError(`Plafond mensuel de la carte dépassé (reste ${money(Math.max(0, limitLeft))}).`);
    setError(null);
    setStep('review');
  };
  const confirm = () =>
    run(() => {
      if (!parsed.ok) return;
      const res = act((s, ctx) => recordExpense(s, ctx, { accountId: debitAccount, cardId: cardId || null, amount: parsed.cents, merchant, category: category || 'other', note: description || undefined }), { success: false, quietError: true });
      if (res.ok) setStep('done');
      else {
        setError(res.error);
        setStep('details');
      }
    });
  const back = { merchant: 'category', details: 'merchant', review: 'details' } as const;
  const steps: Step[] = ['category', 'merchant', 'details', 'review', 'done'];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Payer (achat simulé)" icon={ShoppingCart} subtitle="Paiement fictif chez un commerçant imaginaire : aucune transaction réelle." />
      <ol className="mb-5 flex gap-2" aria-label="Étapes du paiement">
        {['Catégorie', 'Commerçant', 'Détails', 'Vérification', 'Terminé'].map((l, i) => (
          <li key={l} className="flex-1">
            <div className={clsx('h-1.5 rounded-full transition', i <= steps.indexOf(step) ? 'bg-brand' : 'bg-line')} />
            <span className={clsx('mt-1.5 hidden text-xs font-semibold sm:block', i === steps.indexOf(step) ? 'text-ink' : 'text-muted')}>{l}</span>
          </li>
        ))}
      </ol>
      <Card className="p-5 sm:p-6">
        {step !== 'category' && step !== 'done' && (
          <button type="button" onClick={() => { setError(null); setStep(back[step]); }} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
            <ArrowLeft size={16} aria-hidden /> Retour
          </button>
        )}
        {step === 'category' && (
          <div>
            <h2 className="mb-4 text-lg font-bold">Que payez-vous ?</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {categories.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    setCategory(c.key);
                    setMerchant('');
                    setStep('merchant');
                  }}
                  className="flex min-h-[96px] flex-col items-start justify-between rounded-2xl border border-line p-4 text-left font-semibold transition hover:border-brand/50 hover:bg-raised"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${c.color}22`, color: c.color }}>
                    <Icon name={c.icon} size={19} />
                  </span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 'merchant' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Commerçant fictif · {cat.label}</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(MERCHANTS[category] ?? MERCHANTS.other ?? []).map((m) => (
                <button key={m} type="button" onClick={() => { setMerchant(m); setStep('details'); }} className="flex items-center gap-3 rounded-2xl border border-line p-3.5 text-left font-semibold transition hover:border-brand/50 hover:bg-raised">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: cat.color }}>
                    {m[0]}
                  </span>
                  {m}
                </button>
              ))}
            </div>
            <Field label="Ou un autre commerçant fictif" htmlFor="custom-merchant">
              <div className="flex gap-2">
                <TextInput id="custom-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={60} placeholder="Nom du commerçant" />
                <Button disabled={!merchant.trim()} onClick={() => setStep('details')}>
                  OK
                </Button>
              </div>
            </Field>
          </div>
        )}
        {step === 'details' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">{merchant}</h2>
            <fieldset>
              <legend className="label">Carte de démonstration</legend>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button type="button" onClick={() => setCardId('')} aria-pressed={!cardId} className={clsx('shrink-0 rounded-2xl border px-4 py-3 text-sm font-semibold', !cardId ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line')}>
                  Sans carte
                </button>
                {cards.map((c) => (
                  <button key={c.id} type="button" onClick={() => setCardId(c.id)} aria-pressed={cardId === c.id} className={clsx('flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold', cardId === c.id ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line')}>
                    <span className="h-7 w-11 rounded-md" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.accent})` }} />
                    {c.name}
                    {c.locked && <Lock size={13} aria-label="verrouillée" />}
                  </button>
                ))}
              </div>
            </fieldset>
            {!card && <AccountSelect value={accountId} onChange={setAccountId} label="Compte débité" />}
            {card?.locked && <Callout tone="warn">Carte verrouillée : déverrouillez-la depuis la page Cartes pour payer avec.</Callout>}
            <AmountInput value={amount} onChange={setAmount} error={error} hint={`Disponible : ${money(available)}${limitLeft !== null ? ` · plafond restant ${money(Math.max(0, limitLeft))}` : ''}`} presets={[500, 1_500, 3_000, 6_000]} autoFocus />
            <Field label="Description (facultatif)" htmlFor="purchase-desc">
              <TextInput id="purchase-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={120} placeholder="Ex. courses de la semaine" />
            </Field>
            <Button block size="lg" onClick={toReview}>
              Vérifier le paiement
            </Button>
          </div>
        )}
        {step === 'review' && parsed.ok && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Vérifiez avant de payer</h2>
            <dl className="divide-y divide-line rounded-2xl border border-line px-4">
              <KeyValue label="Commerçant fictif" value={merchant} />
              <KeyValue label="Catégorie" value={cat.label} />
              <KeyValue label="Carte" value={card?.name ?? 'Sans carte'} />
              <KeyValue label="Compte débité" value={state.accounts.find((a) => a.id === debitAccount)?.name} />
              {description && <KeyValue label="Description" value={description} />}
              <KeyValue label="Montant" value={money(parsed.cents)} strong />
              <KeyValue label="Solde après paiement" value={money(available - parsed.cents)} />
            </dl>
            <Button block size="lg" loading={busy} icon={Check} onClick={() => void confirm()} data-testid="confirm-purchase">
              Payer {money(parsed.cents)}
            </Button>
          </div>
        )}
        {step === 'done' && parsed.ok && (
          <div className="flex flex-col items-center py-6 text-center">
            <SuccessCheck size={88} />
            <p className="mt-4 text-2xl font-extrabold">{money(parsed.cents)} payés</p>
            <p className="text-muted">chez {merchant} · dépense de simulation</p>
            <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
              <Button variant="secondary" block onClick={() => { setAmount(''); setDescription(''); setStep('category'); }}>
                Nouvel achat
              </Button>
              <Link to="/paiements" className="w-full">
                <Button block>Retour aux paiements</Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
