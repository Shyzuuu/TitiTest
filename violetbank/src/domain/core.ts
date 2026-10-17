/**
 * Primitives partagées par les opérations : contexte d'horloge, résultats,
 * journalisation, notifications et calcul des soldes dérivés du grand livre.
 */
import { datePart, toISODate, toLocalDateTime, type ISODate, type LocalDateTime } from './dates';
import { randomId } from './ids';
import type {
  AppNotification,
  BankState,
  LoanEvent,
  NotificationKind,
  SimLogEntry,
  Transaction,
  TxType,
} from './schema';

export interface Ctx {
  /** Horodatage simulé (horloge murale locale). */
  now: LocalDateTime;
  /** Date simulée du jour. */
  today: ISODate;
  /** Horodatage réel, pour l'audit. */
  realNow: string;
  id: (prefix: string) => string;
}

/** Contexte d'horloge : date de simulation imposée ou date réelle, heure réelle. */
export function makeCtx(simulationDate: ISODate | null, real: Date = new Date()): Ctx {
  const realLocal = toLocalDateTime(real);
  const today = simulationDate ?? toISODate(real);
  return {
    now: `${today}${realLocal.slice(10)}`,
    today,
    realNow: real.toISOString(),
    id: randomId,
  };
}

export type OpResult<T = undefined> =
  | { ok: true; state: BankState; data: T; message?: string }
  | { ok: false; error: string; state?: BankState };

export class DomainError extends Error {}

export function ok<T>(state: BankState, data: T, message?: string): OpResult<T> {
  return { ok: true, state, data, message };
}

export function fail<T = never>(error: string, state?: BankState): OpResult<T> {
  return { ok: false, error, state };
}

/** Exécute une opération en convertissant les DomainError en échec propre. */
export function guard<T>(fn: () => OpResult<T>): OpResult<T> {
  try {
    return fn();
  } catch (e) {
    if (e instanceof DomainError) return fail(e.message);
    throw e;
  }
}

const LOG_LIMIT = 1000;
const NOTIF_LIMIT = 300;

export function withLog(state: BankState, ctx: Ctx, level: SimLogEntry['level'], action: string, detail: string): BankState {
  const entry: SimLogEntry = { id: ctx.id('log'), date: ctx.now, level, action, detail: detail.slice(0, 400) };
  const simLog = [entry, ...state.simLog];
  if (simLog.length > LOG_LIMIT) simLog.length = LOG_LIMIT;
  return { ...state, simLog };
}

export function withNotification(
  state: BankState,
  ctx: Ctx,
  n: { kind: NotificationKind; title: string; body: string; link?: string | null; dedupeKey?: string | null },
): BankState {
  if (!state.settings.notifications) return state;
  if (n.dedupeKey && state.notifications.some((x) => x.dedupeKey === n.dedupeKey)) return state;
  const notif: AppNotification = {
    id: ctx.id('ntf'),
    kind: n.kind,
    title: n.title.slice(0, 120),
    body: n.body.slice(0, 400),
    createdAt: ctx.now,
    read: false,
    link: n.link ?? null,
    dedupeKey: n.dedupeKey ?? null,
  };
  const notifications = [notif, ...state.notifications];
  if (notifications.length > NOTIF_LIMIT) notifications.length = NOTIF_LIMIT;
  return { ...state, notifications };
}

export function withLoanEvent(state: BankState, ctx: Ctx, e: Omit<LoanEvent, 'id' | 'date'> & { date?: LocalDateTime }): BankState {
  const event: LoanEvent = { id: ctx.id('lev'), date: e.date ?? ctx.now, ...e };
  return { ...state, loanEvents: [event, ...state.loanEvents] };
}

export type TxInput = Pick<Transaction, 'type' | 'accountId' | 'amount' | 'label' | 'category'> & Partial<Omit<Transaction, 'id' | 'createdAt'>>;

export function buildTx(ctx: Ctx, input: TxInput): Transaction {
  return {
    id: ctx.id('tx'),
    origType: null,
    date: ctx.now,
    createdAt: ctx.realNow,
    status: 'completed',
    note: null,
    cardId: null,
    contactId: null,
    loanId: null,
    vaultId: null,
    groupId: null,
    reversalOf: null,
    reversedBy: null,
    principalPart: null,
    interestPart: null,
    declineReason: null,
    ...input,
  };
}

/** Insère les transactions en tête (ordre antéchronologique). */
export function withTx(state: BankState, ...txs: Transaction[]): BankState {
  return { ...state, transactions: [...txs.slice().reverse(), ...state.transactions] };
}

export function isPosted(tx: Transaction): boolean {
  return tx.status === 'completed';
}

export interface Balances {
  accounts: Map<string, number>;
  vaults: Map<string, number>;
}

/**
 * Les soldes ne sont jamais stockés : ils sont la somme du grand livre, ce qui
 * garantit par construction la cohérence entre historique et soldes.
 * Un mouvement vers un coffre débite le compte et crédite le coffre du même montant.
 */
export function computeBalances(transactions: readonly Transaction[]): Balances {
  const accounts = new Map<string, number>();
  const vaults = new Map<string, number>();
  for (const tx of transactions) {
    if (!isPosted(tx)) continue;
    accounts.set(tx.accountId, (accounts.get(tx.accountId) ?? 0) + tx.amount);
    if (tx.vaultId) vaults.set(tx.vaultId, (vaults.get(tx.vaultId) ?? 0) - tx.amount);
  }
  return { accounts, vaults };
}

export function accountBalance(state: BankState, accountId: string): number {
  let total = 0;
  for (const tx of state.transactions) if (isPosted(tx) && tx.accountId === accountId) total += tx.amount;
  return total;
}

export function vaultBalance(state: BankState, vaultId: string): number {
  let total = 0;
  for (const tx of state.transactions) if (isPosted(tx) && tx.vaultId === vaultId) total -= tx.amount;
  return total;
}

export function requireActiveAccount(state: BankState, accountId: string) {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) throw new DomainError('Compte introuvable.');
  if (account.archived) throw new DomainError(`Le compte « ${account.name} » est archivé.`);
  return account;
}

/** Type « économique » d'une transaction : une contrepassation hérite du type annulé. */
export function effectiveType(tx: Transaction): TxType {
  return tx.type === 'reversal' && tx.origType ? tx.origType : tx.type;
}

export function txDay(tx: Transaction): ISODate {
  return datePart(tx.date);
}

export function sanitizeText(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}
