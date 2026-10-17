import { effectiveType, isPosted } from '../domain/core';
import { monthKey } from '../domain/dates';
import type { BankState } from '../domain/schema';
import { categorySpent, ORDINARY_IN_TYPES, ORDINARY_OUT_TYPES } from '../domain/selectors';

export interface Achievement {
  key: string;
  label: string;
  hint: string;
  emoji: string;
  unlocked: boolean;
}

/** Badges calculés depuis les données : rien n'est stocké, ils suivent toujours l'état réel. */
export function achievements(state: BankState, today: string): Achievement[] {
  const month = monthKey(today);
  const cards = state.cards.filter((c) => !c.deletedAt);
  const paidInstallments = state.loans.some((l) => l.payments.some((p) => !p.reversed));
  const budgetsOk = state.budgets.length > 0 && state.budgets.every((b) => categorySpent(state, b.category, month) <= b.limit);
  const vaultGoal = state.vaults.some((v) => v.goalReachedAt);
  const contactsUsed = new Set(state.transactions.filter((t) => t.contactId && t.status === 'completed').map((t) => t.contactId)).size;
  const txCount = state.transactions.filter(isPosted).length;
  return [
    { key: 'card', label: 'Première carte', hint: 'Créer une carte virtuelle', emoji: '💳', unlocked: cards.length > 0 },
    { key: 'saver', label: 'Épargnant', hint: 'Atteindre l’objectif d’un coffre', emoji: '🐷', unlocked: vaultGoal },
    { key: 'borrower', label: 'Emprunteur exemplaire', hint: 'Rembourser une échéance de prêt fictif', emoji: '🏦', unlocked: paidInstallments },
    { key: 'budget', label: 'Budget maîtrisé', hint: 'Rester sous tous ses budgets ce mois-ci', emoji: '🎯', unlocked: budgetsOk },
    { key: 'social', label: 'Bien entouré', hint: 'Échanger avec 3 contacts fictifs', emoji: '🤝', unlocked: contactsUsed >= 3 },
    { key: 'active', label: 'Habitué', hint: 'Atteindre 50 opérations', emoji: '⚡', unlocked: txCount >= 50 },
  ];
}

/** Taux d'épargne du mois : part des entrées courantes non dépensée (null sans entrée). */
export function monthSavingsRate(state: BankState, today: string): number | null {
  const month = monthKey(today);
  let income = 0;
  let out = 0;
  for (const tx of state.transactions) {
    if (!isPosted(tx) || monthKey(tx.date) !== month) continue;
    const t = effectiveType(tx);
    if (ORDINARY_IN_TYPES.has(t)) income += tx.amount;
    else if (ORDINARY_OUT_TYPES.has(t)) out -= tx.amount;
  }
  if (income <= 0) return null;
  return Math.round(((income - out) / income) * 100);
}
