/**
 * Moteur de calcul des prêts : fonctions pures, sans état, sur des centimes entiers.
 * Les taux sont exprimés en points de base annuels (600 = 6,00 % nominal).
 */
import { addMonths, type ISODate } from './dates';
import { roundHalfUp, type Cents } from './money';

export type RepaymentMode = 'annuity' | 'constant_principal';

export interface AmortizationRow {
  principal: Cents;
  interest: Cents;
  amount: Cents;
  balanceAfter: Cents;
}

/** Garde-fou contre les boucles infinies (50 ans de mensualités). */
export const MAX_INSTALLMENTS = 600;

export function monthlyRate(annualRateBps: number): number {
  if (!Number.isFinite(annualRateBps) || annualRateBps < 0) throw new Error('Taux annuel invalide');
  return annualRateBps / 10_000 / 12;
}

/**
 * Mensualité théorique d'un prêt amortissable : P × r / (1 − (1 + r)^−n),
 * ou P / n si le taux est nul. Calcul en double précision puis arrondi au centime.
 */
export function annuityPayment(principal: Cents, rate: number, count: number): Cents {
  if (!Number.isSafeInteger(principal) || principal <= 0) throw new Error('Capital invalide');
  if (!Number.isInteger(count) || count <= 0) throw new Error('Nombre de mensualités invalide');
  if (rate === 0) return roundHalfUp(principal / count);
  return roundHalfUp((principal * rate) / (1 - Math.pow(1 + rate, -count)));
}

export interface AmortizeInput {
  principal: Cents;
  rate: number;
  mode: RepaymentMode;
  /** Nombre d'échéances (durée imposée). */
  count?: number;
  /** Mensualité imposée (mode annuité, durée déduite). */
  fixedPayment?: Cents;
  /** Part de capital imposée (mode capital constant, durée déduite). */
  fixedPrincipal?: Cents;
}

/**
 * Génère le tableau d'amortissement. Les intérêts de chaque période sont arrondis
 * au centime sur le capital restant ; la dernière échéance absorbe l'écart
 * d'arrondi afin que le capital restant dû tombe exactement à zéro.
 */
export function amortize(input: AmortizeInput): AmortizationRow[] {
  const { principal, rate, mode } = input;
  if (!Number.isSafeInteger(principal) || principal <= 0) throw new Error('Capital invalide');
  if (!Number.isFinite(rate) || rate < 0) throw new Error('Taux invalide');

  let count = input.count;
  let periodicPrincipal: Cents | undefined;
  let payment: Cents | undefined;

  if (mode === 'annuity') {
    if (input.fixedPayment !== undefined) {
      payment = input.fixedPayment;
      if (!Number.isSafeInteger(payment) || payment <= 0) throw new Error('Mensualité invalide');
      if (payment <= roundHalfUp(principal * rate)) throw new Error('La mensualité ne couvre pas les intérêts : amortissement impossible');
    } else {
      if (count === undefined) throw new Error('Durée manquante');
      payment = annuityPayment(principal, rate, count);
    }
  } else {
    if (input.fixedPrincipal !== undefined) {
      periodicPrincipal = input.fixedPrincipal;
      if (!Number.isSafeInteger(periodicPrincipal) || periodicPrincipal <= 0) throw new Error('Part de capital invalide');
    } else {
      if (count === undefined) throw new Error('Durée manquante');
      periodicPrincipal = roundHalfUp(principal / count);
    }
  }
  if (count !== undefined && (!Number.isInteger(count) || count <= 0 || count > MAX_INSTALLMENTS)) {
    throw new Error('Nombre de mensualités invalide');
  }

  const rows: AmortizationRow[] = [];
  let balance = principal;
  for (let i = 1; balance > 0; i++) {
    if (i > MAX_INSTALLMENTS) throw new Error('Durée de remboursement excessive');
    const interest = roundHalfUp(balance * rate);
    const isLastByCount = count !== undefined && i === count;
    let principalPart: Cents;
    if (mode === 'annuity') principalPart = (payment as Cents) - interest;
    else principalPart = periodicPrincipal as Cents;
    // Dernière échéance : solde exact du capital, l'arrondi est absorbé ici.
    if (isLastByCount || principalPart >= balance) principalPart = balance;
    if (principalPart <= 0) throw new Error('La mensualité ne couvre pas les intérêts : amortissement impossible');
    balance -= principalPart;
    rows.push({ principal: principalPart, interest, amount: principalPart + interest, balanceAfter: balance });
  }
  return rows;
}

export interface ScheduleSummary {
  count: number;
  totalAmount: Cents;
  totalInterest: Cents;
  totalPrincipal: Cents;
  firstPayment: Cents;
  lastPayment: Cents;
}

export function summarize(rows: readonly AmortizationRow[]): ScheduleSummary {
  let totalAmount = 0;
  let totalInterest = 0;
  let totalPrincipal = 0;
  for (const r of rows) {
    totalAmount += r.amount;
    totalInterest += r.interest;
    totalPrincipal += r.principal;
  }
  return {
    count: rows.length,
    totalAmount,
    totalInterest,
    totalPrincipal,
    firstPayment: rows[0]?.amount ?? 0,
    lastPayment: rows[rows.length - 1]?.amount ?? 0,
  };
}

export interface QuoteInput {
  principal: Cents;
  annualRateBps: number;
  months: number;
  mode: RepaymentMode;
  startDate: ISODate;
}

export interface QuotedRow extends AmortizationRow {
  index: number;
  dueDate: ISODate;
}

export interface LoanQuote extends ScheduleSummary {
  monthlyRate: number;
  annualRateBps: number;
  rows: QuotedRow[];
}

/** Devis complet : échéancier daté (1re échéance un mois après le début) et totaux issus des lignes. */
export function quoteLoan(input: QuoteInput): LoanQuote {
  const rate = monthlyRate(input.annualRateBps);
  const rows = amortize({ principal: input.principal, rate, mode: input.mode, count: input.months });
  const dated = rows.map((r, i) => ({ ...r, index: i + 1, dueDate: addMonths(input.startDate, i + 1) }));
  return { ...summarize(rows), monthlyRate: rate, annualRateBps: input.annualRateBps, rows: dated };
}

/** Nombre de mensualités nécessaires pour une mensualité fixe donnée (annuité). */
export function countForPayment(principal: Cents, rate: number, payment: Cents): number {
  return amortize({ principal, rate, mode: 'annuity', fixedPayment: payment }).length;
}
