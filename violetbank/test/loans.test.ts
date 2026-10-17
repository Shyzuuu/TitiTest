import { describe, expect, it } from 'vitest';
import { accountBalance, computeBalances } from '../src/domain/core';
import {
  activateLoan,
  cancelApplication,
  cancelLoan,
  createApplication,
  decideApplication,
  deferInstallment,
  lastReversiblePaymentId,
  payInstallment,
  payoffLoan,
  payPartial,
  prepayLoan,
  quotePayoff,
  quotePrepayment,
  reversePayment,
  reviseLoan,
  syncLoanReminders,
  type ApplicationInput,
} from '../src/domain/loans';
import { checkIntegrity, validateState } from '../src/domain/persistence';
import type { BankState, Loan } from '../src/domain/schema';
import { loanOutstanding, loanPaidInterest, loanRepaidPrincipal, loanTotalPaid } from '../src/domain/selectors';
import { withdraw } from '../src/domain/accounts';
import { ctxAt, freshState, unwrap } from './helpers';

const DAY = '2026-01-15';
const input = (over: Partial<ApplicationInput> = {}): ApplicationInput => ({
  productId: 'prd_custom',
  amount: 100_000,
  months: 12,
  annualRateBps: 600,
  repaymentMode: 'annuity',
  startDate: DAY,
  purpose: '',
  accountId: 'acc_main',
  ...over,
});

function activeLoan(funds = 50_000, over: Partial<ApplicationInput> = {}): { state: BankState; loan: Loan } {
  let s = freshState(DAY, funds);
  const app = unwrap(createApplication(s, ctxAt(DAY), input(over), true));
  s = unwrap(decideApplication(app.state, ctxAt(DAY), app.data.id)).state;
  const res = unwrap(activateLoan(s, ctxAt(DAY), app.data.id));
  return { state: res.state, loan: res.data };
}

const loanOf = (s: BankState, id: string) => s.loans.find((l) => l.id === id) as Loan;

function assertInvariant(s: BankState, loanId: string) {
  const loan = loanOf(s, loanId);
  // Capital initial = capital remboursé + capital restant dû.
  if (loan.status !== 'cancelled') expect(loanRepaidPrincipal(loan) + loanOutstanding(loan)).toBe(loan.principal);
  expect(checkIntegrity(s)).toBeNull();
  // Cohérence historique ↔ solde : le solde est la somme du grand livre.
  const sum = s.transactions.filter((t) => t.status === 'completed' && t.accountId === 'acc_main').reduce((a, t) => a + t.amount, 0);
  expect(accountBalance(s, 'acc_main')).toBe(sum);
}

