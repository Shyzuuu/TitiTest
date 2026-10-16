/**
 * Opérations sur les comptes : dépôts et retraits de test, dépenses simulées,
 * virements internes, échanges avec les contacts fictifs et contrepassations.
 * Toutes les fonctions sont pures : (état, contexte, entrée) → résultat.
 */
import { getCategory, isKnownCategory } from './categories';
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
  withNotification,
  withTx,
  type Ctx,
  type OpResult,
} from './core';
import { monthKey } from './dates';
import { formatMoney, MAX_OPERATION_CENTS } from './money';
import type { Account, AccountKind, BankState, Transaction } from './schema';
import { makeDemoId } from './cards';
import { cardMonthSpent, categorySpent } from './selectors';

function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new DomainError('Le montant doit être un nombre positif.');
  if (amount > MAX_OPERATION_CENTS) throw new DomainError(`Montant maximum par opération : ${formatMoney(MAX_OPERATION_CENTS)}.`);
}

function assertFunds(state: BankState, accountId: string, amount: number, label = 'Solde'): void {
  const balance = accountBalance(state, accountId);
  if (balance < amount) {
    throw new DomainError(`${label} insuffisant : ${formatMoney(balance)} disponibles pour ${formatMoney(amount)} demandés.`);
  }
}

/** Émet l'alerte budgétaire une seule fois par mois et par catégorie. */
export function checkBudgetAlert(state: BankState, ctx: Ctx, category: string): BankState {
  const month = monthKey(ctx.now);
  const budget = state.budgets.find((b) => b.category === category);
  if (!budget || budget.alertedMonths.includes(month)) return state;
  const spent = categorySpent(state, category, month);
  if (spent <= budget.limit) return state;
  const label = getCategory(category, state.customCategories).label;
  const next = {
    ...state,
    budgets: state.budgets.map((b) => (b.id === budget.id ? { ...b, alertedMonths: [...b.alertedMonths, month].slice(-24) } : b)),
  };
  return withNotification(next, ctx, {
    kind: 'budget',
    title: `Budget « ${label} » dépassé`,
    body: `${formatMoney(spent)} dépensés pour un budget fictif de ${formatMoney(budget.limit)} ce mois-ci.`,
    link: '/budgets',
  });
}

export interface CreateAccountInput {
  name: string;
  kind: AccountKind;
  color: string;
  icon: string;
}

export function createAccount(state: BankState, ctx: Ctx, input: CreateAccountInput): OpResult<Account> {
  return guard(() => {
    const name = sanitizeText(input.name, 40);
    if (!name) throw new DomainError('Donnez un nom au compte.');
    if (state.accounts.some((a) => !a.archived && a.name.toLowerCase() === name.toLowerCase())) {
      throw new DomainError('Un compte porte déjà ce nom.');
    }
    if (state.accounts.filter((a) => !a.archived).length >= 12) throw new DomainError('Maximum 12 comptes actifs.');
    const account: Account = { id: ctx.id('acc'), name, kind: input.kind, color: input.color, icon: input.icon, createdAt: ctx.now, archived: false };
    let next: BankState = { ...state, accounts: [...state.accounts, account] };
    next = withLog(next, ctx, 'success', 'Compte créé', name);
    return ok(next, account, `Compte « ${name} » créé.`);
  });
}

export function updateAccount(state: BankState, ctx: Ctx, accountId: string, patch: Partial<CreateAccountInput>): OpResult {
  return guard(() => {
    const account = requireActiveAccount(state, accountId);
    const name = patch.name !== undefined ? sanitizeText(patch.name, 40) : account.name;
    if (!name) throw new DomainError('Donnez un nom au compte.');
    if (state.accounts.some((a) => a.id !== accountId && !a.archived && a.name.toLowerCase() === name.toLowerCase())) {
      throw new DomainError('Un compte porte déjà ce nom.');
    }
    const updated: Account = { ...account, ...patch, name };
    let next: BankState = { ...state, accounts: state.accounts.map((a) => (a.id === accountId ? updated : a)) };
    next = withLog(next, ctx, 'info', 'Compte modifié', name);
    return ok(next, undefined, 'Compte mis à jour.');
  });
}

