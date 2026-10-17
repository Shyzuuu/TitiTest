import type { ApplicationStatus, LoanStatus, TxType } from '../domain/schema';
import type { InstallmentDisplayStatus, UnifiedLoanStatus } from '../domain/selectors';

export const TX_TYPE_LABEL: Record<TxType, string> = {
  deposit: 'Dépôt fictif',
  withdrawal: 'Retrait fictif',
  expense: 'Dépense simulée',
  transfer_in: 'Virement interne reçu',
  transfer_out: 'Virement interne émis',
  p2p_in: 'Argent fictif reçu',
  p2p_out: 'Argent fictif envoyé',
  vault_deposit: 'Transfert vers un coffre',
  vault_withdrawal: 'Retrait d’un coffre',
  loan_disbursement: 'Activation de prêt fictif',
  loan_repayment: 'Remboursement fictif',
  loan_prepayment: 'Remboursement anticipé',
  loan_fee: 'Frais de simulation',
  reversal: 'Contrepassation',
  merchant_refund: 'Remboursement commerçant',
};

export type Tone = 'brand' | 'ok' | 'danger' | 'warn' | 'info' | 'neutral';

export const UNIFIED_TONE: Record<UnifiedLoanStatus, Tone> = {
  draft: 'neutral',
  pending: 'info',
  accepted: 'brand',
  info_required: 'warn',
  active: 'brand',
  partially_repaid: 'info',
  repaid: 'ok',
  cancelled: 'neutral',
  refused: 'danger',
};

export const APP_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Brouillon',
  pending: 'En cours de simulation',
  accepted: 'Acceptée dans la simulation',
  refused: 'Refusée dans la simulation',
  info_required: 'Informations manquantes',
  cancelled: 'Annulée par l’utilisateur',
  activated: 'Prêt activé',
};

export const APP_STATUS_TONE: Record<ApplicationStatus, Tone> = {
  draft: 'neutral',
  pending: 'info',
  accepted: 'brand',
  refused: 'danger',
  info_required: 'warn',
  cancelled: 'neutral',
  activated: 'ok',
};

export const LOAN_STATUS_TONE: Record<LoanStatus, Tone> = { active: 'brand', partially_repaid: 'info', repaid: 'ok', cancelled: 'neutral' };

export const INSTALLMENT_LABEL: Record<InstallmentDisplayStatus, string> = {
  upcoming: 'À venir',
  due_today: 'Échue aujourd’hui dans la simulation',
  late: 'En retard dans la simulation',
  paid: 'Payée dans la simulation',
  partial: 'Paiement partiel simulé',
  deferred: 'Reportée dans la simulation',
  settled: 'Soldée par anticipation',
  cancelled: 'Annulée',
};

export const INSTALLMENT_TONE: Record<InstallmentDisplayStatus, Tone> = {
  upcoming: 'neutral',
  due_today: 'warn',
  late: 'danger',
  paid: 'ok',
  partial: 'info',
  deferred: 'brand',
  settled: 'ok',
  cancelled: 'neutral',
};

export const REPAYMENT_MODE_LABEL = { annuity: 'Mensualités constantes', constant_principal: 'Capital constant (mensualités dégressives)' } as const;
