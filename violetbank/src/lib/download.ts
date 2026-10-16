import { getCategory } from '../domain/categories';
import { centsToDecimal } from '../domain/money';
import type { BankState, Transaction } from '../domain/schema';
import { TX_TYPE_LABEL } from './labels';

export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Libération différée : certains navigateurs lisent l'URL après le clic.
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Échappement CSV (RFC 4180) + neutralisation des formules pour les tableurs. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && typeof value === 'string') s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function transactionsToCsv(state: BankState, txs: readonly Transaction[]): string {
  const accounts = new Map(state.accounts.map((a) => [a.id, a.name]));
  const header = ['Identifiant', 'Date', 'Type', 'Libellé', 'Catégorie', 'Compte', 'Montant', 'Devise', 'Statut', 'Capital', 'Intérêts', 'Contrepassée par', 'Corrige', 'Note'];
  const rows = txs.map((t) => [
    t.id,
    t.date.replace('T', ' '),
    t.type === 'reversal' && t.origType ? `Contrepassation (${TX_TYPE_LABEL[t.origType]})` : TX_TYPE_LABEL[t.type],
    t.label,
    getCategory(t.category, state.customCategories).label,
    accounts.get(t.accountId) ?? t.accountId,
    centsToDecimal(t.amount).replace('.', ','),
    state.settings.currency,
    t.status === 'declined' ? 'Refusée' : t.reversedBy ? 'Contrepassée' : 'Effectuée',
    t.principalPart !== null ? centsToDecimal(t.principalPart).replace('.', ',') : '',
    t.interestPart !== null ? centsToDecimal(t.interestPart).replace('.', ',') : '',
    t.reversedBy ?? '',
    t.reversalOf ?? '',
    t.note ?? '',
  ]);
  const lines = [['# SIMULATION BANCAIRE — DONNÉES FICTIVES SANS VALEUR'], header, ...rows].map((r) => r.map(csvCell).join(';'));
  // BOM UTF-8 : accents correctement lus par les tableurs.
  return `﻿${lines.join('\r\n')}\r\n`;
}