describe('demandes et décision simulée', () => {
  it('scénario C : 1 000 € / 12 mois acceptés, historisés', () => {
    const s = freshState(DAY, 50_000);
    const app = unwrap(createApplication(s, ctxAt(DAY), input(), true));
    expect(app.data.status).toBe('pending');
    const decided = unwrap(decideApplication(app.state, ctxAt(DAY), app.data.id));
    expect(decided.data.status).toBe('accepted');
    const kinds = decided.state.loanEvents.map((e) => e.kind);
    expect(kinds).toEqual(expect.arrayContaining(['application_created', 'application_submitted', 'decision']));
  });

  it('refuse un montant hors limites avec explication', () => {
    const s = freshState(DAY);
    const app = unwrap(createApplication(s, ctxAt(DAY), input({ productId: 'prd_small', amount: 500_000 }), true));
    const d = unwrap(decideApplication(app.state, ctxAt(DAY), app.data.id));
    expect(d.data.status).toBe('refused');
    expect(d.data.decisionReason).toMatch(/hors des limites/);
  });

  it('durée invalide : soumission impossible', () => {
    const res = createApplication(freshState(DAY), ctxAt(DAY), input({ productId: 'prd_small', months: 48 }), true);
    expect(res.ok).toBe(false);
  });

  it('motif requis : informations manquantes', () => {
    const app = unwrap(createApplication(freshState(DAY), ctxAt(DAY), input({ productId: 'prd_project', amount: 200_000, months: 24 }), true));
    expect(unwrap(decideApplication(app.state, ctxAt(DAY), app.data.id)).data.status).toBe('info_required');
  });

  it('mode manuel : résultat choisi, limites structurelles conservées', () => {
    let s = freshState(DAY);
    s = { ...s, settings: { ...s.settings, decisionMode: 'manual' } };
    const app = unwrap(createApplication(s, ctxAt(DAY), input(), true));
    expect(decideApplication(app.state, ctxAt(DAY), app.data.id).ok).toBe(false);
    expect(unwrap(decideApplication(app.state, ctxAt(DAY), app.data.id, 'refused')).data.status).toBe('refused');
    const big = unwrap(createApplication(s, ctxAt(DAY), input({ productId: 'prd_small', amount: 900_000 }), true));
    expect(unwrap(decideApplication(big.state, ctxAt(DAY), big.data.id, 'accepted')).data.status).toBe('refused');
  });

  it('avertit si le solde de test est inférieur à une mensualité', () => {
    const app = unwrap(createApplication(freshState(DAY, 0), ctxAt(DAY), input(), true));
    const d = unwrap(decideApplication(app.state, ctxAt(DAY), app.data.id));
    expect(d.data.status).toBe('accepted');
    expect(d.data.decisionWarnings.length).toBe(1);
  });

  it('demande annulée : activation impossible', () => {
    const app = unwrap(createApplication(freshState(DAY), ctxAt(DAY), input(), true));
    const d = unwrap(decideApplication(app.state, ctxAt(DAY), app.data.id));
    const c = unwrap(cancelApplication(d.state, ctxAt(DAY), app.data.id));
    expect(activateLoan(c.state, ctxAt(DAY), app.data.id).ok).toBe(false);
  });
});

describe('activation (scénario D)', () => {
  it('crédite le capital une seule fois et génère l’échéancier', () => {
    const { state, loan } = activeLoan(50_000);
    expect(accountBalance(state, 'acc_main')).toBe(150_000);
    expect(loanOutstanding(loan)).toBe(100_000);
    expect(loan.schedule).toHaveLength(12);
    expect(loan.schedule[0]?.dueDate).toBe('2026-02-15');
    const again = activateLoan(state, ctxAt(DAY), loan.applicationId);
    expect(again.ok).toBe(false);
    expect(state.transactions.filter((t) => t.type === 'loan_disbursement')).toHaveLength(1);
    assertInvariant(state, loan.id);
  });

  it('survit à un aller-retour de sérialisation (rechargement)', () => {
    const { state, loan } = activeLoan();
    const reloaded = validateState(JSON.parse(JSON.stringify(state)));
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) {
      expect(reloaded.state.loans[0]?.status).toBe('active');
      expect(activateLoan(reloaded.state, ctxAt(DAY), loan.applicationId).ok).toBe(false);
    }
  });

  it('refuse un état où un dossier aurait été activé deux fois', () => {
    const { state, loan } = activeLoan();
    const corrupted = { ...state, loans: [loan, { ...loan, id: 'loan_dup' }] };
    expect(checkIntegrity(corrupted)).toMatch(/deux fois/);
  });
});

