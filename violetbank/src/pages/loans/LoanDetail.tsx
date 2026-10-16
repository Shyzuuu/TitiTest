import { ArrowLeft, CalendarClock, CalendarPlus, Download, Landmark, Printer, Settings2, Undo2, Wallet, XCircle, Zap, Banknote } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ProductIcon, ScheduleChart, ScheduleTable, SimulationDisclaimer } from '../../components/LoanParts';
import { Badge, Button, Callout, Card, ConfirmDialog, EmptyState, Field, KeyValue, Modal, PageHeader, Progress, Segmented, StatTile, TextInput } from '../../components/ui';
import { formatDate, formatTime } from '../../domain/dates';
import { cancelLoan, cancelLoanBlocker, deferInstallment, lastReversiblePaymentId, quoteRevision, recastBlocker, reversePayment, reviseLoan } from '../../domain/loans';
import { formatRate } from '../../domain/money';
import type { Loan } from '../../domain/schema';
import {
  installmentRemaining,
  isActiveLoan,
  loanOutstanding,
  loanPaidInterest,
  loanRepaidPrincipal,
  loanTheoreticalInterest,
  loanTotalPaid,
  nextOpenInstallment,
  openInstallmentsCount,
} from '../../domain/selectors';
import { downloadBlob } from '../../lib/download';
import { useBankState, useMoney, useToday } from '../../lib/hooks';
import { LOAN_STATUS_TONE, REPAYMENT_MODE_LABEL } from '../../lib/labels';
import { bpsToInput, parseRate } from '../../lib/loanParams';
import { loanStatementHtml } from '../../lib/statement';
import { LOAN_STATUS_LABEL } from '../../domain/selectors';
import { useBank } from '../../store/bank';

const PAYMENT_LABEL = { installment: 'Échéance', partial: 'Paiement partiel', prepayment: 'Remboursement anticipé', payoff: 'Remboursement total' } as const;

function ReviseModal({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const today = useToday();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const [rate, setRate] = useState(bpsToInput(loan.annualRateBps));
  const [months, setMonths] = useState(String(openInstallmentsCount(loan)));
  const parsedRate = parseRate(rate);
  const parsedMonths = Number(months);
  const preview = useMemo(() => {
    if (!parsedRate.ok || !Number.isInteger(parsedMonths)) return { error: 'Paramètres invalides.' } as const;
    try {
      return { q: quoteRevision(loan, today, parsedRate.bps, parsedMonths) } as const;
    } catch (e) {
      return { error: (e as Error).message } as const;
    }
  }, [loan, today, parsedRate.ok, parsedRate.ok ? parsedRate.bps : 0, parsedMonths]);

  return (
    <Modal open onClose={onClose} title="Modifier les hypothèses" description="Seules les échéances futures sont recalculées ; les paiements passés restent intacts et le changement est historisé.">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nouveau taux fictif (%)" htmlFor="rev-rate" error={parsedRate.ok ? null : parsedRate.error}>
            <TextInput id="rev-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
          </Field>
          <Field label="Échéances restantes" htmlFor="rev-months">
            <TextInput id="rev-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        {'error' in preview ? (
          <Callout tone="warn">{preview.error}</Callout>
        ) : (
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line p-4 text-sm">
            <p className="col-span-2 font-semibold">Impact du changement</p>
            <span className="text-muted">Mensualité</span>
            <span className="num text-right font-semibold">{money(preview.q.before.nextPayment)} → {money(preview.q.after.nextPayment)}</span>
            <span className="text-muted">Échéances restantes</span>
            <span className="num text-right font-semibold">{preview.q.before.remainingCount} → {preview.q.after.remainingCount}</span>
            <span className="text-muted">Intérêts restants</span>
            <span className="num text-right font-semibold">{money(preview.q.before.remainingInterest)} → {money(preview.q.after.remainingInterest)}</span>
            <span className="text-muted">Dernière échéance</span>
            <span className="num text-right font-semibold">{preview.q.after.lastDueDate ? formatDate(preview.q.after.lastDueDate) : '—'}</span>
          </div>
        )}
        <Button
          block
          disabled={'error' in preview}
          onClick={() => {
            if (!parsedRate.ok) return;
            if (act((s, ctx) => reviseLoan(s, ctx, loan.id, parsedRate.bps, parsedMonths)).ok) onClose();
          }}
        >
          Appliquer le nouveau scénario
        </Button>
      </div>
    </Modal>
  );
}