/** Archive un compte vide, sans carte active ni prêt actif rattaché : l'historique est conservé. */
export function archiveAccount(state: BankState, ctx: Ctx, accountId: string): OpResult {
  return guard(() => {
    const account = requireActiveAccount(state, accountId);
    if (state.accounts.filter((a) => !a.archived).length <= 1) throw new DomainError('Il faut conserver au moins un compte.');
    const balance = accountBalance(state, accountId);
    if (balance !== 0) throw new DomainError(`Le compte doit être vide pour être archivé (solde : ${formatMoney(balance)}).`);
    if (state.cards.some((c) => c.accountId === accountId && !c.deletedAt)) throw new DomainError('Des cartes sont rattachées à ce compte.');
    if (state.loans.some((l) => l.accountId === accountId && (l.status === 'active' || l.status === 'partially_repaid'))) {
      throw new DomainError('Un prêt fictif actif est rattaché à ce compte.');
    }
    let next: BankState = { ...state, accounts: state.accounts.map((a) => (a.id === accountId ? { ...a, archived: true } : a)) };
    next = withLog(next, ctx, 'info', 'Compte archivé', account.name);
    return ok(next, undefined, 'Compte archivé.');
  });
}

export interface DepositInput {
  accountId: string;
  amount: number;
  label?: string;
  category?: string;
  note?: string;
}

export function deposit(state: BankState, ctx: Ctx, input: DepositInput): OpResult<Transaction> {
  return guard(() => {
    assertAmount(input.amount);
    const account = requireActiveAccount(state, input.accountId);
    const category = input.category && isKnownCategory(input.category, state.customCategories) ? input.category : 'income';
    const tx = buildTx(ctx, {
      type: 'deposit',
      accountId: account.id,
      amount: input.amount,
      label: sanitizeText(input.label || 'Ajout de fonds de test', 120),
      category,
      note: input.note ? sanitizeText(input.note, 280) : null,
    });
    let next = withTx(state, tx);
    next = withLog(next, ctx, 'success', 'Fonds de test créés', `${formatMoney(input.amount)} sur ${account.name}`);
    next = withNotification(next, ctx, {
      kind: 'transaction',
      title: 'Fonds de test ajoutés',
      body: `${formatMoney(input.amount)} ajoutés sur « ${account.name} » (création de fonds fictifs).`,
      link: `/historique?tx=${tx.id}`,
    });
    return ok(next, tx, `${formatMoney(input.amount)} fictifs ajoutés.`);
  });
}

export function withdraw(state: BankState, ctx: Ctx, input: DepositInput): OpResult<Transaction> {
  return guard(() => {
    assertAmount(input.amount);
    const account = requireActiveAccount(state, input.accountId);
    assertFunds(state, account.id, input.amount);
    const tx = buildTx(ctx, {
      type: 'withdrawal',
      accountId: account.id,
      amount: -input.amount,
      label: sanitizeText(input.label || 'Retrait de test', 120),
      category: 'cash',
      note: input.note ? sanitizeText(input.note, 280) : null,
    });
    let next = withTx(state, tx);
    next = withLog(next, ctx, 'success', 'Retrait de test', `${formatMoney(input.amount)} depuis ${account.name}`);
    next = checkBudgetAlert(next, ctx, 'cash');
    next = withNotification(next, ctx, {
      kind: 'transaction',
      title: 'Retrait de test enregistré',
      body: `${formatMoney(input.amount)} retirés de « ${account.name} ».`,
      link: `/historique?tx=${tx.id}`,
    });
    return ok(next, tx, `Retrait de ${formatMoney(input.amount)} enregistré.`);
  });
}

export interface ExpenseInput {
  accountId: string;
  cardId?: string | null;
  amount: number;
  merchant: string;
  category: string;
  note?: string;
}

/**
 * Dépense simulée. Un refus lié à la carte (verrouillée, plafond) est tracé comme
 * transaction « refusée » sans impact sur le solde, comme dans une vraie application.
 */
