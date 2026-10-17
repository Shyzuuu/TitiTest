/**
 * Modèle de données persisté. Les schémas Zod servent à la fois de source des types
 * et de validation des données relues depuis le stockage local (corruption, version).
 */
import { z } from 'zod';
import { isISODate } from './dates';

export const SCHEMA_VERSION = 1;

const id = z.string().min(1).max(64);
const cents = z.number().int().safe();
const positiveCents = cents.positive();
const isoDate = z.string().refine(isISODate, 'Date invalide');
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Horodatage invalide');
const timestamp = z.string().min(10).max(40);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const shortText = (max: number) => z.string().max(max);

export const currencySchema = z.enum(['EUR', 'USD', 'GBP', 'CHF']);
export const themeSchema = z.enum(['light', 'dark', 'system']);

export const accountKindSchema = z.enum(['main', 'spending', 'savings', 'projects', 'custom']);
export const accountSchema = z.object({
  id,
  name: shortText(40).min(1),
  kind: accountKindSchema,
  color: hexColor,
  icon: shortText(32),
  createdAt: localDateTime,
  archived: z.boolean(),
});

export const cardStyleSchema = z.enum(['gradient', 'aurora', 'metal', 'minimal']);
export const cardSchema = z.object({
  id,
  name: shortText(32).min(1),
  accountId: id,
  holderName: shortText(40),
  color: hexColor,
  accent: hexColor,
  style: cardStyleSchema,
  avatar: shortText(8).nullable(),
  demoId: shortText(32),
  /** Carte jetable : identifiant de démonstration régénéré après chaque dépense. Défaut pour les données antérieures. */
  kind: z.enum(['standard', 'disposable']).default('standard'),
  regenerations: z.number().int().nonnegative().default(0),
  monthlyLimit: positiveCents.nullable(),
  locked: z.boolean(),
  createdAt: localDateTime,
  deletedAt: localDateTime.nullable(),
});

export const txTypeSchema = z.enum([
  'deposit',
  'withdrawal',
  'expense',
  'transfer_in',
  'transfer_out',
  'p2p_in',
  'p2p_out',
  'vault_deposit',
  'vault_withdrawal',
  'loan_disbursement',
  'loan_repayment',
  'loan_prepayment',
  'loan_fee',
  'reversal',
  'merchant_refund',
]);
export const txStatusSchema = z.enum(['completed', 'declined']);
export const transactionSchema = z.object({
  id,
  type: txTypeSchema,
  /** Pour une contrepassation : type de l'opération annulée. */
  origType: txTypeSchema.nullable(),
  accountId: id,
  amount: cents,
  label: shortText(120),
  category: shortText(48),
  date: localDateTime,
  createdAt: timestamp,
  status: txStatusSchema,
  note: shortText(280).nullable(),
  cardId: id.nullable(),
  contactId: id.nullable(),
  loanId: id.nullable(),
  vaultId: id.nullable(),
  groupId: id.nullable(),
  reversalOf: id.nullable(),
  reversedBy: id.nullable(),
  principalPart: cents.nullable(),
  interestPart: cents.nullable(),
  declineReason: shortText(160).nullable(),
});

export const contactSchema = z.object({
  id,
  name: shortText(40).min(1),
  emoji: shortText(8),
  color: hexColor,
  description: shortText(120),
  handle: shortText(40),
  favorite: z.boolean(),
  archived: z.boolean(),
  createdAt: localDateTime,
});

export const vaultSchema = z.object({
  id,
  name: shortText(40).min(1),
  goal: positiveCents,
  targetDate: isoDate.nullable(),
  color: hexColor,
  icon: shortText(32),
  createdAt: localDateTime,
  archived: z.boolean(),
  goalReachedAt: localDateTime.nullable(),
});

export const customCategorySchema = z.object({
  id,
  label: shortText(32).min(1),
  color: hexColor,
  icon: shortText(32),
});

export const budgetSchema = z.object({
  id,
  category: shortText(48),
  limit: positiveCents,
  createdAt: localDateTime,
  /** Mois (« 2026-10 ») pour lesquels l'alerte de dépassement a déjà été émise. */
  alertedMonths: z.array(z.string()).max(240),
});

export const repaymentModeSchema = z.enum(['annuity', 'constant_principal']);

