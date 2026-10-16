/**
 * Valeurs dérivées (soldes, statistiques, état des prêts). Toutes sont recalculées
 * depuis le grand livre et l'échéancier : aucune n'est stockée.
 */
import { computeBalances, effectiveType, isPosted } from './core';
import { addDays, diffDays, datePart, monthKey, type ISODate } from './dates';
import type { BankState, Installment, Loan, LoanApplication, Transaction, TxType } from './schema';

export const SPENDING_TYPES: ReadonlySet<TxType> = new Set(['expense', 'withdrawal', 'p2p_out', 'loan_repayment', 'loan_prepayment', 'loan_fee']);
/** Dépenses courantes : les remboursements de prêts sont suivis à part. */
export const ORDINARY_OUT_TYPES: ReadonlySet<TxType> = new Set(['expense', 'withdrawal', 'p2p_out']);
export const ORDINARY_IN_TYPES: ReadonlySet<TxType> = new Set(['deposit', 'p2p_in']);
export const LOAN_OUT_TYPES: ReadonlySet<TxType> = new Set(['loan_repayment', 'loan_prepayment', 'loan_fee']);
export const INTERNAL_TYPES: ReadonlySet<TxType> = new Set(['transfer_in', 'transfer_out', 'vault_deposit', 'vault_withdrawal']);

export function categorySpent(state: BankState, category: string, month: string): number {
  let spent = 0;
  for (const tx of state.transactions) {
    if (!isPosted(tx) || tx.category !== category || monthKey(tx.date) !== month) continue;
    if (SPENDING_TYPES.has(effectiveType(tx))) spent -= tx.amount;
  }
  return spent;
}

export function isActiveLoan(loan: Loan): boolean {
  return loan.status === 'active' || loan.status === 'partially_repaid';
}

export function isOpenInstallment(i: Installment): boolean {
  return i.status === 'upcoming' || i.status === 'partial';
}

export function installmentRemaining(i: Installment): number {
  if (!isOpenInstallment(i)) return 0;
  return i.amount - i.paidPrincipal - i.paidInterest;
}

/** Capital restant dû = capital initial − capital remboursé (hors paiements contrepassés). */
export function loanOutstanding(loan: Loan): number {
  if (loan.status === 'cancelled' || loan.status === 'repaid') return 0;
  return loan.principal - loanRepaidPrincipal(loan);
}

export function loanRepaidPrincipal(loan: Loan): number {
  let total = 0;
  for (const p of loan.payments) if (!p.reversed) total += p.principal;
  return total;
}

export function loanPaidInterest(loan: Loan): number {
  let total = 0;
  for (const p of loan.payments) if (!p.reversed) total += p.interest;
  return total;
}

export function loanPaidFees(loan: Loan): number {
  let total = 0;
  for (const p of loan.payments) if (!p.reversed) total += p.fee;
  return total;
}

export function loanTotalPaid(loan: Loan): number {
  let total = 0;
  for (const p of loan.payments) if (!p.reversed) total += p.amount;
  return total;
}

export function nextOpenInstallment(loan: Loan): Installment | undefined {
  return loan.schedule.find(isOpenInstallment);
}

export function remainingScheduledInterest(loan: Loan): number {
  let total = 0;
  for (const i of loan.schedule) if (isOpenInstallment(i)) total += i.interest - i.paidInterest;
  return total;
}

/** Intérêts théoriques du prêt : intérêts payés + intérêts restant à l'échéancier. */
export function loanTheoreticalInterest(loan: Loan): number {
  if (loan.status === 'cancelled') return 0;
  return loanPaidInterest(loan) + remainingScheduledInterest(loan);
}

export function openInstallmentsCount(loan: Loan): number {
  return loan.schedule.filter(isOpenInstallment).length;
}

export type InstallmentDisplayStatus = 'upcoming' | 'due_today' | 'late' | 'paid' | 'partial' | 'deferred' | 'settled' | 'cancelled';

export function installmentDisplayStatus(i: Installment, today: ISODate, loan?: Loan): InstallmentDisplayStatus {
  if (loan?.status === 'cancelled') return 'cancelled';
  if (i.status === 'paid') return 'paid';
  if (i.status === 'settled') return 'settled';
  if (i.dueDate < today) return 'late';
  if (i.status === 'partial') return 'partial';
  if (i.dueDate === today) return 'due_today';
  if (i.deferred) return 'deferred';
  return 'upcoming';
}

