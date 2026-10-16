import { Banknote, CircleDollarSign, Landmark, Wallet, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AccountSelect } from '../../components/AccountSelect';
import { AmountInput } from '../../components/AmountInput';
import { SimulationDisclaimer } from '../../components/LoanParts';
import { Button, Callout, Card, EmptyState, Field, KeyValue, PageHeader, Segmented, Select, SuccessCheck } from '../../components/ui';
import { formatDate } from '../../domain/dates';
import { payInstallment, payoffLoan, payPartial, prepayLoan, quotePayoff, quotePrepayment, type PrepayStrategy } from '../../domain/loans';
import { parseAmount } from '../../domain/money';
import { installmentRemaining, isActiveLoan, loanOutstanding, nextOpenInstallment } from '../../domain/selectors';
import { useBalances, useBankState, useBusy, useMoney, useToday } from '../../lib/hooks';
import { useBank } from '../../store/bank';

type Mode = 'installment' | 'partial' | 'prepay' | 'payoff';

export default function Repayment() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const balances = useBalances();
  const act = useBank((s) => s.act);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { busy, run } = useBusy(700);
  const loans = state.loans.filter(isActiveLoan);
  const [loanId, setLoanId] = useState(() => loans.find((l) => l.id === params.get('pret'))?.id ?? loans[0]?.id ?? '');
  const [mode, setMode] = useState<Mode>(() => (['installment', 'partial', 'prepay', 'payoff'].includes(params.get('mode') ?? '') ? (params.get('mode') as Mode) : 'installment'));
  const loan = loans.find((l) => l.id === loanId);
  const [account, setAccount] = useState(loan?.accountId ?? state.accounts.find((a) => !a.archived)?.id ?? '');
  const [amount, setAmount] = useState('');
  const [strategy, setStrategy] = useState<PrepayStrategy>('reduce_duration');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ loanId: string; amount: number; outstanding: number; repaid: boolean } | null>(null);
  const feeBps = state.settings.earlyRepaymentFeeBps;

  const next = loan ? nextOpenInstallment(loan) : undefined;
  const outstanding = loan ? loanOutstanding(loan) : 0;
  const available = balances.accounts.get(account) ?? 0;
  const parsed = parseAmount(amount);

  // Aperçu calculé par les mêmes fonctions que l'exécution : pas d'écart possible.
  const preview = useMemo(() => {
    if (!loan || !next) return null;
    try {
      if (mode === 'installment') {
        const due = installmentRemaining(next);
        return { debit: due, principal: next.principal - next.paidPrincipal, interest: next.interest - next.paidInterest, fee: 0, after: outstanding - (next.principal - next.paidPrincipal) };
      }
      if (mode === 'partial') {
        if (!parsed.ok) return { error: parsed.error };
        const due = installmentRemaining(next);
        if (parsed.cents > due) return { error: `Le paiement partiel doit être inférieur ou égal au reste de l’échéance (${money(due)}).` };
        const remI = next.interest - next.paidInterest;
        const interest = Math.min(parsed.cents, remI);
        return { debit: parsed.cents, principal: parsed.cents - interest, interest, fee: 0, after: outstanding - (parsed.cents - interest) };
      }
      if (mode === 'payoff') {
        const q = quotePayoff(loan, today, feeBps, `${today}T00:00:00`);
        return { debit: q.total, principal: q.principal, interest: q.interest, fee: q.fee, after: 0, waived: q.waivedInterest };
      }
      if (!parsed.ok) return { error: parsed.error };
      const q = quotePrepayment(loan, parsed.cents, strategy, today, feeBps);
      return { debit: q.total, principal: q.amount, interest: 0, fee: q.fee, after: q.outstandingAfter, saved: q.interestSaved, before: q.before, afterSnap: q.after, isPayoff: q.isPayoff };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [loan, next, mode, parsed.ok, parsed.ok ? parsed.cents : 0, strategy, today, feeBps, outstanding, money]);

  // L'écran de succès précède le test « aucun prêt actif » : un prêt soldé n'est plus actif.
  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="flex flex-col items-center p-8 text-center">
          <SuccessCheck size={88} />
          <p className="mt-4 text-2xl font-extrabold">Remboursement fictif effectué</p>
          <p className="mt-1 text-muted">{money(done.amount)} débités dans la simulation.</p>
          <p className="mt-3 text-sm">
            Capital restant dû : <strong className="num">{money(done.outstanding)}</strong>
          </p>
          {done.repaid && <p className="mt-2 font-semibold text-ok">Prêt remboursé intégralement dans la simulation 🎉</p>}
          <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
            <Button variant="secondary" block onClick={() => setDone(null)} disabled={done.repaid && loans.length === 0}>
              Nouveau remboursement
            </Button>
            <Link to={`/prets/${done.loanId}`} className="w-full">
              <Button block>Voir le prêt</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!loans.length || !loan) {
    return (
      <div>
        <PageHeader title="Remboursement fictif" icon={Landmark} />
        <Card>
          <EmptyState icon={Landmark} title="Aucun prêt actif" action={<Button onClick={() => navigate('/prets')}>Prêts fictifs</Button>}>
            Activez un prêt fictif pour simuler des remboursements.
          </EmptyState>
        </Card>
      </div>
    );
  }

  const confirm = () =>
    run(() => {
      if (!preview || 'error' in preview) return;
      if (preview.debit > available) return setError(`Solde insuffisant : ${money(available)} disponibles pour ${money(preview.debit)}.`);
      setError(null);
      const res =
        mode === 'installment'
          ? act((s, ctx) => payInstallment(s, ctx, loan.id, account, next?.index), { quietError: true })
          : mode === 'partial'
            ? act((s, ctx) => payPartial(s, ctx, loan.id, account, parsed.ok ? parsed.cents : 0), { quietError: true })
            : mode === 'payoff'
              ? act((s, ctx) => payoffLoan(s, ctx, loan.id, account), { quietError: true })
              : act((s, ctx) => prepayLoan(s, ctx, loan.id, account, parsed.ok ? parsed.cents : 0, strategy), { quietError: true });
      if (res.ok) {
        const updated = res.state.loans.find((l) => l.id === loan.id);
        setDone({ loanId: loan.id, amount: res.data.amount, outstanding: updated ? loanOutstanding(updated) : 0, repaid: updated?.status === 'repaid' });
        setAmount('');
      } else setError(res.error);
    });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Remboursement fictif" icon={Wallet} subtitle="Payez une mensualité, un montant partiel, remboursez par anticipation ou soldez un prêt de démonstration." />
      <Card className="space-y-5 p-5 sm:p-7">
        <Field label="Prêt fictif" htmlFor="rep-loan">
          <Select
            id="rep-loan"
            value={loanId}
            onChange={(e) => {
              setLoanId(e.target.value);
              const l = loans.find((x) => x.id === e.target.value);
              if (l) setAccount(l.accountId);
              setError(null);
            }}
          >
            {loans.map((l) => (
              <option key={l.id} value={l.id}>
                {l.reference} · {l.label} · reste {money(loanOutstanding(l))}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-raised p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">Capital restant dû</p>
            <p className="num text-lg font-bold">{money(outstanding)}</p>
          </div>
          <div>
            <p className="text-muted">Prochaine échéance</p>
            <p className="num text-lg font-bold">{next ? money(installmentRemaining(next)) : '—'}</p>
          </div>
          <div>
            <p className="text-muted">Date</p>
            <p className={`text-lg font-bold ${next && next.dueDate < today ? 'text-danger' : ''}`}>{next ? `n°${next.index} · ${formatDate(next.dueDate)}` : '—'}</p>
          </div>
        </div>
        <div>
          <span className="label">Type de remboursement</span>
          <Segmented
            label="Type de remboursement"
            block
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
            options={[
              { value: 'installment', label: 'Mensualité' },
              { value: 'partial', label: 'Partiel' },
              { value: 'prepay', label: 'Anticipé' },
              { value: 'payoff', label: 'Total' },
            ]}
          />
        </div>
        <AccountSelect value={account} onChange={setAccount} label="Compte de simulation débité" />
        {(mode === 'partial' || mode === 'prepay') && (
          <AmountInput
            value={amount}
            onChange={setAmount}
            label={mode === 'partial' ? 'Montant du paiement partiel' : 'Capital à rembourser par anticipation'}
            hint={mode === 'partial' ? `Imputé d’abord sur les intérêts de l’échéance, puis sur le capital.` : `Maximum : ${money(outstanding)} (capital restant dû).`}
          />
        )}
        {mode === 'prepay' && (
          <div>
            <span className="label">Après le remboursement anticipé</span>
            <Segmented block label="Stratégie" value={strategy} onChange={setStrategy} options={[{ value: 'reduce_duration', label: 'Réduire la durée' }, { value: 'reduce_payment', label: 'Réduire la mensualité' }]} />
          </div>
        )}

        {preview && 'error' in preview ? (
          amount || mode === 'installment' || mode === 'payoff' ? <Callout tone="warn">{preview.error}</Callout> : null
        ) : preview ? (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-1 font-semibold">Avant confirmation</p>
            <dl className="divide-y divide-line">
              <KeyValue label="Montant du remboursement" value={money(preview.debit)} strong />
              <KeyValue label="dont capital" value={money(preview.principal)} />
              <KeyValue label="dont intérêts fictifs" value={money(preview.interest)} />
              {preview.fee > 0 && <KeyValue label="Frais de simulation (configurés)" value={money(preview.fee)} />}
              {'waived' in preview && preview.waived ? <KeyValue label="Intérêts futurs non dus" value={money(preview.waived)} tone="ok" /> : null}
              <KeyValue label="Solde disponible" value={money(available)} />
              <KeyValue label="Solde après opération" value={money(available - preview.debit)} tone={available - preview.debit < 0 ? 'danger' : undefined} />
              <KeyValue label="Capital restant dû avant" value={money(outstanding)} />
              <KeyValue label="Capital restant dû estimé après" value={money(preview.after)} tone="ok" />
              {'saved' in preview && preview.saved !== undefined && <KeyValue label="Économie d’intérêts théorique" value={money(preview.saved)} tone="ok" />}
              {'afterSnap' in preview && preview.afterSnap && preview.before && !preview.isPayoff && (
                <KeyValue label="Nouvel échéancier estimé" value={`${preview.before.remainingCount} → ${preview.afterSnap.remainingCount} échéances · ${money(preview.before.nextPayment)} → ${money(preview.afterSnap.nextPayment)}/mois`} />
              )}
            </dl>
            {preview.debit > available && <Callout tone="danger" className="mt-3">Solde insuffisant sur ce compte de simulation.</Callout>}
            {mode !== 'installment' && mode !== 'partial' && feeBps === 0 && <p className="mt-2 text-xs text-muted">Aucune pénalité de remboursement anticipé (frais désactivés par défaut).</p>}
          </div>
        ) : null}
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <Button
          block
          size="lg"
          loading={busy}
          disabled={!preview || 'error' in preview}
          icon={mode === 'payoff' ? Banknote : mode === 'prepay' ? Zap : CircleDollarSign}
          onClick={() => void confirm()}
          data-testid="confirm-repayment"
        >
          Confirmer le remboursement fictif
        </Button>
      </Card>
      <SimulationDisclaimer className="mt-6" />
    </div>
  );
}