export const loanProductSchema = z.object({
  id,
  name: shortText(48).min(1),
  icon: shortText(32),
  description: shortText(240),
  minAmount: positiveCents,
  maxAmount: positiveCents,
  minMonths: z.number().int().min(1).max(360),
  maxMonths: z.number().int().min(1).max(360),
  annualRateBps: z.number().int().min(0).max(5000),
  requiresPurpose: z.boolean(),
  enabled: z.boolean(),
});

export const applicationStatusSchema = z.enum(['draft', 'pending', 'accepted', 'refused', 'info_required', 'cancelled', 'activated']);
export const loanApplicationSchema = z.object({
  id,
  reference: shortText(24),
  productId: id,
  amount: positiveCents,
  months: z.number().int().min(1).max(360),
  annualRateBps: z.number().int().min(0).max(5000),
  repaymentMode: repaymentModeSchema,
  startDate: isoDate,
  purpose: shortText(200),
  accountId: id,
  status: applicationStatusSchema,
  decisionReason: shortText(400).nullable(),
  decisionWarnings: z.array(shortText(300)).max(20),
  decidedBy: z.enum(['auto', 'manual']).nullable(),
  createdAt: localDateTime,
  updatedAt: localDateTime,
  decidedAt: localDateTime.nullable(),
  loanId: id.nullable(),
});

export const installmentStatusSchema = z.enum(['upcoming', 'partial', 'paid', 'settled']);
export const installmentSchema = z.object({
  index: z.number().int().positive(),
  /** Décalage en mois depuis la date de début (intègre les reports). */
  monthOffset: z.number().int().positive(),
  dueDate: isoDate,
  amount: positiveCents,
  principal: cents.nonnegative(),
  interest: cents.nonnegative(),
  balanceAfter: cents.nonnegative(),
  paidPrincipal: cents.nonnegative(),
  paidInterest: cents.nonnegative(),
  status: installmentStatusSchema,
  deferred: z.boolean(),
  paidAt: localDateTime.nullable(),
});

export const loanStatusSchema = z.enum(['active', 'partially_repaid', 'repaid', 'cancelled']);
export const paymentKindSchema = z.enum(['installment', 'partial', 'prepayment', 'payoff']);
export const loanPaymentSchema = z.object({
  id,
  seq: z.number().int().positive(),
  txId: id,
  feeTxId: id.nullable(),
  date: localDateTime,
  accountId: id,
  amount: positiveCents,
  principal: cents.nonnegative(),
  interest: cents.nonnegative(),
  fee: cents.nonnegative(),
  kind: paymentKindSchema,
  installmentIndex: z.number().int().positive().nullable(),
  reversed: z.boolean(),
  reversalTxId: id.nullable(),
  scheduleBefore: z.array(installmentSchema),
  statusBefore: loanStatusSchema,
});

const scenarioSnapshot = z.object({
  annualRateBps: z.number().int().min(0),
  remainingCount: z.number().int().nonnegative(),
  nextPayment: cents.nonnegative(),
  remainingInterest: cents.nonnegative(),
  lastDueDate: isoDate.nullable(),
});
export const loanRevisionSchema = z.object({
  id,
  seq: z.number().int().positive(),
  date: localDateTime,
  kind: z.enum(['rate', 'duration', 'rate_duration', 'prepayment_recast', 'deferral']),
  description: shortText(300),
  before: scenarioSnapshot,
  after: scenarioSnapshot,
  reversed: z.boolean(),
});

export const loanSchema = z.object({
  id,
  reference: shortText(24),
  applicationId: id,
  productId: id,
  label: shortText(60),
  principal: positiveCents,
  initialAnnualRateBps: z.number().int().min(0),
  annualRateBps: z.number().int().min(0),
  months: z.number().int().positive(),
  repaymentMode: repaymentModeSchema,
  startDate: isoDate,
  accountId: id,
  status: loanStatusSchema,
  createdAt: localDateTime,
  closedAt: localDateTime.nullable(),
  schedule: z.array(installmentSchema).min(1),
  payments: z.array(loanPaymentSchema),
  revisions: z.array(loanRevisionSchema),
  seq: z.number().int().nonnegative(),
  disbursementTxId: id,
  cancellationTxId: id.nullable(),
});

