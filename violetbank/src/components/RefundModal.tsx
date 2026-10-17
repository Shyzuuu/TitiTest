import { RotateCcw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { merchantRefund, refundableAmount } from '../domain/accounts';
import { centsToInput, parseAmount } from '../domain/money';
import { useBankState, useBusy, useMoney } from '../lib/hooks';
import { useBank } from '../store/bank';
import { AmountInput } from './AmountInput';
import { Button, Callout, Field, KeyValue, Modal, SuccessCheck, TextInput } from './ui';

/** Remboursement commerçant simulé, total ou partiel, d'une dépense existante. */
export function RefundModal({ txId, onClose }: { txId: string; onClose: () => void }) {
  const state = useBankState();
  const act = useBank((s) => s.act);
  const money = useMoney();
  const { busy, run } = useBusy();
  const tx = state.transactions.find((t) => t.id === txId);
  const max = tx ? refundableAmount(state, tx) : 0;
  const [amount, setAmount] = useState(centsToInput(max));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(amount, { max });
    if (!p.ok) return setError(p.error);
    setError(null);
    void run(() => {
      const res = act((s, ctx) => merchantRefund(s, ctx, txId, p.cents, reason || undefined), { quietError: true });
      if (res.ok) setDone(p.cents);
      else setError(res.error);
    });
  };

  return (
    <Modal open onClose={onClose} title="Remboursement commerçant" description="Simule un retour d’article ou une annulation par le commerçant fictif.">
      {!tx ? (
        <Callout tone="danger">Dépense introuvable.</Callout>
      ) : done !== null ? (
        <div className="flex flex-col items-center py-6 text-center">
          <SuccessCheck />
          <p className="mt-4 text-xl font-bold">{money(done)} remboursés</p>
          <p className="text-muted">par {tx.label} (simulation)</p>
          <Button className="mt-6" block onClick={onClose}>
            Terminé
          </Button>
        </div>
      ) : max <= 0 ? (
        <Callout tone="info">Cette dépense ne peut plus être remboursée (déjà remboursée, contrepassée ou refusée).</Callout>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <dl className="divide-y divide-line rounded-2xl border border-line px-4">
            <KeyValue label="Commerçant" value={tx.label} />
            <KeyValue label="Dépense initiale" value={money(-tx.amount)} />
            <KeyValue label="Encore remboursable" value={money(max)} strong />
          </dl>
          <AmountInput value={amount} onChange={setAmount} error={error} label="Montant remboursé" autoFocus />
          <Field label="Motif (facultatif)" htmlFor="refund-reason">
            <TextInput id="refund-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="Ex. article retourné" />
          </Field>
          <Button type="submit" block size="lg" loading={busy} icon={RotateCcw}>
            Confirmer le remboursement
          </Button>
        </form>
      )}
    </Modal>
  );
}