export default function LoanDetail() {
  const { loanId } = useParams();
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'schedule' | 'payments' | 'history' | 'chart'>('schedule');
  const [revising, setRevising] = useState(false);
  const [confirm, setConfirm] = useState<'cancel' | 'defer' | { reverse: string } | null>(null);
  const loan = state.loans.find((l) => l.id === loanId);

  if (!loan) {
    return (
      <Card>
        <EmptyState icon={Landmark} title="Prêt introuvable" action={<Button onClick={() => navigate('/prets/mes-prets')}>Mes prêts</Button>}>
          Ce prêt fictif n’existe pas ou les données ont été réinitialisées.
        </EmptyState>
      </Card>
    );
  }
  const product = state.loanProducts.find((p) => p.id === loan.productId);
  const app = state.loanApplications.find((a) => a.id === loan.applicationId);
  const account = state.accounts.find((a) => a.id === loan.accountId);
  const next = nextOpenInstallment(loan);
  const outstanding = loanOutstanding(loan);
  const repaid = loanRepaidPrincipal(loan);
  const active = isActiveLoan(loan);
  const blocker = recastBlocker(loan, today);
  const cancelBlock = cancelLoanBlocker(state, loan);
  const reversibleId = lastReversiblePaymentId(loan);
  const events = state.loanEvents.filter((e) => e.loanId === loan.id || (e.applicationId === loan.applicationId && e.loanId === null));
  const rows = loan.schedule.map((i) => ({ ...i, installment: i }));
  const statement = () => downloadBlob(`releve-simulation-${loan.reference}.html`, loanStatementHtml(state, loan, today, today), 'text/html;charset=utf-8');
  const print = () => {
    const w = window.open('', '_blank', 'noopener=no');
    if (!w) return statement();
    w.document.write(loanStatementHtml(state, loan, today, today));
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div>
      <Link to="/prets/mes-prets" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:underline">
        <ArrowLeft size={16} aria-hidden /> Mes prêts
      </Link>
      <PageHeader
        title={`${loan.label}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{loan.reference}</span>· créé le {formatDate(loan.createdAt)}
            <Badge tone={LOAN_STATUS_TONE[loan.status]}>{LOAN_STATUS_LABEL[loan.status]}</Badge>
          </span>
        }
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={statement}>Relevé</Button>
            <Button variant="secondary" icon={Printer} onClick={print} className="hidden sm:inline-flex">Imprimer</Button>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-4 bg-gradient-to-br from-brand to-brand-deep p-6 text-white">
            <ProductIcon product={product} size={52} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/80">Capital restant dû (simulation)</p>
              <p className="num text-4xl font-extrabold tracking-tight" data-testid="loan-outstanding">{money(outstanding)}</p>
              <p className="text-sm text-white/80">sur {money(loan.principal)} de capital initial fictif</p>
            </div>
          </div>
          <div className="p-6">
            <Progress value={(repaid / loan.principal) * 100} color="rgb(var(--ok))" label="Capital remboursé" />
            <p className="mt-2 text-sm text-muted">
              {money(repaid)} de capital remboursé ({Math.round((repaid / loan.principal) * 100)} %) · capital initial = remboursé + restant dû
            </p>
            {active && (
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button icon={Wallet} onClick={() => navigate(`/prets/remboursement?pret=${loan.id}&mode=installment`)} data-testid="pay-installment">Payer l’échéance</Button>
                <Button variant="soft" icon={Zap} onClick={() => navigate(`/prets/remboursement?pret=${loan.id}&mode=prepay`)}>Anticipé</Button>
                <Button variant="soft" icon={Banknote} onClick={() => navigate(`/prets/remboursement?pret=${loan.id}&mode=payoff`)}>Solder</Button>
                <Button variant="secondary" icon={Settings2} onClick={() => setRevising(true)} disabled={!!blocker} title={blocker ?? undefined}>Hypothèses</Button>
              </div>
            )}
            {active && blocker && <p className="mt-2 text-xs text-muted">Modification des hypothèses : {blocker}</p>}
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-bold">Caractéristiques</h2>
          <dl className="divide-y divide-line">
            <KeyValue label="Taux annuel nominal fictif" value={formatRate(loan.annualRateBps)} />
            {loan.initialAnnualRateBps !== loan.annualRateBps && <KeyValue label="Taux initial" value={formatRate(loan.initialAnnualRateBps)} tone="muted" />}
            <KeyValue label="Mensualité actuelle" value={next ? money(next.amount) : '—'} />
            <KeyValue label="Nombre d’échéances" value={`${loan.schedule.length} (${openInstallmentsCount(loan)} restantes)`} />
            <KeyValue label="Intérêts théoriques" value={money(loanTheoreticalInterest(loan))} />
            <KeyValue label="Intérêts payés" value={money(loanPaidInterest(loan))} />
            <KeyValue label="Déjà remboursé" value={money(loanTotalPaid(loan))} />
            <KeyValue label="Prochaine échéance" value={next ? `${formatDate(next.dueDate)}${next.dueDate < today ? ' (en retard)' : ''}` : '—'} tone={next && next.dueDate < today ? 'danger' : undefined} />
            <KeyValue label="Mode" value={REPAYMENT_MODE_LABEL[loan.repaymentMode]} />
            <KeyValue label="Date de début" value={formatDate(loan.startDate)} />
            <KeyValue label="Compte de versement" value={account?.name ?? '—'} />
            {app && <KeyValue label="Dossier d’origine" value={<span className="font-mono">{app.reference}</span>} />}
          </dl>
          {active && (
            <div className="mt-4 space-y-2">
              {state.settings.allowDeferral && next && (
                <Button variant="ghost" size="sm" icon={CalendarPlus} block onClick={() => setConfirm('defer')} disabled={next.status === 'partial' || next.deferred}>
                  Reporter l’échéance n°{next.index}
                </Button>
              )}
              <Button variant="ghost" size="sm" icon={XCircle} block onClick={() => setConfirm('cancel')} disabled={!!cancelBlock} title={cancelBlock ?? undefined}>
                Annuler le scénario
              </Button>
              {cancelBlock && <p className="text-center text-xs text-muted">{cancelBlock}</p>}
            </div>
          )}
        </Card>
      </div>

      {next && active && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Prochaine échéance" value={money(installmentRemaining(next))} icon={CalendarClock} tone={next.dueDate < today ? 'danger' : 'info'} hint={`n°${next.index} · ${formatDate(next.dueDate)}`} />
          <StatTile label="dont capital" value={money(next.principal - next.paidPrincipal)} icon={Landmark} />
          <StatTile label="dont intérêts" value={money(next.interest - next.paidInterest)} icon={Landmark} tone="warn" />
          <StatTile label="Dernière échéance" value={formatDate(loan.schedule[loan.schedule.length - 1]?.dueDate ?? today)} icon={CalendarClock} tone="neutral" />
        </div>
      )}

      <Card className="mt-6 p-4 sm:p-6">
        <div className="mb-4">
          <Segmented
            label="Sections du prêt"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'schedule', label: 'Tableau d’amortissement' },
              { value: 'chart', label: 'Graphique' },
              { value: 'payments', label: `Remboursements (${loan.payments.length})` },
              { value: 'history', label: 'Historique' },
            ]}
          />
        </div>
        {tab === 'schedule' && <ScheduleTable rows={rows} loan={loan} />}
        {tab === 'chart' && <ScheduleChart rows={rows} />}
        {tab === 'payments' &&
          (loan.payments.length === 0 ? (
            <EmptyState icon={Wallet} title="Aucun remboursement">Les remboursements fictifs apparaîtront ici.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {[...loan.payments].reverse().map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {PAYMENT_LABEL[p.kind]}
                      {p.installmentIndex ? ` n°${p.installmentIndex}` : ''} {p.reversed && <Badge tone="warn">Contrepassé</Badge>}
                    </p>
                    <p className="num text-xs text-muted">
                      {formatDate(p.date)} à {formatTime(p.date)} · capital {money(p.principal)} · intérêts {money(p.interest)}
                      {p.fee ? ` · frais ${money(p.fee)}` : ''}
                    </p>
                  </div>
                  <span className={`num font-bold ${p.reversed ? 'text-muted line-through' : ''}`}>{money(p.amount)}</span>
                  {p.id === reversibleId && (
                    <Button size="sm" variant="ghost" icon={Undo2} onClick={() => setConfirm({ reverse: p.id })}>
                      Contrepasser
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ))}
        {tab === 'history' && (
          <ol className="relative space-y-4 border-l-2 border-line pl-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-brand" />
                <p className="text-sm font-semibold">
                  {e.status} {e.amount !== null && <span className="num text-muted">· {money(e.amount)}</span>}
                </p>
                <p className="text-sm text-muted">{e.description}</p>
                <p className="text-xs text-muted">{formatDate(e.date)} à {formatTime(e.date)}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      {loan.revisions.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="mb-3 text-lg font-bold">Changements de scénario</h2>
          <ul className="space-y-2 text-sm">
            {loan.revisions.map((r) => (
              <li key={r.id} className="rounded-2xl bg-raised p-3">
                <p className="text-xs text-muted">{formatDate(r.date)} {r.reversed && '· annulé par contrepassation'}</p>
                <p>{r.description}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <SimulationDisclaimer className="mt-6" />

      {revising && <ReviseModal loan={loan} onClose={() => setRevising(false)} />}
      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        tone="danger"
        title="Annuler ce scénario de prêt ?"
        confirmLabel="Annuler le prêt"
        onConfirm={() => {
          if (act((s, ctx) => cancelLoan(s, ctx, loan.id)).ok) setConfirm(null);
        }}
      >
        Le capital fictif ({money(loan.principal)}) sera restitué par contrepassation du versement. L’historique est conservé.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'defer'}
        onClose={() => setConfirm(null)}
        title="Reporter l’échéance ?"
        confirmLabel="Reporter d’un mois"
        onConfirm={() => {
          if (act((s, ctx) => deferInstallment(s, ctx, loan.id)).ok) setConfirm(null);
        }}
      >
        L’échéance n°{next?.index} et les suivantes sont décalées d’un mois. Simplification de démonstration : aucun intérêt supplémentaire n’est calculé.
      </ConfirmDialog>
      <ConfirmDialog
        open={typeof confirm === 'object' && confirm !== null}
        onClose={() => setConfirm(null)}
        title="Contrepasser ce remboursement ?"
        confirmLabel="Contrepasser"
        onConfirm={() => {
          if (typeof confirm === 'object' && confirm && act((s, ctx) => reversePayment(s, ctx, loan.id, confirm.reverse)).ok) setConfirm(null);
        }}
      >
        Le montant est recrédité sur le compte, l’échéancier antérieur est restauré et une écriture de contrepassation liée est créée. Rien n’est supprimé.
      </ConfirmDialog>
    </div>
  );
}
