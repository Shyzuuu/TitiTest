/** Contacts fictifs, budgets, catégories personnalisées et notifications. */
import { customKey, getCategory, isKnownCategory } from './categories';
import { DomainError, guard, ok, sanitizeText, withLog, type Ctx, type OpResult } from './core';
import { randomDigits } from './ids';
import { MAX_OPERATION_CENTS, formatMoney } from './money';
import type { BankState, Budget, Contact, CustomCategory } from './schema';

export interface ContactInput {
  name: string;
  emoji: string;
  color: string;
  description: string;
  favorite?: boolean;
}

export function createContact(state: BankState, ctx: Ctx, input: ContactInput): OpResult<Contact> {
  return guard(() => {
    const name = sanitizeText(input.name, 40);
    if (!name) throw new DomainError('Donnez un nom au contact.');
    const slug = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'contact';
    const contact: Contact = {
      id: ctx.id('ctc'),
      name,
      emoji: sanitizeText(input.emoji, 8) || '🙂',
      color: input.color,
      description: sanitizeText(input.description, 120),
      handle: `@demo-${slug}-${randomDigits(3)}`,
      favorite: input.favorite ?? false,
      archived: false,
      createdAt: ctx.now,
    };
    let next: BankState = { ...state, contacts: [...state.contacts, contact] };
    next = withLog(next, ctx, 'success', 'Contact fictif ajouté', name);
    return ok(next, contact, `Contact « ${name} » ajouté.`);
  });
}

export function updateContact(state: BankState, ctx: Ctx, contactId: string, input: ContactInput): OpResult {
  return guard(() => {
    const contact = state.contacts.find((c) => c.id === contactId && !c.archived);
    if (!contact) throw new DomainError('Contact introuvable.');
    const name = sanitizeText(input.name, 40);
    if (!name) throw new DomainError('Donnez un nom au contact.');
    const updated: Contact = {
      ...contact,
      name,
      emoji: sanitizeText(input.emoji, 8) || contact.emoji,
      color: input.color,
      description: sanitizeText(input.description, 120),
      favorite: input.favorite ?? contact.favorite,
    };
    let next: BankState = { ...state, contacts: state.contacts.map((c) => (c.id === contactId ? updated : c)) };
    next = withLog(next, ctx, 'info', 'Contact modifié', name);
    return ok(next, undefined, 'Contact mis à jour.');
  });
}

export function archiveContact(state: BankState, ctx: Ctx, contactId: string): OpResult {
  return guard(() => {
    const contact = state.contacts.find((c) => c.id === contactId && !c.archived);
    if (!contact) throw new DomainError('Contact introuvable.');
    let next: BankState = { ...state, contacts: state.contacts.map((c) => (c.id === contactId ? { ...c, archived: true } : c)) };
    next = withLog(next, ctx, 'info', 'Contact supprimé', contact.name);
    return ok(next, undefined, `Contact « ${contact.name} » supprimé (l’historique est conservé).`);
  });
}

export function upsertBudget(state: BankState, ctx: Ctx, category: string, limit: number): OpResult<Budget> {
  return guard(() => {
    if (!isKnownCategory(category, state.customCategories)) throw new DomainError('Catégorie inconnue.');
    if (!Number.isSafeInteger(limit) || limit <= 0) throw new DomainError('Le budget doit être positif.');
    if (limit > MAX_OPERATION_CENTS) throw new DomainError(`Budget maximum : ${formatMoney(MAX_OPERATION_CENTS)}.`);
    const existing = state.budgets.find((b) => b.category === category);
    const budget: Budget = existing
      ? { ...existing, limit, alertedMonths: [] }
      : { id: ctx.id('bdg'), category, limit, createdAt: ctx.now, alertedMonths: [] };
    const budgets = existing ? state.budgets.map((b) => (b.id === existing.id ? budget : b)) : [...state.budgets, budget];
    let next: BankState = { ...state, budgets };
    const label = getCategory(category, state.customCategories).label;
    next = withLog(next, ctx, 'success', existing ? 'Budget modifié' : 'Budget créé', `${label} · ${formatMoney(limit)} / mois`);
    return ok(next, budget, `Budget « ${label} » enregistré.`);
  });
}

