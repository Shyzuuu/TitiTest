import type { CustomCategory } from './schema';

export interface CategoryDef {
  key: string;
  label: string;
  icon: string;
  color: string;
  /** Catégorie proposée pour les dépenses et budgets. */
  spending: boolean;
}

export const BUILTIN_CATEGORIES: readonly CategoryDef[] = [
  { key: 'food', label: 'Nourriture', icon: 'utensils', color: '#F3A642', spending: true },
  { key: 'gaming', label: 'Jeux vidéo', icon: 'gamepad', color: '#7656F6', spending: true },
  { key: 'shopping', label: 'Shopping', icon: 'shopping-bag', color: '#E44F62', spending: true },
  { key: 'transport', label: 'Transport', icon: 'bus', color: '#4285F4', spending: true },
  { key: 'subscriptions', label: 'Abonnements', icon: 'repeat', color: '#B9A7FF', spending: true },
  { key: 'leisure', label: 'Loisirs', icon: 'ticket', color: '#26B879', spending: true },
  { key: 'computer', label: 'Équipement informatique', icon: 'laptop', color: '#4930B5', spending: true },
  { key: 'loan_repayment', label: 'Remboursement de prêt fictif', icon: 'landmark', color: '#92929D', spending: true },
  { key: 'transfer', label: 'Virements', icon: 'send', color: '#5B8DEF', spending: true },
  { key: 'other', label: 'Autre', icon: 'tag', color: '#A0A0AB', spending: true },
  { key: 'income', label: 'Fonds de test', icon: 'plus', color: '#26B879', spending: false },
  { key: 'loan_credit', label: 'Crédit simulé', icon: 'hand-coins', color: '#7656F6', spending: false },
  { key: 'savings', label: 'Épargne', icon: 'piggy-bank', color: '#26B879', spending: false },
  { key: 'internal', label: 'Mouvement interne', icon: 'arrow-left-right', color: '#92929D', spending: false },
  { key: 'cash', label: 'Retrait de test', icon: 'banknote', color: '#E44F62', spending: true },
];

const BUILTIN_MAP = new Map(BUILTIN_CATEGORIES.map((c) => [c.key, c]));

export function customKey(id: string): string {
  return `custom:${id}`;
}

export function getCategory(key: string, custom: readonly CustomCategory[]): CategoryDef {
  const builtin = BUILTIN_MAP.get(key);
  if (builtin) return builtin;
  if (key.startsWith('custom:')) {
    const c = custom.find((x) => customKey(x.id) === key);
    if (c) return { key, label: c.label, icon: c.icon, color: c.color, spending: true };
  }
  return { key, label: 'Autre', icon: 'tag', color: '#A0A0AB', spending: true };
}

export function spendingCategories(custom: readonly CustomCategory[]): CategoryDef[] {
  return [
    ...BUILTIN_CATEGORIES.filter((c) => c.spending),
    ...custom.map((c) => ({ key: customKey(c.id), label: c.label, icon: c.icon, color: c.color, spending: true })),
  ];
}

export function isKnownCategory(key: string, custom: readonly CustomCategory[]): boolean {
  return BUILTIN_MAP.has(key) || custom.some((c) => customKey(c.id) === key);
}