export const loanEventKindSchema = z.enum([
  'application_created',
  'application_updated',
  'application_submitted',
  'decision',
  'application_cancelled',
  'activation',
  'disbursement',
  'schedule_generated',
  'payment',
  'partial_payment',
  'prepayment',
  'payoff',
  'revision',
  'deferral',
  'reversal',
  'cancellation',
  'closure',
]);
export const loanEventSchema = z.object({
  id,
  loanId: id.nullable(),
  applicationId: id.nullable(),
  date: localDateTime,
  kind: loanEventKindSchema,
  amount: cents.nullable(),
  status: shortText(60),
  description: shortText(400),
});

export const notificationKindSchema = z.enum([
  'transaction',
  'card',
  'loan_application',
  'loan_accepted',
  'loan_refused',
  'loan_activated',
  'loan_due',
  'loan_payment',
  'vault_goal',
  'budget',
  'system',
]);
export const notificationSchema = z.object({
  id,
  kind: notificationKindSchema,
  title: shortText(120),
  body: shortText(400),
  createdAt: localDateTime,
  read: z.boolean(),
  link: shortText(200).nullable(),
  dedupeKey: shortText(120).nullable(),
});

export const simLogSchema = z.object({
  id,
  date: localDateTime,
  level: z.enum(['info', 'success', 'warning', 'error']),
  action: shortText(80),
  detail: shortText(400),
});

export const settingsSchema = z.object({
  appName: shortText(32).min(1),
  theme: themeSchema,
  animations: z.boolean(),
  cardAnimations: z.boolean(),
  notifications: z.boolean(),
  balanceHidden: z.boolean(),
  currency: currencySchema,
  decisionMode: z.enum(['auto', 'manual']),
  balanceRule: z.boolean(),
  maxTotalDebt: positiveCents,
  simulationDate: isoDate.nullable(),
  allowDeferral: z.boolean(),
  earlyRepaymentFeeBps: z.number().int().min(0).max(1000),
  sidebarCollapsed: z.boolean(),
});

export const profileSchema = z.object({
  displayName: shortText(40).min(1),
  holderName: shortText(40).min(1),
  avatarEmoji: shortText(8),
  avatarColor: hexColor,
  demoHandle: shortText(40),
});

export const bankStateSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  profile: profileSchema,
  settings: settingsSchema,
  accounts: z.array(accountSchema),
  cards: z.array(cardSchema),
  transactions: z.array(transactionSchema),
  contacts: z.array(contactSchema),
  vaults: z.array(vaultSchema),
  budgets: z.array(budgetSchema),
  customCategories: z.array(customCategorySchema),
  loanProducts: z.array(loanProductSchema),
  loanApplications: z.array(loanApplicationSchema),
  loans: z.array(loanSchema),
  loanEvents: z.array(loanEventSchema),
  notifications: z.array(notificationSchema),
  simLog: z.array(simLogSchema),
});

export type Account = z.infer<typeof accountSchema>;
export type AccountKind = z.infer<typeof accountKindSchema>;
export type VirtualCard = z.infer<typeof cardSchema>;
export type CardStyle = z.infer<typeof cardStyleSchema>;
export type CardKind = VirtualCard['kind'];
export type TxType = z.infer<typeof txTypeSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Contact = z.infer<typeof contactSchema>;
export type Vault = z.infer<typeof vaultSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type CustomCategory = z.infer<typeof customCategorySchema>;
export type LoanProduct = z.infer<typeof loanProductSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type LoanApplication = z.infer<typeof loanApplicationSchema>;
export type Installment = z.infer<typeof installmentSchema>;
export type LoanStatus = z.infer<typeof loanStatusSchema>;
export type LoanPayment = z.infer<typeof loanPaymentSchema>;
export type LoanRevision = z.infer<typeof loanRevisionSchema>;
export type ScenarioSnapshot = z.infer<typeof scenarioSnapshot>;
export type Loan = z.infer<typeof loanSchema>;
export type LoanEvent = z.infer<typeof loanEventSchema>;
export type LoanEventKind = z.infer<typeof loanEventKindSchema>;
export type AppNotification = z.infer<typeof notificationSchema>;
export type NotificationKind = z.infer<typeof notificationKindSchema>;
export type SimLogEntry = z.infer<typeof simLogSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type BankState = z.infer<typeof bankStateSchema>;
export type Currency = z.infer<typeof currencySchema>;