describe('remboursements (scénario E)', () => {
  it('débite la mensualité, réduit le capital de la part de capital, intérêts à part', () => {
    const { state, loan } = activeLoan(50_000);
    const first = loan.schedule[0]!;
    const res = unwrap(payInstallment(state, ctxAt('2026-02-15'), loan.id, 'acc_main', 1));
    expect(accountBalance(res.state, 'acc_main')).toBe(150_000 - first.amount);
    const l = loanOf(res.state, loan.id);
    expect(loanOutstanding(l)).toBe(100_000 - first.principal);
    expect(loanPaidInterest(l)).toBe(first.interest);
    expect(l.schedule[0]?.status).toBe('paid');
    expect(l.status).toBe('partially_repaid');
    const tx = res.state.transactions.find((t) => t.id === l.payments[0]?.txId)!;
    expect(tx.amount).toBe(-first.amount);
    expect(tx.principalPart! + tx.interestPart!).toBe(first.amount);
    // Paiement en double bloqué.
    const dup = payInstallment(res.state, ctxAt('2026-02-15'), loan.id, 'acc_main', 1);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toMatch(/double/);
    assertInvariant(res.state, loan.id);
  });

  it('les échéances se paient dans l’ordre', () => {
    const { state, loan } = activeLoan();
    const res = payInstallment(state, ctxAt(DAY), loan.id, 'acc_main', 3);
    expect(res.ok).toBe(false);
  });

  it('solde insuffisant : remboursement refusé sans effet', () => {
    const { state, loan } = activeLoan(0);
    const drained = unwrap(withdraw(state, ctxAt(DAY), { accountId: 'acc_main', amount: 100_000 })).state;
    const res = payInstallment(drained, ctxAt(DAY), loan.id, 'acc_main');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/insuffisant/);
  });

  it('paiement partiel : intérêts d’abord, puis complément', () => {
    const { state, loan } = activeLoan();
    const first = loan.schedule[0]!;
    const p1 = unwrap(payPartial(state, ctxAt(DAY), loan.id, 'acc_main', 300));
    let l = loanOf(p1.state, loan.id);
    expect(l.schedule[0]).toMatchObject({ status: 'partial', paidInterest: 300, paidPrincipal: 0 });
    const p2 = unwrap(payPartial(p1.state, ctxAt(DAY), loan.id, 'acc_main', 1_000));
    l = loanOf(p2.state, loan.id);
    expect(l.schedule[0]?.paidInterest).toBe(first.interest);
    expect(l.schedule[0]?.paidPrincipal).toBe(300 + 1_000 - first.interest);
    expect(payPartial(p2.state, ctxAt(DAY), loan.id, 'acc_main', first.amount).ok).toBe(false);
    const rest = first.amount - 1_300;
    const p3 = unwrap(payPartial(p2.state, ctxAt(DAY), loan.id, 'acc_main', rest));
    expect(loanOf(p3.state, loan.id).schedule[0]?.status).toBe('paid');
    assertInvariant(p3.state, loan.id);
  });

  it('remboursement de toutes les échéances : prêt clôturé, capital nul', () => {
    let { state, loan } = activeLoan(50_000);
    for (const i of loan.schedule) state = unwrap(payInstallment(state, ctxAt(i.dueDate), loan.id, 'acc_main', i.index)).state;
    const l = loanOf(state, loan.id);
    expect(l.status).toBe('repaid');
    expect(loanOutstanding(l)).toBe(0);
    expect(loanRepaidPrincipal(l)).toBe(100_000);
    expect(loanTotalPaid(l)).toBe(loan.schedule.reduce((s, i) => s + i.amount, 0));
    expect(payInstallment(state, ctxAt('2027-02-01'), loan.id, 'acc_main').ok).toBe(false);
    assertInvariant(state, loan.id);
  });
});