export function deleteBudget(state: BankState, ctx: Ctx, budgetId: string): OpResult {
  const budget = state.budgets.find((b) => b.id === budgetId);
  if (!budget) return { ok: false, error: 'Budget introuvable.' };
  let next: BankState = { ...state, budgets: state.budgets.filter((b) => b.id !== budgetId) };
  next = withLog(next, ctx, 'info', 'Budget supprimé', getCategory(budget.category, state.customCategories).label);
  return ok(next, undefined, 'Budget supprimé.');
}

export function addCustomCategory(state: BankState, ctx: Ctx, input: Omit<CustomCategory, 'id'>): OpResult<string> {
  return guard(() => {
    const label = sanitizeText(input.label, 32);
    if (!label) throw new DomainError('Donnez un nom à la catégorie.');
    if (state.customCategories.some((c) => c.label.toLowerCase() === label.toLowerCase())) throw new DomainError('Cette catégorie existe déjà.');
    if (state.customCategories.length >= 20) throw new DomainError('Maximum 20 catégories personnalisées.');
    const cat: CustomCategory = { id: ctx.id('cat'), label, color: input.color, icon: input.icon };
    let next: BankState = { ...state, customCategories: [...state.customCategories, cat] };
    next = withLog(next, ctx, 'success', 'Catégorie créée', label);
    return ok(next, customKey(cat.id), `Catégorie « ${label} » créée.`);
  });
}

export function markNotification(state: BankState, id: string, read: boolean): BankState {
  return { ...state, notifications: state.notifications.map((n) => (n.id === id ? { ...n, read } : n)) };
}

export function markAllNotificationsRead(state: BankState): BankState {
  return { ...state, notifications: state.notifications.map((n) => (n.read ? n : { ...n, read: true })) };
}

export function deleteNotification(state: BankState, id: string): BankState {
  return { ...state, notifications: state.notifications.filter((n) => n.id !== id) };
}

export interface ProductPatch {
  annualRateBps: number;
  minAmount: number;
  maxAmount: number;
  minMonths: number;
  maxMonths: number;
  enabled: boolean;
  requiresPurpose: boolean;
}

/** Paramétrage d'un scénario de démonstration : n'affecte que les futures demandes. */
export function updateLoanProduct(state: BankState, ctx: Ctx, productId: string, patch: ProductPatch): OpResult {
  return guard(() => {
    const product = state.loanProducts.find((p) => p.id === productId);
    if (!product) throw new DomainError('Scénario introuvable.');
    if (!Number.isInteger(patch.annualRateBps) || patch.annualRateBps < 0 || patch.annualRateBps > 5000) throw new DomainError('Taux fictif entre 0 et 50 %.');
    if (!Number.isSafeInteger(patch.minAmount) || patch.minAmount <= 0) throw new DomainError('Montant minimum invalide.');
    if (!Number.isSafeInteger(patch.maxAmount) || patch.maxAmount > MAX_OPERATION_CENTS) throw new DomainError(`Montant maximum : ${formatMoney(MAX_OPERATION_CENTS)}.`);
    if (patch.minAmount > patch.maxAmount) throw new DomainError('Le minimum doit être inférieur ou égal au maximum.');
    if (!Number.isInteger(patch.minMonths) || !Number.isInteger(patch.maxMonths) || patch.minMonths < 1 || patch.maxMonths > 120 || patch.minMonths > patch.maxMonths) {
      throw new DomainError('Durées invalides (1 à 120 mois, minimum ≤ maximum).');
    }
    if (patch.enabled === false && state.loanProducts.filter((p) => p.enabled).length <= 1 && product.enabled) {
      throw new DomainError('Au moins un scénario doit rester actif.');
    }
    let next: BankState = { ...state, loanProducts: state.loanProducts.map((p) => (p.id === productId ? { ...p, ...patch } : p)) };
    next = withLog(next, ctx, 'info', 'Scénario de prêt modifié', `${product.name} · ${patch.annualRateBps / 100} %`);
    return ok(next, undefined, `Scénario « ${product.name} » mis à jour.`);
  });
}