export interface DashboardSummary {
  available: number;
  inVaults: number;
  monthIn: number;
  monthOut: number;
  monthLoanOut: number;
  loanOutstanding: number;
  nextDue: { loan: Loan; installment: Installment } | null;
  txCount: number;
  cardCount: number;
}

export function dashboardSummary(state: BankState, today: ISODate): DashboardSummary {
  const balances = computeBalances(state.transactions);
  const activeAccounts = new Set(state.accounts.filter((a) => !a.archived).map((a) => a.id));
  let available = 0;
  for (const [id, v] of balances.accounts) if (activeAccounts.has(id)) available += v;
  let inVaults = 0;
  for (const v of state.vaults) if (!v.archived) inVaults += balances.vaults.get(v.id) ?? 0;

  const month = monthKey(today);
  let monthIn = 0;
  let monthOut = 0;
  let monthLoanOut = 0;
  let txCount = 0;
  for (const tx of state.transactions) {
    if (!isPosted(tx)) continue;
    txCount++;
    if (monthKey(tx.date) !== month || datePart(tx.date) > today) continue;
    const t = effectiveType(tx);
    if (ORDINARY_IN_TYPES.has(t)) monthIn += tx.amount;
    else if (ORDINARY_OUT_TYPES.has(t)) monthOut -= tx.amount;
    else if (LOAN_OUT_TYPES.has(t)) monthLoanOut -= tx.amount;
  }

  let loanOut = 0;
  let nextDue: DashboardSummary['nextDue'] = null;
  for (const loan of state.loans) {
    if (!isActiveLoan(loan)) continue;
    loanOut += loanOutstanding(loan);
    const inst = nextOpenInstallment(loan);
    if (inst && (!nextDue || inst.dueDate < nextDue.installment.dueDate)) nextDue = { loan, installment: inst };
  }
  return {
    available,
    inVaults,
    monthIn,
    monthOut,
    monthLoanOut,
    loanOutstanding: loanOut,
    nextDue,
    txCount,
    cardCount: state.cards.filter((c) => !c.deletedAt).length,
  };
}

export interface LoanPortfolio {
  borrowed: number;
  outstanding: number;
  repaidTotal: number;
  repaidPrincipal: number;
  interestPaid: number;
  pendingApplications: number;
  activeCount: number;
  closedCount: number;
  nextDue: { loan: Loan; installment: Installment } | null;
}

export function loanPortfolio(state: BankState): LoanPortfolio {
  const p: LoanPortfolio = {
    borrowed: 0,
    outstanding: 0,
    repaidTotal: 0,
    repaidPrincipal: 0,
    interestPaid: 0,
    pendingApplications: 0,
    activeCount: 0,
    closedCount: 0,
    nextDue: null,
  };
  for (const loan of state.loans) {
    if (loan.status === 'cancelled') continue;
    p.borrowed += loan.principal;
    p.outstanding += loanOutstanding(loan);
    p.repaidTotal += loanTotalPaid(loan);
    p.repaidPrincipal += loanRepaidPrincipal(loan);
    p.interestPaid += loanPaidInterest(loan);
    if (isActiveLoan(loan)) {
      p.activeCount++;
      const inst = nextOpenInstallment(loan);
      if (inst && (!p.nextDue || inst.dueDate < p.nextDue.installment.dueDate)) p.nextDue = { loan, installment: inst };
    } else p.closedCount++;
  }
  p.pendingApplications = state.loanApplications.filter((a) => ['draft', 'pending', 'accepted', 'info_required'].includes(a.status)).length;
  return p;
}

export type UnifiedLoanStatus =
  | 'draft'
  | 'pending'
  | 'accepted'
  | 'info_required'
  | 'active'
  | 'partially_repaid'
  | 'repaid'
  | 'cancelled'
  | 'refused';

export const LOAN_STATUS_LABEL: Record<UnifiedLoanStatus, string> = {
  draft: 'Brouillon',
  pending: 'En cours de simulation',
  accepted: 'Accepté dans la simulation',
  info_required: 'Informations manquantes',
  active: 'Actif dans la simulation',
  partially_repaid: 'Remboursement partiel simulé',
  repaid: 'Remboursé intégralement dans la simulation',
  cancelled: 'Annulé',
  refused: 'Refusé dans la simulation',
};

export function applicationUnifiedStatus(app: LoanApplication): UnifiedLoanStatus | null {
  if (app.status === 'activated') return null;
  return app.status;
}

/** Fenêtre de dates d'une période de statistiques. */
export function periodRange(today: ISODate, period: '7d' | '30d' | '90d' | '12m'): { from: ISODate; to: ISODate } {
  const days = period === '7d' ? 6 : period === '30d' ? 29 : period === '90d' ? 89 : 364;
  return { from: addDays(today, -days), to: today };
}

