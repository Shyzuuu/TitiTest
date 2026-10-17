import { ArrowDown, ArrowLeftRight } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AccountSelect } from '../components/AccountSelect';
import { AmountInput } from '../components/AmountInput';
import { TransactionList } from '../components/Transactions';
import { Button, Callout, Card, EmptyState, Field, PageHeader, TextInput } from '../components/ui';
import { transferInternal } from '../domain/accounts';
import { parseAmount } from '../domain/money';
import { useActiveAccounts, useBalances, useBankState, useBusy, useMoney } from '../lib/hooks';
import { useBank } from '../store/bank';

export default function Transfers() {
  const state = useBankState();
  const accounts = useActiveAccounts();
  const balances = useBalances();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const { busy, run } = useBusy();
  const [from, setFrom] = useState(accounts[0]?.id ?? '');
  const [to, setTo] = useState(accounts[1]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const history = useMemo(() => state.transactions.filter((t) => t.type === 'transfer_out' || (t.type === 'reversal' && t.origType === 'transfer_out')).slice(0, 30), [state.transactions]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(amount);
    if (!p.ok) return setError(p.error);
    if (!to || from === to) return setError('Choisissez deux comptes différents.');
    setError(null);
    void run(() => {
      const res = act((s, ctx) => transferInternal(s, ctx, { fromAccountId: from, toAccountId: to, amount: p.cents, note }), { quietError: true });
      if (res.ok) {
        setAmount('');
        setNote('');
      } else setError(res.error);
    });
  };
  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <div>
      <PageHeader title="Virements internes" icon={ArrowLeftRight} subtitle="Déplacez des fonds fictifs entre vos comptes : le total reste identique, aucun argent n’est créé." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-2">
          {accounts.length < 2 ? (
            <Callout tone="info">Créez au moins deux comptes pour effectuer un virement interne.</Callout>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <AccountSelect value={from} onChange={(v) => { setFrom(v); if (v === to) setTo(accounts.find((a) => a.id !== v)?.id ?? ''); }} label="Depuis" />
              <div className="flex justify-center">
                <button type="button" onClick={swap} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-brand-ink transition hover:rotate-180" aria-label="Inverser les comptes">
                  <ArrowDown size={18} aria-hidden />
                </button>
              </div>
              <AccountSelect value={to} onChange={setTo} label="Vers" exclude={from} />
              <AmountInput value={amount} onChange={setAmount} error={error} hint={`Disponible : ${money(balances.accounts.get(from) ?? 0)}`} presets={[5_000, 10_000, 25_000, 50_000]} />
              <Field label="Note (facultatif)" htmlFor="tr-page-note">
                <TextInput id="tr-page-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
              </Field>
              <Button type="submit" block size="lg" loading={busy} icon={ArrowLeftRight}>
                Transférer
              </Button>
            </form>
          )}
        </Card>
        <Card className="p-4 sm:p-5 lg:col-span-3">
          <h2 className="mb-3 text-lg font-bold">Derniers virements internes</h2>
          <TransactionList txs={history} empty={<EmptyState icon={ArrowLeftRight} title="Aucun virement interne" />} />
        </Card>
      </div>
    </div>
  );
}
