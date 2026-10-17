import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CreditCard, HandCoins, History, Landmark, PiggyBank, Receipt, Send, ShoppingCart } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { deposit, recordExpense, transferInternal, withdraw } from '../domain/accounts';
import { spendingCategories } from '../domain/categories';
import { parseAmount } from '../domain/money';
import { useActiveAccounts, useBalances, useBusy, useMoney } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';
import { AccountSelect } from './AccountSelect';
import { AmountInput, DEPOSIT_PRESETS } from './AmountInput';
import { RefundModal } from './RefundModal';
import { TransactionDetailModal } from './Transactions';
import { Button, Callout, Field, Modal, Select, SuccessCheck, TextInput } from './ui';

function useDefaultAccount(preferred?: string) {
  const accounts = useActiveAccounts();
  return accounts.find((a) => a.id === preferred)?.id ?? accounts[0]?.id ?? '';
}

function Done({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <SuccessCheck />
      <p className="mt-4 text-xl font-bold">{title}</p>
      <p className="mt-1 text-muted">{body}</p>
      <Button className="mt-6" onClick={onClose} block>
        Terminé
      </Button>
    </div>
  );
}

export function DepositModal({ accountId, onClose }: { accountId?: string; onClose: () => void }) {
  const [account, setAccount] = useState(useDefaultAccount(accountId));
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('income');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const act = useBank((s) => s.act);
  const money = useMoney();
  const { busy, run } = useBusy();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(amount);
    if (!parsed.ok) return setError(parsed.error);
    setError(null);
    void run(() => {
      const res = act((s, ctx) => deposit(s, ctx, { accountId: account, amount: parsed.cents, label: label || undefined, category }), { quietError: true });
      if (res.ok) setDone(`${money(parsed.cents)} de fonds de test ont été ajoutés.`);
      else setError(res.error);
    });
  };

  return (
    <Modal open onClose={onClose} title="Ajouter de l’argent fictif" description="Création de fonds de test — ce n’est pas un dépôt bancaire.">
      {done ? (
        <Done title="Fonds de test ajoutés" body={done} onClose={onClose} />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <AmountInput value={amount} onChange={setAmount} error={error} presets={DEPOSIT_PRESETS} autoFocus />
          <AccountSelect value={account} onChange={setAccount} label="Compte destinataire" />
          <Field label="Description (facultatif)" htmlFor="dep-label">
            <TextInput id="dep-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ajout de fonds de test" maxLength={80} />
          </Field>
          <Field label="Catégorie" htmlFor="dep-cat">
            <Select id="dep-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="income">Fonds de test</option>
              <option value="other">Autre</option>
            </Select>
          </Field>
          <Callout tone="brand">Ces fonds sont créés uniquement dans l’application de démonstration et n’ont aucune existence réelle.</Callout>
          <Button type="submit" block size="lg" loading={busy}>
            Confirmer l’ajout
          </Button>
        </form>
      )}
    </Modal>
  );
}

export function WithdrawModal({ accountId, onClose }: { accountId?: string; onClose: () => void }) {
  const [account, setAccount] = useState(useDefaultAccount(accountId));
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const act = useBank((s) => s.act);
  const balances = useBalances();
  const money = useMoney();
  const { busy, run } = useBusy();
  const available = balances.accounts.get(account) ?? 0;

  const check = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(amount);
    if (!parsed.ok) return setError(parsed.error);
    if (parsed.cents > available) return setError(`Solde insuffisant : ${money(available)} disponibles.`);
    setError(null);
    setConfirm(parsed.cents);
  };
  const execute = () =>
    run(() => {
      if (confirm === null) return;
      const res = act((s, ctx) => withdraw(s, ctx, { accountId: account, amount: confirm }), { quietError: true });
      if (res.ok) setDone(`${money(confirm)} retirés de la simulation.`);
      else {
        setError(res.error);
        setConfirm(null);
      }
    });

  return (
    <Modal open onClose={onClose} title="Retirer de l’argent fictif" description="Retrait de simulation : les fonds de test sont simplement supprimés.">
      {done ? (
        <Done title="Retrait enregistré" body={done} onClose={onClose} />
      ) : confirm !== null ? (
        <div className="space-y-4">
          <Callout tone="warn" title="Confirmer le retrait de test ?">
            {money(confirm)} seront retirés du compte. Solde après opération : {money(available - confirm)}.
          </Callout>
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={() => setConfirm(null)} disabled={busy}>
              Modifier
            </Button>
            <Button block onClick={() => void execute()} loading={busy}>
              Confirmer
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={check} className="space-y-4" noValidate>
          <AmountInput value={amount} onChange={setAmount} error={error} hint={`Disponible : ${money(available)}`} autoFocus />
          <AccountSelect value={account} onChange={setAccount} label="Compte débité" />
          <Button type="submit" block size="lg">
            Continuer
          </Button>
        </form>
      )}
    </Modal>
  );
}

