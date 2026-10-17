import clsx from 'clsx';
import { ArrowLeft, Search, Send as SendIcon, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AccountSelect } from '../components/AccountSelect';
import { AmountInput } from '../components/AmountInput';
import { Avatar, Button, Callout, Card, EmptyState, Field, KeyValue, PageHeader, Select, SuccessCheck, TextInput } from '../components/ui';
import { sendToContact } from '../domain/accounts';
import { getCategory, spendingCategories } from '../domain/categories';
import { parseAmount } from '../domain/money';
import { useActiveAccounts, useBalances, useBankState, useBusy, useMoney } from '../lib/hooks';
import { useBank } from '../store/bank';

type Step = 'contact' | 'amount' | 'review' | 'done';
const STEPS: Step[] = ['contact', 'amount', 'review', 'done'];

export default function SendMoney() {
  const state = useBankState();
  const accounts = useActiveAccounts();
  const balances = useBalances();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { busy, run } = useBusy(900);
  const contacts = useMemo(() => state.contacts.filter((c) => !c.archived).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)), [state.contacts]);
  const [step, setStep] = useState<Step>(params.get('contact') ? 'amount' : 'contact');
  const [contactId, setContactId] = useState(params.get('contact') ?? '');
  const [account, setAccount] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('transfer');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const contact = contacts.find((c) => c.id === contactId);
  const available = balances.accounts.get(account) ?? 0;
  const parsed = parseAmount(amount);

  const toReview = () => {
    if (!parsed.ok) return setError(parsed.error);
    if (parsed.cents > available) return setError(`Solde insuffisant : ${money(available)} disponibles sur ce compte.`);
    setError(null);
    setStep('review');
  };
  const confirm = () =>
    run(() => {
      if (!parsed.ok || !contact) return;
      const res = act((s, ctx) => sendToContact(s, ctx, { accountId: account, contactId: contact.id, amount: parsed.cents, message, category }), { success: false, quietError: true });
      if (res.ok) setStep('done');
      else {
        setError(res.error);
        setStep('amount');
      }
    });

  const stepIndex = STEPS.indexOf(step);
  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.handle.includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Envoyer de l’argent fictif" icon={SendIcon} subtitle="Uniquement vers des contacts fictifs de la simulation. Aucun virement externe n’est possible." />
      <ol className="mb-5 flex gap-2" aria-label="Étapes">
        {['Contact', 'Montant', 'Récapitulatif', 'Terminé'].map((l, i) => (
          <li key={l} className="flex-1">
            <div className={clsx('h-1.5 rounded-full transition', i <= stepIndex ? 'bg-brand' : 'bg-line')} />
            <span className={clsx('mt-1.5 block text-xs font-semibold', i === stepIndex ? 'text-ink' : 'text-muted')}>{l}</span>
          </li>
        ))}
      </ol>
      <Card className="p-5 sm:p-6">
        {step === 'contact' && (
          <div>
            <div className="relative mb-4">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un contact fictif" className="pl-11" aria-label="Rechercher un contact" />
            </div>
            {filtered.length ? (
              <ul className="space-y-1">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setContactId(c.id);
                        setStep('amount');
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-raised"
                    >
                      <Avatar emoji={c.emoji} color={c.color} size={46} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-semibold">
                          {c.name} {c.favorite && <Star size={13} className="fill-warn text-warn" aria-label="Favori" />}
                        </span>
                        <span className="block truncate text-xs text-muted">{c.handle} · {c.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Search} title="Aucun contact" action={<Button variant="soft" onClick={() => navigate('/contacts')}>Gérer les contacts</Button>}>
                Ajoutez un contact fictif pour lui envoyer de l’argent de test.
              </EmptyState>
            )}
          </div>
        )}
        {step === 'amount' && contact && (
          <div className="space-y-4">
            <button type="button" onClick={() => setStep('contact')} className="flex items-center gap-2 text-sm font-semibold text-brand-ink">
              <ArrowLeft size={16} aria-hidden /> Changer de contact
            </button>
            <div className="flex items-center gap-3 rounded-2xl bg-raised p-3">
              <Avatar emoji={contact.emoji} color={contact.color} size={44} />
              <div>
                <p className="font-semibold">{contact.name}</p>
                <p className="text-xs text-muted">{contact.handle}</p>
              </div>
            </div>
            <AccountSelect value={account} onChange={setAccount} label="Compte débité" />
            <AmountInput value={amount} onChange={setAmount} error={error} hint={`Disponible : ${money(available)}`} presets={[500, 1_000, 2_000, 5_000]} autoFocus />
            <Field label="Message (facultatif)" htmlFor="send-msg">
              <TextInput id="send-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={120} placeholder="Ex. Pizza de vendredi 🍕" />
            </Field>
            <Field label="Catégorie budgétaire" htmlFor="send-cat">
              <Select id="send-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {spendingCategories(state.customCategories).filter((c) => c.key !== 'loan_repayment' && c.key !== 'cash').map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button block size="lg" onClick={toReview}>
              Vérifier
            </Button>
          </div>
        )}
        {step === 'amount' && !contact && <Callout tone="warn">Contact introuvable. <button className="font-semibold underline" onClick={() => setStep('contact')}>Choisir un contact</button></Callout>}
        {step === 'review' && contact && parsed.ok && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Récapitulatif</h2>
            <dl className="divide-y divide-line rounded-2xl border border-line px-4">
              <KeyValue label="Bénéficiaire fictif" value={contact.name} />
              <KeyValue label="Compte débité" value={accounts.find((a) => a.id === account)?.name} />
              <KeyValue label="Montant" value={money(parsed.cents)} strong />
              <KeyValue label="Catégorie" value={getCategory(category, state.customCategories).label} />
              {message && <KeyValue label="Message" value={message} />}
              <KeyValue label="Solde après l’envoi" value={money(available - parsed.cents)} />
            </dl>
            <Callout tone="brand">Transfert interne à la simulation : aucun compte bancaire externe n’est concerné.</Callout>
            <div className="flex gap-2">
              <Button variant="secondary" block onClick={() => setStep('amount')} disabled={busy}>
                Modifier
              </Button>
              <Button block onClick={() => void confirm()} loading={busy} icon={SendIcon}>
                Confirmer l’envoi
              </Button>
            </div>
          </div>
        )}
        {step === 'done' && contact && parsed.ok && (
          <div className="flex flex-col items-center py-8 text-center">
            <SuccessCheck size={88} />
            <p className="mt-4 text-2xl font-extrabold">{money(parsed.cents)} envoyés</p>
            <p className="mt-1 text-muted">à {contact.name} (simulation)</p>
            <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
              <Button
                variant="secondary"
                block
                onClick={() => {
                  setAmount('');
                  setMessage('');
                  setStep('contact');
                }}
              >
                Nouvel envoi
              </Button>
              <Link to="/historique" className="w-full">
                <Button block>Voir l’historique</Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