export interface FlowBucket {
  key: string;
  label: string;
  income: number;
  expenses: number;
  loanIn: number;
  loanOut: number;
  interest: number;
  principalRepaid: number;
  balance: number;
  vaults: number;
}

/**
 * Agrège les flux par jour, semaine ou mois et reconstitue le solde total des
 * comptes en fin de période en rejouant le grand livre (O(n log n)).
 */
export function flowBuckets(state: BankState, today: ISODate, period: '7d' | '30d' | '90d' | '12m'): FlowBucket[] {
  const { from } = periodRange(today, period);
  const granularity: 'day' | 'week' | 'month' = period === '12m' ? 'month' : period === '90d' ? 'week' : 'day';
  const bucketKey = (day: ISODate): string => {
    if (granularity === 'month') return monthKey(day);
    if (granularity === 'day') return day;
    return addDays(from, Math.floor(diffDays(from, day) / 7) * 7);
  };

  const keys: string[] = [];
  if (granularity === 'month') {
    let cursor = `${from.slice(0, 7)}-01`;
    while (monthKey(cursor) <= monthKey(today)) {
      keys.push(monthKey(cursor));
      const [y, m] = cursor.split('-').map(Number) as [number, number];
      cursor = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    }
  } else {
    const step = granularity === 'day' ? 1 : 7;
    for (let d = from; d <= today; d = addDays(d, step)) keys.push(d);
  }
  const buckets = new Map<string, FlowBucket>();
  for (const k of keys) {
    buckets.set(k, { key: k, label: k, income: 0, expenses: 0, loanIn: 0, loanOut: 0, interest: 0, principalRepaid: 0, balance: 0, vaults: 0 });
  }

  const posted = state.transactions.filter(isPosted).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let balance = 0;
  let vaults = 0;
  let i = 0;
  // Solde d'ouverture : tout ce qui précède la période.
  for (; i < posted.length && datePart((posted[i] as Transaction).date) < from; i++) {
    const tx = posted[i] as Transaction;
    balance += tx.amount;
    if (tx.vaultId) vaults -= tx.amount;
  }
  let lastBalance = balance;
  let lastVaults = vaults;
  const byKey = new Map<string, { balance: number; vaults: number }>();
  for (; i < posted.length; i++) {
    const tx = posted[i] as Transaction;
    const day = datePart(tx.date);
    if (day > today) break;
    balance += tx.amount;
    if (tx.vaultId) vaults -= tx.amount;
    const key = bucketKey(day);
    const b = buckets.get(key);
    byKey.set(key, { balance, vaults });
    if (!b) continue;
    const t = effectiveType(tx);
    if (ORDINARY_IN_TYPES.has(t)) b.income += tx.amount;
    else if (ORDINARY_OUT_TYPES.has(t)) b.expenses -= tx.amount;
    else if (t === 'loan_disbursement') b.loanIn += tx.amount;
    else if (LOAN_OUT_TYPES.has(t)) {
      b.loanOut -= tx.amount;
      const sign = tx.type === 'reversal' ? -1 : 1;
      b.interest += sign * (tx.interestPart ?? 0);
      b.principalRepaid += sign * (tx.principalPart ?? 0);
    }
  }
  for (const k of keys) {
    const b = buckets.get(k) as FlowBucket;
    const snap = byKey.get(k);
    if (snap) {
      lastBalance = snap.balance;
      lastVaults = snap.vaults;
    }
    b.balance = lastBalance;
    b.vaults = lastVaults;
  }
  return keys.map((k) => buckets.get(k) as FlowBucket);
}

export function expensesByCategory(state: BankState, from: ISODate, to: ISODate): Map<string, number> {
  const map = new Map<string, number>();
  for (const tx of state.transactions) {
    if (!isPosted(tx)) continue;
    const day = datePart(tx.date);
    if (day < from || day > to) continue;
    if (!ORDINARY_OUT_TYPES.has(effectiveType(tx))) continue;
    map.set(tx.category, (map.get(tx.category) ?? 0) - tx.amount);
  }
  for (const [k, v] of map) if (v <= 0) map.delete(k);
  return map;
}

export function cardMonthSpent(state: BankState, cardId: string, month: string): number {
  let spent = 0;
  for (const tx of state.transactions) {
    if (!isPosted(tx) || tx.cardId !== cardId || monthKey(tx.date) !== month) continue;
    if (effectiveType(tx) === 'expense') spent -= tx.amount;
  }
  return spent;
}