export function ExpenseModal({ accountId, cardId, onClose }: { accountId?: string; cardId?: string; onClose: () => void }) {
  const cards = useBank((s) => s.state.cards).filter((c) => !c.deletedAt);
  const custom = useBank((s) => s.state.customCategories);
  const [account, setAccount] = useState(useDefaultAccount(accountId));
  const [card, setCard] = useState(cardId ?? '');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState('food');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const act = useBank((s) => s.act);
  const money = useMoney();
  const { busy, run } = useBusy();
  const selectedCard = cards.find((c) => c.id === card);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(amount);
    if (!parsed.ok) return setError(parsed.error);
    if (!merchant.trim()) return setError('Indiquez le commerçant ou le libellé.');
    setError(null);
    void run(() => {
      const res = act((s, ctx) => recordExpense(s, ctx, { accountId: account, cardId: card || null, amount: parsed.cents, merchant, category }), { quietError: true });
      if (res.ok) setDone(`${money(parsed.cents)} chez ${merchant.trim()}.`);
      else {
        setError(res.error);
        setShake(true);
        setTimeout(() => setShake(false), 450);
      }
    });
  };

  return (
    <Modal open onClose={onClose} title="Simuler une dépense" description="Dépense fictive : aucun commerçant réel n’est débité.">
      {done ? (
        <Done title="Dépense simulée" body={done} onClose={onClose} />
      ) : (
        <form onSubmit={submit} className={shake ? 'animate-shake space-y-4' : 'space-y-4'} noValidate>
          <AmountInput value={amount} onChange={setAmount} error={error} autoFocus />
          <Field label="Commerçant / libellé" htmlFor="exp-merchant">
            <TextInput id="exp-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Ex. Marché Lavande" maxLength={80} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Catégorie" htmlFor="exp-cat">
              <Select id="exp-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
                {spendingCategories(custom)
                  .filter((c) => c.key !== 'loan_repayment' && c.key !== 'transfer' && c.key !== 'cash')
                  .map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Carte de démonstration" htmlFor="exp-card">
              <Select id="exp-card" value={card} onChange={(e) => setCard(e.target.value)}>
                <option value="">Sans carte (débit du compte)</option>
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.locked ? ' — verrouillée' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {selectedCard ? (
            <p className="text-sm text-muted">Compte débité : celui associé à la carte « {selectedCard.name} ».</p>
          ) : (
            <AccountSelect value={account} onChange={setAccount} label="Compte débité" />
          )}
          {selectedCard?.locked && <Callout tone="warn">Cette carte est verrouillée : la dépense sera refusée et tracée comme telle.</Callout>}
          <Button type="submit" block size="lg" loading={busy} icon={ShoppingCart}>
            Simuler le paiement
          </Button>
        </form>
      )}
    </Modal>
  );
}