describe('remboursement total et anticipé (scénario F)', () => {
  it('solde total : capital + intérêts échus, intérêts futurs non dus', () => {
    const { state, loan } = activeLoan(50_000);
    const paid = unwrap(payInstallment(state, ctxAt('2026-02-15'), loan.id, 'acc_main')).state;
    const l = loanOf(paid, loan.id);
    const q = quotePayoff(l, '2026-03-01', 0, '2026-03-01T10:00:00');
    expect(q.principal).toBe(loanOutstanding(l));
    expect(q.interest).toBe(0);
    expect(q.waivedInterest).toBeGreaterThan(0);
    const before = accountBalance(paid, 'acc_main');
    const res = unwrap(payoffLoan(paid, ctxAt('2026-03-01'), loan.id, 'acc_main'));
    const done = loanOf(res.state, loan.id);
    expect(done.status).toBe('repaid');
    expect(loanOutstanding(done)).toBe(0);
    expect(accountBalance(res.state, 'acc_main')).toBe(before - q.total);
    expect(done.schedule.slice(1).every((i) => i.status === 'settled')).toBe(true);
    assertInvariant(res.state, loan.id);
  });

  it('solde total inclut les intérêts d’une échéance échue', () => {
    const { state, loan } = activeLoan(50_000);
    const q = quotePayoff(loanOf(state, loan.id), '2026-02-20', 0, '2026-02-20T10:00:00');
    expect(q.interest).toBe(loan.schedule[0]?.interest);
  });

  it('anticipé partiel : durée réduite ou mensualité réduite, économie d’intérêts', () => {
    const { state, loan } = activeLoan(80_000);
    const dur = quotePrepayment(loan, 40_000, 'reduce_duration', DAY, 0);
    expect(dur.after.remainingCount).toBeLessThan(12);
    expect(dur.after.nextPayment).toBe(loan.schedule[0]?.amount);
    expect(dur.interestSaved).toBeGreaterThan(0);
    const pay = quotePrepayment(loan, 40_000, 'reduce_payment', DAY, 0);
    expect(pay.after.remainingCount).toBe(12);
    expect(pay.after.nextPayment).toBeLessThan(loan.schedule[0]!.amount);

    const res = unwrap(prepayLoan(state, ctxAt(DAY), loan.id, 'acc_main', 40_000, 'reduce_duration'));
    const l = loanOf(res.state, loan.id);
    expect(loanOutstanding(l)).toBe(60_000);
    expect(l.revisions).toHaveLength(1);
    expect(accountBalance(res.state, 'acc_main')).toBe(180_000 - 40_000);
    assertInvariant(res.state, loan.id);
    expect(() => quotePrepayment(l, 60_001, 'reduce_payment', DAY, 0)).toThrow(/dépasser/);
  });

  it('frais de simulation configurables, désactivés par défaut', () => {
    const { state, loan } = activeLoan(80_000);
    expect(quotePrepayment(loan, 40_000, 'reduce_payment', DAY, state.settings.earlyRepaymentFeeBps).fee).toBe(0);
    const withFee = { ...state, settings: { ...state.settings, earlyRepaymentFeeBps: 100 } };
    const res = unwrap(prepayLoan(withFee, ctxAt(DAY), loan.id, 'acc_main', 40_000, 'reduce_payment'));
    expect(res.data.fee).toBe(400);
    expect(res.state.transactions.some((t) => t.type === 'loan_fee' && t.amount === -400)).toBe(true);
    expect(accountBalance(res.state, 'acc_main')).toBe(180_000 - 40_400);
  });

  it('anticipé bloqué si une échéance est échue', () => {
    const { state, loan } = activeLoan(80_000);
    expect(prepayLoan(state, ctxAt('2026-03-01'), loan.id, 'acc_main', 10_000, 'reduce_payment').ok).toBe(false);
  });
});