export function recordExpense(state: BankState, ctx: Ctx, input: ExpenseInput): OpResult<Transaction> {
  return guard(() => {
    assertAmount(input.amount);
    const merchant = sanitizeText(input.merchant, 80);
    if (!merchant) throw new DomainError('Indiquez le commerçant ou le libellé.');
    const category = isKnownCategory(input.category, state.customCategories) ? input.category : 'other';
    let accountId = input.accountId;
    const card = input.cardId ? state.cards.find((c) => c.id === input.cardId && !c.deletedAt) : undefined;
    if (input.cardId && !card) throw new DomainError('Carte introuvable.');
    if (card) accountId = card.accountId;
    const account = requireActiveAccount(state, accountId);

    let declineReason: string | null = null;
    if (card?.locked) declineReason = `Carte « ${card.name} » verrouillée : paiement simulé bloqué.`;
    else if (card?.monthlyLimit) {
      const spent = cardMonthSpent(state, card.id, monthKey(ctx.now));
      if (spent + input.amount > card.monthlyLimit) {
        declineReason = `Plafond mensuel de test dépassé (${formatMoney(spent)} / ${formatMoney(card.monthlyLimit)}).`;
      }
    }
    if (!declineReason && accountBalance(state, account.id) < input.amount) {
      declineReason = `Solde insuffisant sur « ${account.name} ».`;
    }

    const base = {
      type: 'expense' as const,
      accountId: account.id,
      label: merchant,
      category,
      cardId: card?.id ?? null,
      note: input.note ? sanitizeText(input.note, 280) : null,
    };
    if (declineReason) {
      const declined = buildTx(ctx, { ...base, amount: -input.amount, status: 'declined', declineReason });
      let next = withTx(state, declined);
      next = withLog(next, ctx, 'warning', 'Dépense refusée', declineReason);
      if (card?.locked) {
        next = withNotification(next, ctx, {
          kind: 'card',
          title: 'Paiement bloqué',
          body: `Tentative de ${formatMoney(input.amount)} chez ${merchant} bloquée : carte verrouillée.`,
          link: '/cartes',
        });
      }
      return fail(declineReason, next);
    }
    const tx = buildTx(ctx, { ...base, amount: -input.amount });
    let next = withTx(state, tx);
    next = withLog(next, ctx, 'success', 'Dépense simulée', `${merchant} · ${formatMoney(input.amount)}`);
    if (card?.kind === 'disposable') {
      // Carte jetable : l'identifiant utilisé n'est plus valable après le paiement simulé.
      next = { ...next, cards: next.cards.map((c) => (c.id === card.id ? { ...c, demoId: makeDemoId(), regenerations: c.regenerations + 1 } : c)) };
    }
    next = checkBudgetAlert(next, ctx, category);
    next = withNotification(next, ctx, {
      kind: 'transaction',
      title: 'Dépense simulée',
      body: `${formatMoney(input.amount)} chez ${merchant}${card ? ` avec la carte « ${card.name} »` : ''}.`,
      link: `/historique?tx=${tx.id}`,
    });
    return ok(next, tx, `Dépense de ${formatMoney(input.amount)} enregistrée.`);
  });
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
}

/** Virement interne : deux écritures liées de même montant, aucune création de fonds. */
export function transferInternal(state: BankState, ctx: Ctx, input: TransferInput): OpResult<Transaction[]> {
  return guard(() => {
    assertAmount(input.amount);
    if (input.fromAccountId === input.toAccountId) throw new DomainError('Choisissez deux comptes différents.');
    const from = requireActiveAccount(state, input.fromAccountId);
    const to = requireActiveAccount(state, input.toAccountId);
    assertFunds(state, from.id, input.amount);
    const groupId = ctx.id('grp');
    const note = input.note ? sanitizeText(input.note, 280) : null;
    const out = buildTx(ctx, { type: 'transfer_out', accountId: from.id, amount: -input.amount, label: `Vers ${to.name}`, category: 'internal', groupId, note });
    const inn = buildTx(ctx, { type: 'transfer_in', accountId: to.id, amount: input.amount, label: `Depuis ${from.name}`, category: 'internal', groupId, note });
    let next = withTx(state, out, inn);
    next = withLog(next, ctx, 'success', 'Virement interne', `${formatMoney(input.amount)} : ${from.name} → ${to.name}`);
    return ok(next, [out, inn], `${formatMoney(input.amount)} transférés vers « ${to.name} ».`);
  });
}

export interface P2PInput {
  accountId: string;
  contactId: string;
  amount: number;
  message?: string;
  category?: string;
}

export function sendToContact(state: BankState, ctx: Ctx, input: P2PInput): OpResult<Transaction> {
  return guard(() => {
    assertAmount(input.amount);
    const contact = state.contacts.find((c) => c.id === input.contactId && !c.archived);
    if (!contact) throw new DomainError('Contact fictif introuvable.');
    const account = requireActiveAccount(state, input.accountId);
    assertFunds(state, account.id, input.amount);
    const category = input.category && isKnownCategory(input.category, state.customCategories) ? input.category : 'transfer';
    const tx = buildTx(ctx, {
      type: 'p2p_out',
      accountId: account.id,
      amount: -input.amount,
      label: `Envoi à ${contact.name}`,
      category,
      contactId: contact.id,
      note: input.message ? sanitizeText(input.message, 280) : null,
    });
    let next = withTx(state, tx);
    next = withLog(next, ctx, 'success', 'Envoi fictif', `${formatMoney(input.amount)} à ${contact.name}`);
    next = checkBudgetAlert(next, ctx, category);
    next = withNotification(next, ctx, {
      kind: 'transaction',
      title: 'Argent fictif envoyé',
      body: `${formatMoney(input.amount)} envoyés à ${contact.name}.`,
      link: `/historique?tx=${tx.id}`,
    });
    return ok(next, tx, `${formatMoney(input.amount)} envoyés à ${contact.name}.`);
  });
}

