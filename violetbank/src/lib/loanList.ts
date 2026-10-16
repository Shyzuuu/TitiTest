import type { BankState } from '../domain/schema';
import {
  loanOutstanding,
  loanTheoreticalInterest,
  loanTotalPaid,
  nextOpenInstallment,
  openInstallmentsCount,
  type UnifiedLoanStatus,
} from '../domain/selectors';
import { quoteLoan } from '../domain/loanMath';

export interface UnifiedLoanItem {
  key: string;
  kind: 'application' | 'loan';
  id: string;
  reference: string;
  productId: string;
  label: string;
  status: UnifiedLoanStatus;
  principal: number;
  outstanding: number;
  payment: number;
  months: number;
  remaining: number;
  interest: number;
  totalPaid: number;
  nextDue: string | null;
  createdAt: string;
  link: string;
}

/** Vue unifiée « Mes prêts » : demandes non activées + prêts activés. */
export function unifiedLoans(state: BankState): UnifiedLoanItem[] {
  const products = new Map(state.loanProducts.map((p) => [p.id, p]));
  const items: UnifiedLoanItem[] = [];
  for (const app of state.loanApplications) {
    if (app.status === 'activated') continue;
    const q = quoteLoan({ principal: app.amount, annualRateBps: app.annualRateBps, months: app.months, mode: app.repaymentMode, startDate: app.startDate });
    items.push({
      key: `app:${app.id}`,
      kind: 'application',
      id: app.id,
      reference: app.reference,
      productId: app.productId,
      label: products.get(app.productId)?.name ?? 'Scénario',
      status: app.status,
      principal: app.amount,
      outstanding: 0,
      payment: q.firstPayment,
      months: app.months,
      remaining: app.months,
      interest: q.totalInterest,
      totalPaid: 0,
      nextDue: null,
      createdAt: app.createdAt,
      link: `/prets/demandes?app=${app.id}`,
    });
  }
  for (const loan of state.loans) {
    const next = nextOpenInstallment(loan);
    items.push({
      key: `loan:${loan.id}`,
      kind: 'loan',
      id: loan.id,
      reference: loan.reference,
      productId: loan.productId,
      label: loan.label,
      status: loan.status,
      principal: loan.principal,
      outstanding: loanOutstanding(loan),
      payment: next ? next.amount : 0,
      months: loan.months,
      remaining: loan.status === 'cancelled' ? 0 : openInstallmentsCount(loan),
      interest: loanTheoreticalInterest(loan),
      totalPaid: loanTotalPaid(loan),
      nextDue: loan.status === 'cancelled' ? null : next?.dueDate ?? null,
      createdAt: loan.createdAt,
      link: `/prets/${loan.id}`,
    });
  }
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