describe('corrections, révisions et annulation', () => {
  it('contrepassation du dernier paiement : échéancier et solde restaurés, trace conservée', () => {
    const { state, loan } = activeLoan(50_000);
    const p1 = unwrap(payInstallment(state, ctxAt('2026-02-15'), loan.id, 'acc_main'));
    const p2 = unwrap(payInstallment(p1.state, ctxAt('2026-03-15'), loan.id, 'acc_main'));
    expect(reversePayment(p2.state, ctxAt('2026-03-16'), loan.id, p1.data.id).ok).toBe(false);
    const r = unwrap(reversePayment(p2.state, ctxAt('2026-03-16'), loan.id, p2.data.id));
    const l = loanOf(r.state, loan.id);
    expect(l.schedule[1]?.status).toBe('upcoming');
    expect(accountBalance(r.state, 'acc_main')).toBe(accountBalance(p1.state, 'acc_main'));
    expect(r.state.transactions.find((t) => t.id === p2.data.txId)?.reversedBy).toBeTruthy();
    expect(r.state.transactions.some((t) => t.type === 'reversal' && t.reversalOf === p2.data.txId)).toBe(true);
    expect(lastReversiblePaymentId(l)).toBe(p1.data.id);
    assertInvariant(r.state, loan.id);
  });

  it('contrepassation d’un remboursement total : le prêt redevient actif', () => {
    const { state, loan } = activeLoan(150_000);
    const p = unwrap(payoffLoan(state, ctxAt(DAY), loan.id, 'acc_main'));
    const r = unwrap(reversePayment(p.state, ctxAt(DAY), loan.id, p.data.id));
    expect(loanOf(r.state, loan.id).status).toBe('active');
    expect(loanOutstanding(loanOf(r.state, loan.id))).toBe(100_000);
  });

  it('révision du taux : historique conservé, nouvelles échéances seulement', () => {
    const { state, loan } = activeLoan(50_000);
    const p = unwrap(payInstallment(state, ctxAt('2026-02-15'), loan.id, 'acc_main'));
    const r = unwrap(reviseLoan(p.state, ctxAt('2026-02-16'), loan.id, 300, 11));
    const l = r.data;
    expect(l.schedule[0]?.status).toBe('paid');
    expect(l.schedule[0]?.amount).toBe(loan.schedule[0]?.amount);
    expect(l.schedule[1]!.amount).toBeLessThan(loan.schedule[1]!.amount);
    expect(l.revisions[0]?.kind).toBe('rate');
    expect(l.initialAnnualRateBps).toBe(600);
    // Le paiement antérieur à une révision n'est plus contrepassable.
    expect(lastReversiblePaymentId(l)).toBeNull();
    assertInvariant(r.state, loan.id);
  });

  it('report d’échéance : décalage d’un mois, sans doublon', () => {
    const { state, loan } = activeLoan();
    const r = unwrap(deferInstallment(state, ctxAt(DAY), loan.id));
    expect(r.data.schedule[0]?.dueDate).toBe('2026-03-15');
    expect(r.data.schedule[11]?.dueDate).toBe('2027-02-15');
    expect(deferInstallment(r.state, ctxAt(DAY), loan.id).ok).toBe(false);
    const off = { ...state, settings: { ...state.settings, allowDeferral: false } };
    expect(deferInstallment(off, ctxAt(DAY), loan.id).ok).toBe(false);
  });

  it('annulation : capital restitué, impossible après un paiement', () => {
    const { state, loan } = activeLoan(50_000);
    const c = unwrap(cancelLoan(state, ctxAt(DAY), loan.id));
    expect(accountBalance(c.state, 'acc_main')).toBe(50_000);
    expect(loanOf(c.state, loan.id).status).toBe('cancelled');
    expect(payInstallment(c.state, ctxAt(DAY), loan.id, 'acc_main').ok).toBe(false);
    expect(c.state.loanEvents.some((e) => e.kind === 'cancellation')).toBe(true);
    const paid = unwrap(payInstallment(state, ctxAt(DAY), loan.id, 'acc_main')).state;
    expect(cancelLoan(paid, ctxAt(DAY), loan.id).ok).toBe(false);
  });

  it('dates de fin de mois : 31 janvier → 28 février → 31 mars', () => {
    const { loan } = activeLoan(0, { startDate: '2026-01-31' });
    expect(loan.schedule.slice(0, 3).map((i) => i.dueDate)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('rappels d’échéance dédupliqués et retards signalés', () => {
    const { state } = activeLoan();
    const once = syncLoanReminders(state, ctxAt('2026-02-10'));
    const twice = syncLoanReminders(once, ctxAt('2026-02-10'));
    expect(twice.notifications.filter((n) => n.kind === 'loan_due')).toHaveLength(1);
    const late = syncLoanReminders(twice, ctxAt('2026-02-20'));
    expect(late.notifications.some((n) => n.title.includes('retard dans la simulation'))).toBe(true);
  });

  it('les soldes dérivés restent cohérents après une séquence complète', () => {
    let { state, loan } = activeLoan(200_000);
    state = unwrap(payInstallment(state, ctxAt('2026-02-15'), loan.id, 'acc_main')).state;
    state = unwrap(payPartial(state, ctxAt('2026-03-10'), loan.id, 'acc_main', 2_000)).state;
    state = unwrap(payInstallment(state, ctxAt('2026-03-15'), loan.id, 'acc_main')).state;
    state = unwrap(prepayLoan(state, ctxAt('2026-03-20'), loan.id, 'acc_main', 20_000, 'reduce_payment')).state;
    state = unwrap(payoffLoan(state, ctxAt('2026-03-25'), loan.id, 'acc_main')).state;
    const l = loanOf(state, loan.id);
    expect(l.status).toBe('repaid');
    expect(loanRepaidPrincipal(l)).toBe(100_000);
    const balances = computeBalances(state.transactions);
    expect(balances.accounts.get('acc_main')).toBe(300_000 - loanTotalPaid(l));
    assertInvariant(state, loan.id);
  });
});
