import { DomainError, fail, guard, ok, requireActiveAccount, sanitizeText, withLog, withNotification, type Ctx, type OpResult } from './core';
import { randomDigits } from './ids';
import { formatMoney, MAX_OPERATION_CENTS } from './money';
import type { BankState, CardKind, CardStyle, VirtualCard } from './schema';

export interface CardInput {
  name: string;
  accountId: string;
  color: string;
  accent: string;
  style: CardStyle;
  avatar: string | null;
  monthlyLimit: number | null;
  locked: boolean;
  kind?: CardKind;
}

export const MAX_CARDS = 12;

/**
 * Identifiant purement décoratif : préfixe « DEMO » et groupes de chiffres ne
 * respectant aucun format de réseau de paiement (pas de BIN, pas de clé de Luhn).
 */
export function makeDemoId(): string {
  return `DEMO ${randomDigits(4)} ${randomDigits(4)}`;
}

function validate(state: BankState, input: CardInput): CardInput {
  const name = sanitizeText(input.name, 32);
  if (!name) throw new DomainError('Donnez un nom à la carte.');
  requireActiveAccount(state, input.accountId);
  if (input.monthlyLimit !== null) {
    if (!Number.isSafeInteger(input.monthlyLimit) || input.monthlyLimit <= 0) throw new DomainError('Plafond invalide.');
    if (input.monthlyLimit > MAX_OPERATION_CENTS) throw new DomainError(`Plafond maximum : ${formatMoney(MAX_OPERATION_CENTS)}.`);
  }
  return { ...input, name };
}

export function createCard(state: BankState, ctx: Ctx, input: CardInput): OpResult<VirtualCard> {
  return guard(() => {
    const v = validate(state, input);
    if (state.cards.filter((c) => !c.deletedAt).length >= MAX_CARDS) throw new DomainError(`Maximum ${MAX_CARDS} cartes de démonstration.`);
    const card: VirtualCard = {
      id: ctx.id('card'),
      name: v.name,
      accountId: v.accountId,
      holderName: state.profile.holderName,
      color: v.color,
      accent: v.accent,
      style: v.style,
      avatar: v.avatar,
      demoId: makeDemoId(),
      kind: input.kind ?? 'standard',
      regenerations: 0,
      monthlyLimit: v.monthlyLimit,
      locked: v.locked,
      createdAt: ctx.now,
      deletedAt: null,
    };
    let next: BankState = { ...state, cards: [...state.cards, card] };
    next = withLog(next, ctx, 'success', 'Carte de démonstration créée', card.name);
    next = withNotification(next, ctx, {
      kind: 'card',
      title: 'Nouvelle carte de démonstration',
      body: `« ${card.name} »${card.kind === 'disposable' ? ' (jetable)' : ''} est prête pour vos dépenses simulées.`,
      link: '/cartes',
    });
    return ok(next, card, `Carte « ${card.name} » créée.`);
  });
}

export function updateCard(state: BankState, ctx: Ctx, cardId: string, patch: Partial<CardInput>): OpResult<VirtualCard> {
  return guard(() => {
    const card = state.cards.find((c) => c.id === cardId && !c.deletedAt);
    if (!card) throw new DomainError('Carte introuvable.');
    const v = validate(state, {
      name: patch.name ?? card.name,
      accountId: patch.accountId ?? card.accountId,
      color: patch.color ?? card.color,
      accent: patch.accent ?? card.accent,
      style: patch.style ?? card.style,
      avatar: patch.avatar !== undefined ? patch.avatar : card.avatar,
      monthlyLimit: patch.monthlyLimit !== undefined ? patch.monthlyLimit : card.monthlyLimit,
      locked: patch.locked ?? card.locked,
    });
    // La nature d'une carte (standard / jetable) est fixée à la création.
    const updated: VirtualCard = { ...card, ...v, kind: card.kind };
    let next: BankState = { ...state, cards: state.cards.map((c) => (c.id === cardId ? updated : c)) };
    next = withLog(next, ctx, 'info', 'Carte modifiée', updated.name);
    return ok(next, updated, 'Carte mise à jour.');
  });
}

export function setCardLock(state: BankState, ctx: Ctx, cardId: string, locked: boolean): OpResult<VirtualCard> {
  const card = state.cards.find((c) => c.id === cardId && !c.deletedAt);
  if (!card) return fail('Carte introuvable.');
  if (card.locked === locked) return ok(state, card, locked ? 'Carte déjà verrouillée.' : 'Carte déjà active.');
  const updated = { ...card, locked };
  let next: BankState = { ...state, cards: state.cards.map((c) => (c.id === cardId ? updated : c)) };
  next = withLog(next, ctx, 'info', locked ? 'Carte verrouillée' : 'Carte déverrouillée', card.name);
  next = withNotification(next, ctx, {
    kind: 'card',
    title: locked ? 'Carte de démonstration verrouillée' : 'Carte de démonstration déverrouillée',
    body: locked ? `Les dépenses simulées avec « ${card.name} » sont bloquées.` : `« ${card.name} » accepte à nouveau les dépenses simulées.`,
    link: '/cartes',
  });
  return ok(next, updated, locked ? 'Carte verrouillée.' : 'Carte déverrouillée.');
}

/** Suppression logique : les transactions passées gardent leur lien vers la carte. */
export function deleteCard(state: BankState, ctx: Ctx, cardId: string): OpResult {
  const card = state.cards.find((c) => c.id === cardId && !c.deletedAt);
  if (!card) return fail('Carte introuvable.');
  let next: BankState = { ...state, cards: state.cards.map((c) => (c.id === cardId ? { ...c, deletedAt: ctx.now, locked: true } : c)) };
  next = withLog(next, ctx, 'warning', 'Carte supprimée', card.name);
  return ok(next, undefined, `Carte « ${card.name} » supprimée.`);
}

/** Date d'expiration fictive affichée (3 ans après la création), sans valeur. */
export function demoExpiry(card: Pick<VirtualCard, 'createdAt'>): string {
  const y = Number(card.createdAt.slice(2, 4)) + 3;
  return `${card.createdAt.slice(5, 7)}/${String(y % 100).padStart(2, '0')}`;
}

/** Régénère l'identifiant de démonstration d'une carte (action manuelle ou carte jetable). */
export function regenerateCardId(state: BankState, ctx: Ctx, cardId: string): OpResult<VirtualCard> {
  const card = state.cards.find((c) => c.id === cardId && !c.deletedAt);
  if (!card) return fail('Carte introuvable.');
  const updated: VirtualCard = { ...card, demoId: makeDemoId(), regenerations: card.regenerations + 1 };
  let next: BankState = { ...state, cards: state.cards.map((c) => (c.id === cardId ? updated : c)) };
  next = withLog(next, ctx, 'info', 'Identifiant de carte régénéré', `${card.name} · ${updated.demoId}`);
  return ok(next, updated, 'Nouvel identifiant de démonstration généré.');
}
