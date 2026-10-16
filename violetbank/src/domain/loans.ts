/**
 * Module de crédit simulé : demandes, moteur de décision local, activation,
 * échéancier, remboursements (échéance, partiel, anticipé, total), révisions,
 * reports, contrepassations et annulation.
 *
 * Invariant central : capital initial = Σ capital des paiements non contrepassés
 * + Σ capital restant des échéances ouvertes. Les intérêts ne sont jamais
 * ajoutés au capital restant dû.
 */
import { assertFunds, checkBudgetAlert } from './accounts';
import {
  DomainError,
  accountBalance,
  buildTx,
  fail,
  guard,
  ok,
  requireActiveAccount,
  sanitizeText,
  withLog,
  withLoanEvent,
  withNotification,
  withTx,
  type Ctx,
  type OpResult,
} from './core';
import { addDays, addMonths, diffDays, isISODate, type ISODate } from './dates';
import { randomReference } from './ids';
import { amortize, monthlyRate, quoteLoan, summarize, type AmortizationRow, type RepaymentMode } from './loanMath';
import { formatMoney, formatRate, MAX_OPERATION_CENTS, roundHalfUp } from './money';
import type {
  BankState,
  Installment,
  Loan,
  LoanApplication,
  LoanPayment,
  LoanProduct,
  LoanRevision,
  LoanStatus,
  ScenarioSnapshot,
  Transaction,
} from './schema';
import { isActiveLoan, isOpenInstallment, loanOutstanding } from './selectors';

export const DURATION_PRESETS = [3, 6, 12, 24, 36, 48, 60] as const;
export const MAX_DEFERRALS_PER_LOAN = 3;
export const START_DATE_WINDOW_DAYS = 365;

// ───────────────────────────── Demandes ─────────────────────────────

export interface ApplicationInput {
  productId: string;
  amount: number;
  months: number;
  annualRateBps: number;
  repaymentMode: RepaymentMode;
  startDate: ISODate;
  purpose: string;
  accountId: string;
}

export function requireProduct(state: BankState, productId: string): LoanProduct {
  const product = state.loanProducts.find((p) => p.id === productId);
  if (!product) throw new DomainError('Scénario de prêt introuvable.');
  return product;
}

/**
 * Erreurs bloquantes à la soumission. Un montant hors des limites du scénario
 * n'est pas bloquant : c'est le moteur de décision qui le refuse avec explication.
 */
export function validateApplicationInput(state: BankState, input: ApplicationInput, today: ISODate): string[] {
  const errors: string[] = [];
  const product = state.loanProducts.find((p) => p.id === input.productId);
  if (!product) errors.push('Scénario de prêt introuvable.');
  else if (!product.enabled) errors.push('Ce scénario de prêt est désactivé dans les paramètres.');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) errors.push('Le montant doit être positif.');
  else if (input.amount > MAX_OPERATION_CENTS) errors.push(`Montant maximum de simulation : ${formatMoney(MAX_OPERATION_CENTS)}.`);
  if (!Number.isInteger(input.months) || input.months <= 0) errors.push('Durée invalide.');
  else if (product && (input.months < product.minMonths || input.months > product.maxMonths)) {
    errors.push(`Durée invalide pour ce scénario : entre ${product.minMonths} et ${product.maxMonths} mois.`);
  }
  if (Number.isSafeInteger(input.amount) && Number.isInteger(input.months) && input.months > 0 && input.amount < input.months * 100) {
    errors.push('Le montant doit représenter au moins 1,00 par mensualité.');
  }
  if (!Number.isInteger(input.annualRateBps) || input.annualRateBps < 0 || input.annualRateBps > 5000) {
    errors.push('Taux fictif invalide (0 à 50 %).');
  }
  if (!isISODate(input.startDate)) errors.push('Date de début invalide.');
  else if (Math.abs(diffDays(today, input.startDate)) > START_DATE_WINDOW_DAYS) {
    errors.push('La date de début doit se situer à moins d’un an de la date de simulation.');
  }
  const account = state.accounts.find((a) => a.id === input.accountId);
  if (!account || account.archived) errors.push('Compte de versement invalide.');
  return errors;
}

function newApplication(ctx: Ctx, input: ApplicationInput, purpose: string): LoanApplication {
  return {
    id: ctx.id('app'),
    reference: randomReference('DOS'),
    productId: input.productId,
    amount: input.amount,
    months: input.months,
    annualRateBps: input.annualRateBps,
    repaymentMode: input.repaymentMode,
    startDate: input.startDate,
    purpose,
    accountId: input.accountId,
    status: 'draft',
    decisionReason: null,
    decisionWarnings: [],
    decidedBy: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    decidedAt: null,
    loanId: null,
  };
}

function replaceApp(state: BankState, app: LoanApplication): BankState {
  return { ...state, loanApplications: state.loanApplications.map((a) => (a.id === app.id ? app : a)) };
}

function requireApp(state: BankState, appId: string): LoanApplication {
  const app = state.loanApplications.find((a) => a.id === appId);
  if (!app) throw new DomainError('Dossier de simulation introuvable.');
  return app;
}

export function createApplication(state: BankState, ctx: Ctx, input: ApplicationInput, submit: boolean): OpResult<LoanApplication> {
  return guard(() => {
    const errors = validateApplicationInput(state, input, ctx.today);
    if (errors.length) throw new DomainError(errors[0] as string);
    let app = newApplication(ctx, input, sanitizeText(input.purpose, 200));
    let next: BankState = { ...state, loanApplications: [app, ...state.loanApplications] };
    next = withLoanEvent(next, ctx, {
      loanId: null,
      applicationId: app.id,
      kind: 'application_created',
      amount: app.amount,
      status: 'Brouillon',
      description: `Demande ${app.reference} créée : ${formatMoney(app.amount)} sur ${app.months} mois à ${formatRate(app.annualRateBps)} (fictif).`,
    });
    next = withLog(next, ctx, 'info', 'Demande de prêt créée', `${app.reference} · ${formatMoney(app.amount)}`);
    if (submit) {
      const res = submitApplication(next, ctx, app.id);
      if (!res.ok) return res as OpResult<LoanApplication>;
      next = res.state;
      app = res.data;
    }
    return ok(next, app, `Demande ${app.reference} créée.`);
  });
}

