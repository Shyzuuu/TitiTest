/**
 * Validation de l'état relu depuis le stockage : schéma Zod puis contrôles
 * d'intégrité référentielle et comptable (un état incohérent n'est jamais chargé).
 */
import { bankStateSchema, SCHEMA_VERSION, type BankState } from './schema';
import { isOpenInstallment } from './selectors';

export type ValidationResult = { ok: true; state: BankState } | { ok: false; error: string };

export function validateState(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Données absentes ou illisibles.' };
  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (version !== SCHEMA_VERSION) return { ok: false, error: `Version de données non prise en charge (${String(version)}).` };
  const parsed = bankStateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Données invalides : ${issue?.path.join('.') ?? '?'} — ${issue?.message ?? 'erreur inconnue'}` };
  }
  const integrity = checkIntegrity(parsed.data);
  if (integrity) return { ok: false, error: integrity };
  // Le nom de l'application est fixe : les anciennes sauvegardes personnalisées sont normalisées.
  return { ok: true, state: { ...parsed.data, settings: { ...parsed.data.settings, appName: 'VBanque' } } };
}

export function checkIntegrity(state: BankState): string | null {
  const accounts = new Set(state.accounts.map((a) => a.id));
  const ids = new Set<string>();
  for (const tx of state.transactions) {
    if (ids.has(tx.id)) return `Transaction en double : ${tx.id}`;
    ids.add(tx.id);
    if (!accounts.has(tx.accountId)) return `Transaction ${tx.id} liée à un compte inconnu.`;
  }
  for (const card of state.cards) if (!accounts.has(card.accountId)) return `Carte ${card.id} liée à un compte inconnu.`;
  const appIds = new Set<string>();
  for (const loan of state.loans) {
    if (appIds.has(loan.applicationId)) return `Dossier ${loan.applicationId} activé deux fois.`;
    appIds.add(loan.applicationId);
    if (!ids.has(loan.disbursementTxId)) return `Versement du prêt ${loan.reference} introuvable.`;
    if (loan.status === 'cancelled') continue;
    const repaid = loan.payments.reduce((s, p) => s + (p.reversed ? 0 : p.principal), 0);
    const outstanding = loan.schedule.reduce((s, i) => s + (isOpenInstallment(i) ? i.principal - i.paidPrincipal : 0), 0);
    if (repaid + outstanding !== loan.principal) return `Prêt ${loan.reference} : capital incohérent.`;
    for (const p of loan.payments) if (!ids.has(p.txId)) return `Paiement du prêt ${loan.reference} sans transaction.`;
  }
  return null;
}