export function receiveFromContact(state: BankState, ctx: Ctx, input: P2PInput): OpResult<Transaction> {
  return guard(() => {
    assertAmount(input.amount);
    const contact = state.contacts.find((c) => c.id === input.contactId && !c.archived);
    if (!contact) throw new DomainError('Contact fictif introuvable.');
    const account = requireActiveAccount(state, input.accountId);
    const tx = buildTx(ctx, {
      type: 'p2p_in',
      accountId: account.id,
      amount: input.amount,
      label: `Reçu de ${contact.name}`,
      category: 'income',
      contactId: contact.id,
      note: input.message ? sanitizeText(input.message, 280) : null,
    });
    let next = withTx(state, tx);
    next = withLog(next, ctx, 'success', 'Réception fictive', `${formatMoney(input.amount)} de ${contact.name}`);
    next = withNotification(next, ctx, {
      kind: 'transaction',
      title: 'Argent fictif reçu',
      body: `${contact.name} vous a envoyé ${formatMoney(input.amount)} (simulation).`,
      link: `/historique?tx=${tx.id}`,
    });
    return ok(next, tx, `${formatMoney(input.amount)} reçus de ${contact.name}.`);
  });
}

const REVERSIBLE = new Set(['deposit', 'withdrawal', 'expense', 'p2p_in', 'p2p_out', 'transfer_in', 'transfer_out']);

export function canReverse(state: BankState, tx: Transaction): { ok: boolean; reason?: string } {
  if (tx.status !== 'completed') return { ok: false, reason: 'Une opération refusée n’a aucun impact à corriger.' };
  if (tx.type === 'reversal') return { ok: false, reason: 'Une contrepassation ne peut pas elle-même être contrepassée.' };
  if (tx.reversedBy) return { ok: false, reason: 'Opération déjà contrepassée.' };
  if (!REVERSIBLE.has(tx.type)) {
    return { ok: false, reason: tx.loanId ? 'Les opérations de prêt se corrigent depuis la fiche du prêt.' : 'Utilisez le coffre pour déplacer à nouveau ces fonds.' };
  }
  if (state.accounts.find((a) => a.id === tx.accountId)?.archived) return { ok: false, reason: 'Le compte concerné est archivé.' };
  return { ok: true };
}

/**
 * Contrepassation : l'opération initiale est conservée et marquée, une écriture
 * de sens opposé y est liée. Un virement interne est contrepassé sur ses deux jambes.
 */
export function reverseTransaction(state: BankState, ctx: Ctx, txId: string, reason?: string): OpResult<Transaction[]> {
  return guard(() => {
    const tx = state.transactions.find((t) => t.id === txId);
    if (!tx) throw new DomainError('Opération introuvable.');
    const check = canReverse(state, tx);
    if (!check.ok) throw new DomainError(check.reason ?? 'Contrepassation impossible.');
    const legs = tx.groupId ? state.transactions.filter((t) => t.groupId === tx.groupId && t.type !== 'reversal') : [tx];
    for (const leg of legs) {
      const c = canReverse(state, leg);
      if (!c.ok) throw new DomainError(c.reason ?? 'Contrepassation impossible.');
      // Annuler un crédit retire des fonds : le compte doit pouvoir les restituer.
      if (leg.amount > 0) assertFunds(state, leg.accountId, leg.amount, 'Solde');
    }
    const note = reason ? sanitizeText(reason, 280) : 'Correction de simulation';
    const reversals = legs.map((leg) =>
      buildTx(ctx, {
        type: 'reversal',
        origType: leg.type,
        accountId: leg.accountId,
        amount: -leg.amount,
        label: `Contrepassation · ${leg.label}`.slice(0, 120),
        category: leg.category,
        cardId: leg.cardId,
        contactId: leg.contactId,
        groupId: leg.groupId,
        reversalOf: leg.id,
        note,
      }),
    );
    const byOrig = new Map(reversals.map((r) => [r.reversalOf, r.id]));
    let next: BankState = {
      ...state,
      transactions: state.transactions.map((t) => (byOrig.has(t.id) ? { ...t, reversedBy: byOrig.get(t.id) ?? null } : t)),
    };
    next = withTx(next, ...reversals);
    next = withLog(next, ctx, 'warning', 'Contrepassation', `${tx.label} · ${formatMoney(Math.abs(tx.amount))}`);
    return ok(next, reversals, 'Opération contrepassée.');
  });
}

export { assertAmount, assertFunds };