export function updateApplication(state: BankState, ctx: Ctx, appId: string, input: ApplicationInput): OpResult<LoanApplication> {
  return guard(() => {
    const app = requireApp(state, appId);
    if (!['draft', 'info_required', 'refused'].includes(app.status)) {
      throw new DomainError('Seule une demande en brouillon, incomplète ou refusée peut être modifiée.');
    }
    const errors = validateApplicationInput(state, input, ctx.today);
    if (errors.length) throw new DomainError(errors[0] as string);
    const updated: LoanApplication = {
      ...app,
      ...input,
      purpose: sanitizeText(input.purpose, 200),
      status: 'draft',
      decisionReason: null,
      decisionWarnings: [],
      decidedBy: null,
      decidedAt: null,
      updatedAt: ctx.now,
    };
    let next = replaceApp(state, updated);
    next = withLoanEvent(next, ctx, {
      loanId: null,
      applicationId: app.id,
      kind: 'application_updated',
      amount: updated.amount,
      status: 'Brouillon',
      description: `Scénario modifié : ${formatMoney(app.amount)} / ${app.months} mois → ${formatMoney(updated.amount)} / ${updated.months} mois.`,
    });
    next = withLog(next, ctx, 'info', 'Demande modifiée', updated.reference);
    return ok(next, updated, 'Demande mise à jour.');
  });
}

export function submitApplication(state: BankState, ctx: Ctx, appId: string): OpResult<LoanApplication> {
  return guard(() => {
    const app = requireApp(state, appId);
    if (!['draft', 'info_required', 'refused'].includes(app.status)) throw new DomainError('Cette demande a déjà été soumise.');
    const errors = validateApplicationInput(state, app, ctx.today);
    if (errors.length) throw new DomainError(errors[0] as string);
    const updated: LoanApplication = { ...app, status: 'pending', updatedAt: ctx.now };
    let next = replaceApp(state, updated);
    next = withLoanEvent(next, ctx, {
      loanId: null,
      applicationId: app.id,
      kind: 'application_submitted',
      amount: app.amount,
      status: 'En cours de simulation',
      description: `Demande ${app.reference} soumise au moteur de décision local.`,
    });
    next = withNotification(next, ctx, {
      kind: 'loan_application',
      title: 'Demande de prêt fictif créée',
      body: `Dossier ${app.reference} : ${formatMoney(app.amount)} sur ${app.months} mois (simulation).`,
      link: `/prets/demandes?app=${app.id}`,
    });
    return ok(next, updated, 'Demande soumise.');
  });
}

export interface DecisionOutcome {
  status: 'accepted' | 'refused' | 'info_required';
  reason: string;
  warnings: string[];
}

/**
 * Règles locales de démonstration. Elles ne constituent en aucun cas une analyse
 * de solvabilité : ce sont des garde-fous de cohérence pour tester l'interface.
 */
export function evaluateApplication(state: BankState, app: Pick<LoanApplication, 'productId' | 'amount' | 'months' | 'annualRateBps' | 'repaymentMode' | 'startDate' | 'purpose' | 'accountId'>): DecisionOutcome {
  const product = state.loanProducts.find((p) => p.id === app.productId);
  const warnings: string[] = [];
  if (!product || !product.enabled) return { status: 'refused', reason: 'Scénario de prêt indisponible dans la simulation.', warnings };
  if (app.amount < product.minAmount || app.amount > product.maxAmount) {
    return {
      status: 'refused',
      reason: `Montant hors des limites du scénario « ${product.name} » (${formatMoney(product.minAmount)} à ${formatMoney(product.maxAmount)}). Modifiez le montant pour relancer la simulation.`,
      warnings,
    };
  }
  if (app.months < product.minMonths || app.months > product.maxMonths) {
    return { status: 'refused', reason: `Durée hors des limites du scénario (${product.minMonths} à ${product.maxMonths} mois).`, warnings };
  }
  if (product.requiresPurpose && !app.purpose.trim()) {
    return { status: 'info_required', reason: 'Ce scénario nécessite un motif (texte libre, aucune pièce justificative). Complétez la demande pour la relancer.', warnings };
  }
  let outstanding = 0;
  for (const l of state.loans) if (isActiveLoan(l)) outstanding += loanOutstanding(l);
  if (outstanding + app.amount > state.settings.maxTotalDebt) {
    return {
      status: 'refused',
      reason: `Plafond d’encours fictif dépassé : ${formatMoney(outstanding)} déjà en cours, plafond de démonstration ${formatMoney(state.settings.maxTotalDebt)} (réglable dans les paramètres).`,
      warnings,
    };
  }
  if (state.settings.balanceRule) {
    const quote = quoteLoan({ principal: app.amount, annualRateBps: app.annualRateBps, months: app.months, mode: app.repaymentMode, startDate: app.startDate });
    const balance = accountBalance(state, app.accountId);
    if (balance < quote.firstPayment) {
      warnings.push(`Avertissement de simulation : le solde de test (${formatMoney(balance)}) est inférieur à une mensualité (${formatMoney(quote.firstPayment)}).`);
    }
  }
  return { status: 'accepted', reason: 'Le scénario respecte les règles locales de démonstration.', warnings };
}

