import { ArrowDownLeft, Copy } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AccountSelect } from '../components/AccountSelect';
import { AmountInput } from '../components/AmountInput';
import { Avatar, Button, Callout, Card, Field, PageHeader, Select, SuccessCheck, TextInput } from '../components/ui';
import { receiveFromContact } from '../domain/accounts';
import { parseAmount } from '../domain/money';
import { useActiveAccounts, useBankState, useBusy, useMoney } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';

/** Motif décoratif déterministe (pas un vrai code QR) dérivé de l'identifiant de démonstration. */
function DemoPattern({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    const out: boolean[] = [];
    for (let i = 0; i < 121; i++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      out.push((h & 1) === 1);
    }
    return out;
  }, [seed]);
  return (
    <svg viewBox="0 0 11 11" className="h-44 w-44 rounded-2xl bg-white p-3" role="img" aria-label="Motif décoratif de démonstration">
      {cells.map((on, i) => (on ? <rect key={i} x={i % 11} y={Math.floor(i / 11)} width="1" height="1" rx=".2" fill="#4930B5" /> : null))}
      <rect x="4" y="4" width="3" height="3" rx=".6" fill="#7656F6" />
    </svg>
  );
}

export default function Receive() {
  const state = useBankState();
  const accounts = useActiveAccounts();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const toast = useUi((s) => s.toast);
  const { busy, run } = useBusy(700);
  const contacts = state.contacts.filter((c) => !c.archived);
  const [contactId, setContactId] = useState(contacts[0]?.id ?? '');
  const [account, setAccount] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(amount);
    if (!p.ok) return setError(p.error);
    if (!contactId) return setError('Choisissez un contact fictif.');
    setError(null);
    void run(() => {
      const res = act((s, ctx) => receiveFromContact(s, ctx, { accountId: account, contactId, amount: p.cents, message }), { quietError: true });
      if (res.ok) {
        setDone(`${money(p.cents)} reçus de ${contacts.find((c) => c.id === contactId)?.name}.`);
        setAmount('');
        setMessage('');
      } else setError(res.error);
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.profile.demoHandle);
      toast('success', 'Identifiant de démonstration copié');
    } catch {
      toast('error', 'Copie impossible', 'Le presse-papiers n’est pas accessible dans ce navigateur.');
    }
  };

  return (
    <div>
      <PageHeader title="Recevoir de l’argent fictif" icon={ArrowDownLeft} subtitle="Partagez votre identifiant de démonstration ou simulez la réception d’un contact fictif." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col items-center p-6 text-center">
          <div className="rounded-3xl bg-gradient-to-br from-[#B9A7FF] via-brand to-brand-deep p-3 shadow-glow">
            <DemoPattern seed={state.profile.demoHandle} />
          </div>
          <p className="mt-5 text-sm text-muted">Votre identifiant local de démonstration</p>
          <p className="mt-1 font-mono text-xl font-bold">{state.profile.demoHandle}</p>
          <Button className="mt-4" variant="secondary" icon={Copy} onClick={() => void copy()}>
            Copier
          </Button>
          <p className="mt-4 max-w-xs text-xs text-muted">Motif purement décoratif : il ne s’agit ni d’un IBAN ni d’un code de paiement. Aucun tiers ne peut vous envoyer de vrais fonds.</p>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold">Simuler une réception</h2>
          {done ? (
            <div className="flex flex-col items-center py-6 text-center">
              <SuccessCheck />
              <p className="mt-4 text-lg font-bold">Argent fictif reçu</p>
              <p className="text-muted">{done}</p>
              <Button className="mt-5" variant="secondary" onClick={() => setDone(null)}>
                Nouvelle réception
              </Button>
            </div>
          ) : contacts.length === 0 ? (
            <Callout tone="info">Ajoutez d’abord un contact fictif depuis la page Contacts.</Callout>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Expéditeur fictif" htmlFor="rcv-contact">
                <div className="flex items-center gap-3">
                  {contacts.find((c) => c.id === contactId) && <Avatar emoji={contacts.find((c) => c.id === contactId)!.emoji} color={contacts.find((c) => c.id === contactId)!.color} />}
                  <Select id="rcv-contact" value={contactId} onChange={(e) => setContactId(e.target.value)}>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
              <AccountSelect value={account} onChange={setAccount} label="Compte crédité" />
              <AmountInput value={amount} onChange={setAmount} error={error} presets={[1_000, 2_500, 5_000, 10_000]} />
              <Field label="Message (facultatif)" htmlFor="rcv-msg">
                <TextInput id="rcv-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={120} />
              </Field>
              <Button type="submit" block size="lg" loading={busy} icon={ArrowDownLeft}>
                Simuler la réception
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