export function TransferModal({ fromId, onClose }: { fromId?: string; onClose: () => void }) {
  const accounts = useActiveAccounts();
  const [from, setFrom] = useState(useDefaultAccount(fromId));
  const [to, setTo] = useState(() => accounts.find((a) => a.id !== (fromId ?? accounts[0]?.id))?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const act = useBank((s) => s.act);
  const balances = useBalances();
  const money = useMoney();
  const { busy, run } = useBusy();

  if (accounts.length < 2) {
    return (
      <Modal open onClose={onClose} title="Virement interne" size="sm">
        <Callout tone="info">Il faut au moins deux comptes pour effectuer un virement interne. Créez un compte depuis la page Comptes.</Callout>
      </Modal>
    );
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(amount);
    if (!parsed.ok) return setError(parsed.error);
    if (from === to || !to) return setError('Choisissez deux comptes différents.');
    setError(null);
    void run(() => {
      const res = act((s, ctx) => transferInternal(s, ctx, { fromAccountId: from, toAccountId: to, amount: parsed.cents, note }), { quietError: true });
      if (res.ok) setDone(`${money(parsed.cents)} déplacés entre vos comptes. Aucun fonds n’a été créé.`);
      else setError(res.error);
    });
  };
  return (
    <Modal open onClose={onClose} title="Virement interne" description="Déplace des fonds fictifs entre vos comptes de démonstration.">
      {done ? (
        <Done title="Virement effectué" body={done} onClose={onClose} />
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <AmountInput value={amount} onChange={setAmount} error={error} hint={`Disponible sur le compte source : ${money(balances.accounts.get(from) ?? 0)}`} autoFocus />
          <AccountSelect
            value={from}
            onChange={(v) => {
              setFrom(v);
              if (v === to) setTo(accounts.find((a) => a.id !== v)?.id ?? '');
            }}
            label="Depuis"
          />
          <AccountSelect value={to} onChange={setTo} label="Vers" exclude={from} />
          <Field label="Note (facultatif)" htmlFor="tr-note">
            <TextInput id="tr-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
          </Field>
          <Button type="submit" block size="lg" loading={busy} icon={ArrowLeftRight}>
            Transférer
          </Button>
        </form>
      )}
    </Modal>
  );
}

export function QuickActionsModal({ onClose }: { onClose: () => void }) {
  const open = useUi((s) => s.openModal);
  const navigate = useNavigate();
  const go = (path: string) => {
    onClose();
    navigate(path);
  };
  const actions = [
    { label: 'Ajouter de l’argent', icon: ArrowDownToLine, onClick: () => open('deposit') },
    { label: 'Retirer', icon: ArrowUpFromLine, onClick: () => open('withdraw') },
    { label: 'Payer (achat simulé)', icon: Receipt, onClick: () => go('/paiements/achat') },
    { label: 'Virement interne', icon: ArrowLeftRight, onClick: () => open('transfer') },
    { label: 'Envoyer', icon: Send, onClick: () => go('/envoyer') },
    { label: 'Créer une carte', icon: CreditCard, onClick: () => go('/cartes?nouvelle=1') },
    { label: 'Créer un coffre', icon: PiggyBank, onClick: () => go('/coffres?nouveau=1') },
    { label: 'Demander un prêt', icon: HandCoins, onClick: () => go('/prets/nouvelle') },
    { label: 'Rembourser un prêt', icon: Landmark, onClick: () => go('/prets/remboursement') },
    { label: 'Historique', icon: History, onClick: () => go('/historique') },
  ];
  return (
    <Modal open onClose={onClose} title="Actions rapides" description="Toutes les opérations sont fictives.">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {actions.map((a) => (
          <button key={a.label} type="button" onClick={a.onClick} className="flex flex-col items-start gap-3 rounded-2xl border border-line p-4 text-left text-sm font-semibold transition hover:border-brand/40 hover:bg-raised">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
              <a.icon size={19} aria-hidden />
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Hôte unique des modales globales, ouvertes depuis n'importe quelle page. */
export function GlobalModals() {
  const modal = useUi((s) => s.modal);
  const close = useUi((s) => s.closeModal);
  if (!modal) return null;
  const p = modal.props ?? {};
  switch (modal.kind) {
    case 'deposit':
      return <DepositModal key="deposit" accountId={p.accountId} onClose={close} />;
    case 'withdraw':
      return <WithdrawModal key="withdraw" accountId={p.accountId} onClose={close} />;
    case 'expense':
      return <ExpenseModal key="expense" accountId={p.accountId} cardId={p.cardId} onClose={close} />;
    case 'transfer':
      return <TransferModal key="transfer" fromId={p.accountId} onClose={close} />;
    case 'transaction':
      return p.id ? <TransactionDetailModal key={p.id} id={p.id} onClose={close} /> : null;
    case 'quick':
      return <QuickActionsModal onClose={close} />;
    case 'refund':
      return p.id ? <RefundModal key={`refund-${p.id}`} txId={p.id} onClose={close} /> : null;
    default:
      return null;
  }
}