export function decideApplication(
  state: BankState,
  ctx: Ctx,
  appId: string,
  manual?: DecisionOutcome['status'],
): OpResult<LoanApplication> {
  return guard(() => {
    const app = requireApp(state, appId);
    if (app.status !== 'pending') throw new DomainError('Cette demande n’est pas en attente de décision simulée.');
    const auto = evaluateApplication(state, app);
    let outcome = auto;
    let decidedBy: 'auto' | 'manual' = 'auto';
    if (state.settings.decisionMode === 'manual') {
      if (!manual) throw new DomainError('Mode manuel : choisissez le résultat de la simulation.');
      decidedBy = 'manual';
      if (manual === 'accepted' && auto.status === 'refused' && !auto.reason.startsWith('Plafond')) {
        // Les limites structurelles du scénario restent impératives même en mode manuel.
        outcome = { ...auto, reason: `${auto.reason} (le mode manuel ne peut pas accepter un scénario hors limites).` };
      } else {
        const reasons = {
          accepted: 'Résultat « acceptée » choisi manuellement pour tester l’interface.',
          refused: 'Résultat « refusée » choisi manuellement pour tester l’interface.',
          info_required: 'Résultat « informations manquantes » choisi manuellement pour tester l’interface.',
        } as const;
        outcome = { status: manual, reason: reasons[manual], warnings: auto.warnings };
      }
    }
    const updated: LoanApplication = {
      ...app,
      status: outcome.status,
      decisionReason: outcome.reason,
      decisionWarnings: outcome.warnings,
      decidedBy,
      decidedAt: ctx.now,
      updatedAt: ctx.now,
    };
    const statusLabel = { accepted: 'Acceptée dans la simulation', refused: 'Refusée dans la simulation', info_required: 'Informations manquantes' }[outcome.status];
    let next = replaceApp(state, updated);
    next = withLoanEvent(next, ctx, {
      loanId: null,
      applicationId: app.id,
      kind: 'decision',
      amount: app.amount,
      status: statusLabel,
      description: `Décision simulée (${decidedBy === 'auto' ? 'règles locales' : 'mode manuel'}) : ${outcome.reason}`,
    });
    next = withLog(next, ctx, outcome.status === 'accepted' ? 'success' : 'warning', 'Décision de simulation', `${app.reference} · ${statusLabel}`);
    next = withNotification(next, ctx, {
      kind: outcome.status === 'accepted' ? 'loan_accepted' : 'loan_refused',
      title: outcome.status === 'accepted' ? 'Demande acceptée dans la simulation' : outcome.status === 'refused' ? 'Demande refusée dans la simulation' : 'Informations manquantes',
      body: `Dossier ${app.reference} · ${formatMoney(app.amount)}. ${outcome.reason}`,
      link: `/prets/demandes?app=${app.id}`,
    });
    return ok(next, updated, statusLabel);
  });
}

export function cancelApplication(state: BankState, ctx: Ctx, appId: string): OpResult<LoanApplication> {
  return guard(() => {
    const app = requireApp(state, appId);
    if (app.status === 'activated') throw new DomainError('Ce dossier est déjà activé : annulez le prêt depuis sa fiche.');
    if (app.status === 'cancelled') throw new DomainError('Demande déjà annulée.');
    const updated: LoanApplication = { ...app, status: 'cancelled', updatedAt: ctx.now };
    let next = replaceApp(state, updated);
    next = withLoanEvent(next, ctx, {
      loanId: null,
      applicationId: app.id,
      kind: 'application_cancelled',
      amount: null,
      status: 'Annulée',
      description: `Demande ${app.reference} annulée par l’utilisateur.`,
    });
    next = withLog(next, ctx, 'info', 'Demande annulée', app.reference);
    return ok(next, updated, 'Demande annulée.');
  });
}

// ───────────────────────────── Échéancier ─────────────────────────────

export function buildInstallments(rows: readonly AmortizationRow[], startDate: ISODate, firstIndex: number, firstOffset: number): Installment[] {
  return rows.map((r, i) => {
    const monthOffset = firstOffset + i;
    return {
      index: firstIndex + i,
      monthOffset,
      dueDate: addMonths(startDate, monthOffset),
      amount: r.amount,
      principal: r.principal,
      interest: r.interest,
      balanceAfter: r.balanceAfter,
      paidPrincipal: 0,
      paidInterest: 0,
      status: 'upcoming',
      deferred: false,
      paidAt: null,
    };
  });
}

export function snapshotSchedule(schedule: readonly Installment[], annualRateBps: number): ScenarioSnapshot {
  const open = schedule.filter(isOpenInstallment);
  let remainingInterest = 0;
  for (const i of open) remainingInterest += i.interest - i.paidInterest;
  const nextI = open[0];
  return {
    annualRateBps,
    remainingCount: open.length,
    nextPayment: nextI ? nextI.amount - nextI.paidInterest - nextI.paidPrincipal : 0,
    remainingInterest,
    lastDueDate: open[open.length - 1]?.dueDate ?? null,
  };
}

function requireLoan(state: BankState, loanId: string): Loan {
  const loan = state.loans.find((l) => l.id === loanId);
  if (!loan) throw new DomainError('Prêt fictif introuvable.');
  return loan;
}

function requireActive(state: BankState, loanId: string): Loan {
  const loan = requireLoan(state, loanId);
  if (loan.status === 'repaid') throw new DomainError('Ce prêt fictif est déjà entièrement remboursé.');
  if (loan.status === 'cancelled') throw new DomainError('Ce prêt fictif est annulé.');
  return loan;
}

function replaceLoan(state: BankState, loan: Loan): BankState {
  return { ...state, loans: state.loans.map((l) => (l.id === loan.id ? loan : l)) };
}

/** Une révision de l'échéancier exige un échéancier « propre » : pas d'échéance partielle ni échue. */
export function recastBlocker(loan: Loan, today: ISODate): string | null {
  for (const i of loan.schedule) {
    if (!isOpenInstallment(i)) continue;
    if (i.status === 'partial') return `Terminez d’abord le paiement partiel de l’échéance n°${i.index}.`;
    if (i.dueDate <= today) return `Réglez d’abord l’échéance n°${i.index} arrivée à terme dans la simulation.`;
  }
  return null;
}

// ───────────────────────────── Activation ─────────────────────────────

export function activateLoan(state: BankState, ctx: Ctx, appId: string, accountId?: string): OpResult<Loan> {
  return guard(() => {
    const app = requireApp(state, appId);
    if (app.status === 'activated' || app.loanId || state.loans.some((l) => l.applicationId === app.id)) {
      throw new DomainError('Ce dossier a déjà été activé : le capital fictif ne peut pas être crédité deux fois.');
    }
    if (app.status !== 'accepted') throw new DomainError('Seule une demande acceptée dans la simulation peut être activée.');
    const product = requireProduct(state, app.productId);
    const account = requireActiveAccount(state, accountId ?? app.accountId);
    const rows = amortize({ principal: app.amount, rate: monthlyRate(app.annualRateBps), mode: app.repaymentMode, count: app.months });
    const schedule = buildInstallments(rows, app.startDate, 1, 1);
    const summary = summarize(rows);
    const loanId = ctx.id('loan');
    const reference = randomReference('PRT');
    const disbursement = buildTx(ctx, {
      type: 'loan_disbursement',
      accountId: account.id,
      amount: app.amount,
      label: `Prêt fictif ${reference}`,
      category: 'loan_credit',
      loanId,
      note: `Crédit simulé — ${product.name}. Fonds de démonstration uniquement.`,
    });
    const loan: Loan = {
      id: loanId,
      reference,
      applicationId: app.id,
      productId: product.id,
      label: product.name,
      principal: app.amount,
      initialAnnualRateBps: app.annualRateBps,
      annualRateBps: app.annualRateBps,
      months: app.months,
      repaymentMode: app.repaymentMode,
      startDate: app.startDate,
      accountId: account.id,
      status: 'active',
      createdAt: ctx.now,
      closedAt: null,
      schedule,
      payments: [],
      revisions: [],
      seq: 0,
      disbursementTxId: disbursement.id,
      cancellationTxId: null,
    };
    let next: BankState = { ...state, loans: [loan, ...state.loans] };
    next = replaceApp(next, { ...app, status: 'activated', loanId, accountId: account.id, updatedAt: ctx.now });
    next = withTx(next, disbursement);
    const ev = { loanId, applicationId: app.id } as const;
    next = withLoanEvent(next, ctx, { ...ev, kind: 'activation', amount: app.amount, status: 'Actif dans la simulation', description: `Prêt fictif ${reference} activé depuis le dossier ${app.reference}.` });
    next = withLoanEvent(next, ctx, { ...ev, kind: 'disbursement', amount: app.amount, status: 'Crédité', description: `Capital fictif de ${formatMoney(app.amount)} crédité sur « ${account.name} ».` });
    next = withLoanEvent(next, ctx, {
      ...ev,
      kind: 'schedule_generated',
      amount: summary.totalAmount,
      status: 'Échéancier',
      description: `${summary.count} échéances générées, première le ${schedule[0]?.dueDate}, intérêts théoriques ${formatMoney(summary.totalInterest)}.`,
    });
    next = withLog(next, ctx, 'success', 'Prêt fictif activé', `${reference} · ${formatMoney(app.amount)} crédités`);
    next = withNotification(next, ctx, {
      kind: 'loan_activated',
      title: 'Prêt fictif activé',
      body: `${formatMoney(app.amount)} de capital fictif crédités sur « ${account.name} ». Ce ne sont que des fonds de test.`,
      link: `/prets/${loanId}`,
    });
    return ok(next, loan, `Prêt ${reference} activé : ${formatMoney(app.amount)} fictifs crédités.`);
  });
}

// ───────────────────────────── Paiements ─────────────────────────────

interface PaymentSpec {
  kind: LoanPayment['kind'];
  accountId: string;
  principal: number;
  interest: number;
  fee: number;
  installmentIndex: number | null;
  schedule: Installment[];
  revision?: Omit<LoanRevision, 'id' | 'seq' | 'date' | 'reversed'>;
  label: string;
  eventDescription: string;
}

function applyPayment(state: BankState, ctx: Ctx, loan: Loan, spec: PaymentSpec): OpResult<LoanPayment> {
  const account = requireActiveAccount(state, spec.accountId);
  const loanAmount = spec.principal + spec.interest;
  if (loanAmount <= 0) throw new DomainError('Montant de remboursement invalide.');
  assertFunds(state, account.id, loanAmount + spec.fee, 'Solde de simulation');

  const seq = loan.seq + 1;
  const isPrepay = spec.kind === 'prepayment';
  const tx: Transaction = buildTx(ctx, {
    type: isPrepay ? 'loan_prepayment' : 'loan_repayment',
    accountId: account.id,
    amount: -loanAmount,
    label: spec.label,
    category: 'loan_repayment',
    loanId: loan.id,
    principalPart: spec.principal,
    interestPart: spec.interest,
  });
  const feeTx =
    spec.fee > 0
      ? buildTx(ctx, { type: 'loan_fee', accountId: account.id, amount: -spec.fee, label: `Frais de simulation · ${loan.reference}`, category: 'loan_repayment', loanId: loan.id })
      : null;
  const payment: LoanPayment = {
    id: ctx.id('pay'),
    seq,
    txId: tx.id,
    feeTxId: feeTx?.id ?? null,
    date: ctx.now,
    accountId: account.id,
    amount: loanAmount + spec.fee,
    principal: spec.principal,
    interest: spec.interest,
    fee: spec.fee,
    kind: spec.kind,
    installmentIndex: spec.installmentIndex,
    reversed: false,
    reversalTxId: null,
    scheduleBefore: loan.schedule,
    statusBefore: loan.status,
  };
  const closed = spec.schedule.every((i) => !isOpenInstallment(i));
  const status: LoanStatus = closed ? 'repaid' : 'partially_repaid';
  const revisions = spec.revision ? [...loan.revisions, { ...spec.revision, id: ctx.id('rev'), seq, date: ctx.now, reversed: false }] : loan.revisions;
  const updated: Loan = { ...loan, schedule: spec.schedule, payments: [...loan.payments, payment], revisions, seq, status, closedAt: closed ? ctx.now : null };

  // Invariant comptable : capital initial = capital remboursé + capital restant dû.
  const outstanding = updated.schedule.reduce((s, i) => s + (isOpenInstallment(i) ? i.principal - i.paidPrincipal : 0), 0);
  const repaid = updated.payments.reduce((s, p) => s + (p.reversed ? 0 : p.principal), 0);
  if (repaid + outstanding !== updated.principal) throw new Error(`Incohérence d'amortissement sur ${loan.reference}`);

  let next = replaceLoan(state, updated);
  next = feeTx ? withTx(next, tx, feeTx) : withTx(next, tx);
  const kindEvent = { installment: 'payment', partial: 'partial_payment', prepayment: 'prepayment', payoff: 'payoff' } as const;
  next = withLoanEvent(next, ctx, {
    loanId: loan.id,
    applicationId: loan.applicationId,
    kind: kindEvent[spec.kind],
    amount: payment.amount,
    status: 'Payé dans la simulation',
    description: `${spec.eventDescription} Capital ${formatMoney(spec.principal)}, intérêts ${formatMoney(spec.interest)}${spec.fee ? `, frais ${formatMoney(spec.fee)}` : ''}.`,
  });
  if (spec.revision) {
    next = withLoanEvent(next, ctx, { loanId: loan.id, applicationId: loan.applicationId, kind: 'revision', amount: null, status: 'Échéancier recalculé', description: spec.revision.description });
  }
  next = withLog(next, ctx, 'success', 'Remboursement fictif', `${loan.reference} · ${formatMoney(payment.amount)}`);
  next = checkBudgetAlert(next, ctx, 'loan_repayment');
  next = withNotification(next, ctx, {
    kind: 'loan_payment',
    title: 'Remboursement fictif effectué',
    body: `${formatMoney(payment.amount)} débités de « ${account.name} » pour le prêt ${loan.reference}.`,
    link: `/prets/${loan.id}`,
  });
  if (closed) {
    next = withLoanEvent(next, ctx, { loanId: loan.id, applicationId: loan.applicationId, kind: 'closure', amount: null, status: 'Remboursé intégralement', description: `Prêt fictif ${loan.reference} clôturé : capital restant dû nul.` });
    next = withNotification(next, ctx, { kind: 'loan_payment', title: 'Prêt fictif remboursé 🎉', body: `Le prêt ${loan.reference} est entièrement remboursé dans la simulation.`, link: `/prets/${loan.id}` });
  }
  return ok(next, payment, closed ? `Prêt ${loan.reference} entièrement remboursé.` : `Remboursement de ${formatMoney(payment.amount)} enregistré.`);
}

export function nextOpen(loan: Loan): Installment | undefined {
  return loan.schedule.find(isOpenInstallment);
}

function replaceInstallment(schedule: readonly Installment[], updated: Installment): Installment[] {
  return schedule.map((i) => (i.index === updated.index ? updated : i));
}

export function payInstallment(state: BankState, ctx: Ctx, loanId: string, accountId: string, installmentIndex?: number): OpResult<LoanPayment> {
  return guard(() => {
    const loan = requireActive(state, loanId);
    const next = nextOpen(loan);
    if (!next) throw new DomainError('Aucune échéance restante.');
    if (installmentIndex !== undefined && installmentIndex !== next.index) {
      const target = loan.schedule.find((i) => i.index === installmentIndex);
      if (!target) throw new DomainError('Échéance introuvable.');
      if (!isOpenInstallment(target)) throw new DomainError(`L’échéance n°${installmentIndex} est déjà réglée dans la simulation : paiement en double bloqué.`);
      throw new DomainError(`Réglez d’abord l’échéance n°${next.index} (les échéances se paient dans l’ordre).`);
    }
    const principal = next.principal - next.paidPrincipal;
    const interest = next.interest - next.paidInterest;
    const paid: Installment = { ...next, paidPrincipal: next.principal, paidInterest: next.interest, status: 'paid', paidAt: ctx.now };
    return applyPayment(state, ctx, loan, {
      kind: 'installment',
      accountId,
      principal,
      interest,
      fee: 0,
      installmentIndex: next.index,
      schedule: replaceInstallment(loan.schedule, paid),
      label: `Échéance ${next.index}/${loan.schedule.length} · ${loan.reference}`,
      eventDescription: `Échéance n°${next.index} payée.`,
    });
  });
}

export function payPartial(state: BankState, ctx: Ctx, loanId: string, accountId: string, amount: number): OpResult<LoanPayment> {
  return guard(() => {
    const loan = requireActive(state, loanId);
    const next = nextOpen(loan);
    if (!next) throw new DomainError('Aucune échéance restante.');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new DomainError('Le montant doit être positif.');
    const remInterest = next.interest - next.paidInterest;
    const remPrincipal = next.principal - next.paidPrincipal;
    const due = remInterest + remPrincipal;
    if (amount === due) return payInstallment(state, ctx, loanId, accountId, next.index);
    if (amount > due) {
      throw new DomainError(`Un paiement partiel doit être inférieur au reste de l’échéance (${formatMoney(due)}). Utilisez le remboursement anticipé pour aller au-delà.`);
    }
    // Imputation usuelle : intérêts d'abord, puis capital.
    const interest = Math.min(amount, remInterest);
    const principal = amount - interest;
    const updated: Installment = { ...next, paidInterest: next.paidInterest + interest, paidPrincipal: next.paidPrincipal + principal, status: 'partial' };
    return applyPayment(state, ctx, loan, {
      kind: 'partial',
      accountId,
      principal,
      interest,
      fee: 0,
      installmentIndex: next.index,
      schedule: replaceInstallment(loan.schedule, updated),
      label: `Paiement partiel échéance ${next.index} · ${loan.reference}`,
      eventDescription: `Paiement partiel de l’échéance n°${next.index} (reste ${formatMoney(due - amount)}).`,
    });
  });
}

export interface PayoffQuote {
  principal: number;
  interest: number;
  waivedInterest: number;
  fee: number;
  total: number;
  schedule: Installment[];
}

/**
 * Solde total : capital restant + intérêts des échéances déjà arrivées à terme
 * (ou entamées). Les intérêts des échéances futures ne sont pas dus.
 */
export function quotePayoff(loan: Loan, today: ISODate, feeBps: number, now: string): PayoffQuote {
  let principal = 0;
  let interest = 0;
  let waivedInterest = 0;
  let feeBase = 0;
  const schedule = loan.schedule.map((i): Installment => {
    if (!isOpenInstallment(i)) return i;
    const remP = i.principal - i.paidPrincipal;
    const remI = i.interest - i.paidInterest;
    principal += remP;
    if (i.status === 'partial' || i.dueDate <= today) {
      interest += remI;
      return { ...i, paidPrincipal: i.principal, paidInterest: i.interest, status: 'paid', paidAt: now };
    }
    waivedInterest += remI;
    feeBase += remP;
    return { ...i, paidPrincipal: i.principal, status: 'settled', paidAt: now };
  });
  const fee = roundHalfUp((feeBase * feeBps) / 10_000);
  return { principal, interest, waivedInterest, fee, total: principal + interest + fee, schedule };
}

export function payoffLoan(state: BankState, ctx: Ctx, loanId: string, accountId: string): OpResult<LoanPayment> {
  return guard(() => {
    const loan = requireActive(state, loanId);
    const q = quotePayoff(loan, ctx.today, state.settings.earlyRepaymentFeeBps, ctx.now);
    return applyPayment(state, ctx, loan, {
      kind: 'payoff',
      accountId,
      principal: q.principal,
      interest: q.interest,
      fee: q.fee,
      installmentIndex: null,
      schedule: q.schedule,
      label: `Remboursement total · ${loan.reference}`,
      eventDescription: `Remboursement total simulé${q.waivedInterest ? ` (intérêts futurs non dus : ${formatMoney(q.waivedInterest)})` : ''}.`,
    });
  });
}

export type PrepayStrategy = 'reduce_payment' | 'reduce_duration';

export interface PrepayQuote {
  isPayoff: boolean;
  amount: number;
  fee: number;
  total: number;
  outstandingBefore: number;
  outstandingAfter: number;
  interestSaved: number;
  before: ScenarioSnapshot;
  after: ScenarioSnapshot;
  schedule: Installment[];
}

/** Devis de remboursement anticipé partiel : même calcul pour l'aperçu et pour l'exécution. */
export function quotePrepayment(loan: Loan, amount: number, strategy: PrepayStrategy, today: ISODate, feeBps: number): PrepayQuote {
  if (!isActiveLoan(loan)) throw new DomainError('Ce prêt fictif n’est pas actif.');
  const blocker = recastBlocker(loan, today);
  if (blocker) throw new DomainError(blocker);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new DomainError('Le montant doit être positif.');
  const open = loan.schedule.filter(isOpenInstallment);
  const first = open[0];
  if (!first) throw new DomainError('Aucune échéance restante.');
  const outstanding = open.reduce((s, i) => s + i.principal, 0);
  if (amount > outstanding) throw new DomainError(`Le remboursement anticipé ne peut pas dépasser le capital restant dû (${formatMoney(outstanding)}).`);
  const before = snapshotSchedule(loan.schedule, loan.annualRateBps);
  const fee = roundHalfUp((amount * feeBps) / 10_000);
  if (amount === outstanding) {
    const q = quotePayoff(loan, today, feeBps, '');
    return {
      isPayoff: true,
      amount,
      fee: q.fee,
      total: q.total,
      outstandingBefore: outstanding,
      outstandingAfter: 0,
      interestSaved: q.waivedInterest,
      before,
      after: { annualRateBps: loan.annualRateBps, remainingCount: 0, nextPayment: 0, remainingInterest: 0, lastDueDate: null },
      schedule: q.schedule,
    };
  }
  const remaining = outstanding - amount;
  const rate = monthlyRate(loan.annualRateBps);
  let rows: AmortizationRow[];
  if (strategy === 'reduce_payment') rows = amortize({ principal: remaining, rate, mode: loan.repaymentMode, count: open.length });
  else if (loan.repaymentMode === 'annuity') rows = amortize({ principal: remaining, rate, mode: 'annuity', fixedPayment: first.amount });
  else rows = amortize({ principal: remaining, rate, mode: 'constant_principal', fixedPrincipal: first.principal });
  const regenerated = buildInstallments(rows, loan.startDate, first.index, first.monthOffset);
  const schedule = [...loan.schedule.filter((i) => !isOpenInstallment(i)), ...regenerated];
  const after = snapshotSchedule(schedule, loan.annualRateBps);
  return {
    isPayoff: false,
    amount,
    fee,
    total: amount + fee,
    outstandingBefore: outstanding,
    outstandingAfter: remaining,
    interestSaved: before.remainingInterest - after.remainingInterest,
    before,
    after,
    schedule,
  };
}

export function prepayLoan(state: BankState, ctx: Ctx, loanId: string, accountId: string, amount: number, strategy: PrepayStrategy): OpResult<LoanPayment> {
  return guard(() => {
    const loan = requireActive(state, loanId);
    const q = quotePrepayment(loan, amount, strategy, ctx.today, state.settings.earlyRepaymentFeeBps);
    if (q.isPayoff) return payoffLoan(state, ctx, loanId, accountId);
    const strategyLabel = strategy === 'reduce_payment' ? 'mensualité réduite' : 'durée réduite';
    return applyPayment(state, ctx, loan, {
      kind: 'prepayment',
      accountId,
      principal: amount,
      interest: 0,
      fee: q.fee,
      installmentIndex: null,
      schedule: q.schedule,
      label: `Remboursement anticipé · ${loan.reference}`,
      eventDescription: `Remboursement anticipé partiel (${strategyLabel}).`,
      revision: {
        kind: 'prepayment_recast',
        description: `Échéancier recalculé après remboursement anticipé de ${formatMoney(amount)} (${strategyLabel}) : ${q.before.remainingCount} → ${q.after.remainingCount} échéances, mensualité ${formatMoney(q.before.nextPayment)} → ${formatMoney(q.after.nextPayment)}, intérêts théoriques économisés ${formatMoney(q.interestSaved)}.`,
        before: q.before,
        after: q.after,
      },
    });
  });
}

/** Seule la dernière opération non contrepassée d'un prêt peut être contrepassée (pile LIFO). */
export function lastReversiblePaymentId(loan: Loan): string | null {
  if (loan.status === 'cancelled') return null;
  let maxSeq = 0;
  for (const p of loan.payments) if (!p.reversed) maxSeq = Math.max(maxSeq, p.seq);
  for (const r of loan.revisions) if (!r.reversed) maxSeq = Math.max(maxSeq, r.seq);
  const p = loan.payments.find((x) => !x.reversed && x.seq === maxSeq);
  return p ? p.id : null;
}

export function reversePayment(state: BankState, ctx: Ctx, loanId: string, paymentId: string, reason?: string): OpResult {
  return guard(() => {
    const loan = requireLoan(state, loanId);
    const payment = loan.payments.find((p) => p.id === paymentId);
    if (!payment) throw new DomainError('Paiement introuvable.');
    if (payment.reversed) throw new DomainError('Ce paiement est déjà contrepassé.');
    if (lastReversiblePaymentId(loan) !== payment.id) {
      throw new DomainError('Seule la dernière opération du prêt peut être contrepassée (une révision ou un paiement plus récent existe).');
    }
    const account = requireActiveAccount(state, payment.accountId);
    const note = reason ? sanitizeText(reason, 280) : 'Correction de simulation';
    const reversals: Transaction[] = [];
    const reversedIds = new Map<string, string>();
    for (const txId of [payment.txId, payment.feeTxId]) {
      if (!txId) continue;
      const orig = state.transactions.find((t) => t.id === txId);
      if (!orig) throw new DomainError('Transaction d’origine introuvable.');
      const r = buildTx(ctx, {
        type: 'reversal',
        origType: orig.type,
        accountId: orig.accountId,
        amount: -orig.amount,
        label: `Contrepassation · ${orig.label}`.slice(0, 120),
        category: orig.category,
        loanId: loan.id,
        reversalOf: orig.id,
        principalPart: orig.principalPart,
        interestPart: orig.interestPart,
        note,
      });
      reversals.push(r);
      reversedIds.set(orig.id, r.id);
    }
    const updated: Loan = {
      ...loan,
      schedule: payment.scheduleBefore,
      status: payment.statusBefore,
      closedAt: null,
      payments: loan.payments.map((p) => (p.id === payment.id ? { ...p, reversed: true, reversalTxId: reversals[0]?.id ?? null } : p)),
      revisions: loan.revisions.map((r) => (r.seq === payment.seq ? { ...r, reversed: true } : r)),
    };
    let next = replaceLoan(state, updated);
    next = { ...next, transactions: next.transactions.map((t) => (reversedIds.has(t.id) ? { ...t, reversedBy: reversedIds.get(t.id) ?? null } : t)) };
    next = withTx(next, ...reversals);
    next = withLoanEvent(next, ctx, {
      loanId: loan.id,
      applicationId: loan.applicationId,
      kind: 'reversal',
      amount: payment.amount,
      status: 'Contrepassé',
      description: `Contrepassation du paiement du ${payment.date.slice(0, 10)} (${formatMoney(payment.amount)}) recrédité sur « ${account.name} ». ${note}`,
    });
    next = withLog(next, ctx, 'warning', 'Paiement de prêt contrepassé', `${loan.reference} · ${formatMoney(payment.amount)}`);
    return ok(next, undefined, 'Paiement contrepassé : échéancier restauré.');
  });
}

// ───────────────────────────── Révisions ─────────────────────────────

export interface ReviseQuote {
  before: ScenarioSnapshot;
  after: ScenarioSnapshot;
  schedule: Installment[];
  kind: LoanRevision['kind'];
}

export function quoteRevision(loan: Loan, today: ISODate, annualRateBps: number, remainingMonths: number): ReviseQuote {
  if (!isActiveLoan(loan)) throw new DomainError('Ce prêt fictif n’est pas actif.');
  const blocker = recastBlocker(loan, today);
  if (blocker) throw new DomainError(blocker);
  if (!Number.isInteger(annualRateBps) || annualRateBps < 0 || annualRateBps > 5000) throw new DomainError('Taux fictif invalide (0 à 50 %).');
  if (!Number.isInteger(remainingMonths) || remainingMonths < 1 || remainingMonths > 360) throw new DomainError('Durée restante invalide (1 à 360 mois).');
  const open = loan.schedule.filter(isOpenInstallment);
  const first = open[0];
  if (!first) throw new DomainError('Aucune échéance restante.');
  const rateChanged = annualRateBps !== loan.annualRateBps;
  const durationChanged = remainingMonths !== open.length;
  if (!rateChanged && !durationChanged) throw new DomainError('Aucune hypothèse modifiée.');
  const outstanding = open.reduce((s, i) => s + i.principal, 0);
  if (outstanding < remainingMonths * 100) throw new DomainError('Durée trop longue pour le capital restant (1,00 minimum par mensualité).');
  const rows = amortize({ principal: outstanding, rate: monthlyRate(annualRateBps), mode: loan.repaymentMode, count: remainingMonths });
  const schedule = [...loan.schedule.filter((i) => !isOpenInstallment(i)), ...buildInstallments(rows, loan.startDate, first.index, first.monthOffset)];
  return {
    before: snapshotSchedule(loan.schedule, loan.annualRateBps),
    after: snapshotSchedule(schedule, annualRateBps),
    schedule,
    kind: rateChanged && durationChanged ? 'rate_duration' : rateChanged ? 'rate' : 'duration',
  };
}

/** Modifie les hypothèses pour les seules échéances futures ; les paiements passés restent intacts. */
export function reviseLoan(state: BankState, ctx: Ctx, loanId: string, annualRateBps: number, remainingMonths: number): OpResult<Loan> {
  return guard(() => {
    const loan = requireActive(state, loanId);
    const q = quoteRevision(loan, ctx.today, annualRateBps, remainingMonths);
    const seq = loan.seq + 1;
    const description = `Hypothèses modifiées : taux ${formatRate(q.before.annualRateBps)} → ${formatRate(q.after.annualRateBps)}, ${q.before.remainingCount} → ${q.after.remainingCount} échéances restantes, mensualité ${formatMoney(q.before.nextPayment)} → ${formatMoney(q.after.nextPayment)}, intérêts restants ${formatMoney(q.before.remainingInterest)} → ${formatMoney(q.after.remainingInterest)}.`;
    const revision: LoanRevision = { id: ctx.id('rev'), seq, date: ctx.now, kind: q.kind, description, before: q.before, after: q.after, reversed: false };
    const updated: Loan = { ...loan, schedule: q.schedule, annualRateBps, seq, revisions: [...loan.revisions, revision] };
    let next = replaceLoan(state, updated);
    next = withLoanEvent(next, ctx, { loanId, applicationId: loan.applicationId, kind: 'revision', amount: null, status: 'Scénario modifié', description });
    next = withLog(next, ctx, 'info', 'Hypothèses de prêt modifiées', loan.reference);
    return ok(next, updated, 'Hypothèses mises à jour : nouvel échéancier généré.');
  });
}

/**
 * Report d'une échéance d'un mois (option de démonstration). Simplification
 * assumée et affichée : aucun intérêt supplémentaire n'est calculé pour le mois reporté.
 */
export function deferInstallment(state: BankState, ctx: Ctx, loanId: string): OpResult<Loan> {
  return guard(() => {
    if (!state.settings.allowDeferral) throw new DomainError('Le report d’échéance est désactivé dans les paramètres de démonstration.');
    const loan = requireActive(state, loanId);
    const target = nextOpen(loan);
    if (!target) throw new DomainError('Aucune échéance restante.');
    if (target.status === 'partial') throw new DomainError('Une échéance partiellement payée ne peut pas être reportée.');
    if (target.deferred) throw new DomainError('Cette échéance a déjà été reportée une fois.');
    if (loan.revisions.filter((r) => r.kind === 'deferral' && !r.reversed).length >= MAX_DEFERRALS_PER_LOAN) {
      throw new DomainError(`Maximum ${MAX_DEFERRALS_PER_LOAN} reports par prêt dans la simulation.`);
    }
    const before = snapshotSchedule(loan.schedule, loan.annualRateBps);
    const schedule = loan.schedule.map((i): Installment => {
      if (!isOpenInstallment(i)) return i;
      const monthOffset = i.monthOffset + 1;
      return { ...i, monthOffset, dueDate: addMonths(loan.startDate, monthOffset), deferred: i.index === target.index ? true : i.deferred };
    });
    const after = snapshotSchedule(schedule, loan.annualRateBps);
    const seq = loan.seq + 1;
    const newDue = schedule.find((i) => i.index === target.index)?.dueDate ?? '';
    const description = `Échéance n°${target.index} reportée du ${target.dueDate} au ${newDue} ; échéances suivantes décalées d’un mois, sans intérêt supplémentaire (simplification de démonstration).`;
    const updated: Loan = {
      ...loan,
      schedule,
      seq,
      revisions: [...loan.revisions, { id: ctx.id('rev'), seq, date: ctx.now, kind: 'deferral', description, before, after, reversed: false }],
    };
    let next = replaceLoan(state, updated);
    next = withLoanEvent(next, ctx, { loanId, applicationId: loan.applicationId, kind: 'deferral', amount: null, status: 'Reportée dans la simulation', description });
    next = withLog(next, ctx, 'info', 'Échéance reportée', `${loan.reference} · n°${target.index}`);
    return ok(next, updated, `Échéance n°${target.index} reportée au ${newDue}.`);
  });
}

export function cancelLoanBlocker(state: BankState, loan: Loan): string | null {
  if (loan.status === 'cancelled') return 'Prêt déjà annulé.';
  if (loan.status === 'repaid') return 'Un prêt entièrement remboursé ne peut plus être annulé.';
  if (loan.payments.some((p) => !p.reversed)) return 'Des remboursements ont été enregistrés : contrepassez-les d’abord.';
  const account = state.accounts.find((a) => a.id === loan.accountId);
  if (!account || account.archived) return 'Le compte de versement n’est plus actif.';
  const balance = accountBalance(state, loan.accountId);
  if (balance < loan.principal) return `Le compte doit restituer le capital fictif (${formatMoney(loan.principal)}) ; solde actuel ${formatMoney(balance)}.`;
  return null;
}

/** Annulation : le capital fictif est restitué par contrepassation du versement. */
export function cancelLoan(state: BankState, ctx: Ctx, loanId: string): OpResult<Loan> {
  return guard(() => {
    const loan = requireLoan(state, loanId);
    const blocker = cancelLoanBlocker(state, loan);
    if (blocker) throw new DomainError(blocker);
    const disb = state.transactions.find((t) => t.id === loan.disbursementTxId);
    if (!disb) throw new DomainError('Versement d’origine introuvable.');
    const reversal = buildTx(ctx, {
      type: 'reversal',
      origType: 'loan_disbursement',
      accountId: disb.accountId,
      amount: -disb.amount,
      label: `Annulation · Prêt fictif ${loan.reference}`,
      category: 'loan_credit',
      loanId: loan.id,
      reversalOf: disb.id,
      note: 'Annulation du scénario de prêt par l’utilisateur',
    });
    const updated: Loan = { ...loan, status: 'cancelled', closedAt: ctx.now, cancellationTxId: reversal.id };
    let next = replaceLoan(state, updated);
    next = { ...next, transactions: next.transactions.map((t) => (t.id === disb.id ? { ...t, reversedBy: reversal.id } : t)) };
    next = withTx(next, reversal);
    next = withLoanEvent(next, ctx, {
      loanId,
      applicationId: loan.applicationId,
      kind: 'cancellation',
      amount: loan.principal,
      status: 'Annulé',
      description: `Scénario annulé : ${formatMoney(loan.principal)} de capital fictif restitués.`,
    });
    next = withLog(next, ctx, 'warning', 'Prêt fictif annulé', loan.reference);
    return ok(next, updated, `Prêt ${loan.reference} annulé.`);
  });
}

// ───────────────────────────── Rappels ─────────────────────────────

/** Rappels d'échéance (J-7) et retards selon l'horloge de simulation, dédupliqués. */
export function syncLoanReminders(state: BankState, ctx: Ctx): BankState {
  if (!state.settings.notifications) return state;
  let next = state;
  const horizon = addDays(ctx.today, 7);
  for (const loan of state.loans) {
    if (!isActiveLoan(loan)) continue;
    const inst = nextOpen(loan);
    if (!inst) continue;
    const remaining = inst.amount - inst.paidInterest - inst.paidPrincipal;
    if (inst.dueDate < ctx.today) {
      next = withNotification(next, ctx, {
        kind: 'loan_due',
        title: 'Échéance en retard dans la simulation',
        body: `Échéance n°${inst.index} du prêt ${loan.reference} (${formatMoney(remaining)}) prévue le ${inst.dueDate}.`,
        link: `/prets/${loan.id}`,
        dedupeKey: `late:${loan.id}:${inst.index}:${inst.dueDate}`,
      });
    } else if (inst.dueDate <= horizon) {
      next = withNotification(next, ctx, {
        kind: 'loan_due',
        title: 'Échéance de remboursement à venir',
        body: `Échéance n°${inst.index} du prêt ${loan.reference} : ${formatMoney(remaining)} le ${inst.dueDate}.`,
        link: `/prets/${loan.id}`,
        dedupeKey: `due:${loan.id}:${inst.index}:${inst.dueDate}`,
      });
    }
  }
  return next;
}

export { fail };
