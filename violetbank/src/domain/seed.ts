/**
 * État initial et jeu de données d'exemple. Le jeu d'exemple est construit en
 * rejouant les vraies opérations du moteur à des dates passées : il respecte donc
 * exactement les mêmes règles que les actions de l'utilisateur.
 */
import { createAccount, deposit, recordExpense, receiveFromContact, sendToContact, transferInternal } from './accounts';
import { createCard } from './cards';
import { randomId } from './ids';
import { addDays, toISODate, type ISODate } from './dates';
import type { Ctx, OpResult } from './core';
import { activateLoan, createApplication, decideApplication, payInstallment, syncLoanReminders } from './loans';
import { upsertBudget } from './misc';
import { SCHEMA_VERSION, type BankState, type Contact, type LoanProduct, type Settings } from './schema';
import { createVault, vaultDeposit } from './vaults';

export const DEFAULT_SETTINGS: Settings = {
  appName: 'VioletBank Demo',
  theme: 'system',
  animations: true,
  cardAnimations: true,
  notifications: true,
  balanceHidden: false,
  currency: 'EUR',
  decisionMode: 'auto',
  balanceRule: true,
  maxTotalDebt: 5_000_000,
  simulationDate: null,
  allowDeferral: true,
  earlyRepaymentFeeBps: 0,
  sidebarCollapsed: false,
};

export const DEFAULT_PRODUCTS: LoanProduct[] = [
  { id: 'prd_small', name: 'Petit prêt fictif', icon: 'coins', description: 'Un petit coup de pouce de démonstration, remboursé rapidement.', minAmount: 10_000, maxAmount: 150_000, minMonths: 3, maxMonths: 12, annualRateBps: 490, requiresPurpose: false, enabled: true },
  { id: 'prd_personal', name: 'Prêt personnel fictif', icon: 'wallet', description: 'Scénario généraliste pour simuler un financement plus important.', minAmount: 100_000, maxAmount: 3_000_000, minMonths: 12, maxMonths: 60, annualRateBps: 550, requiresPurpose: false, enabled: true },
  { id: 'prd_computer', name: 'Prêt achat informatique', icon: 'laptop', description: 'Simulez l’achat d’un ordinateur ou de composants.', minAmount: 30_000, maxAmount: 500_000, minMonths: 6, maxMonths: 36, annualRateBps: 390, requiresPurpose: false, enabled: true },
  { id: 'prd_phone', name: 'Prêt achat téléphone', icon: 'smartphone', description: 'Étalez fictivement l’achat d’un smartphone.', minAmount: 15_000, maxAmount: 200_000, minMonths: 3, maxMonths: 24, annualRateBps: 290, requiresPurpose: false, enabled: true },
  { id: 'prd_project', name: 'Prêt projet personnel', icon: 'rocket', description: 'Pour un projet décrit librement (motif requis, aucun justificatif).', minAmount: 100_000, maxAmount: 2_000_000, minMonths: 12, maxMonths: 60, annualRateBps: 520, requiresPurpose: true, enabled: true },
  { id: 'prd_unexpected', name: 'Prêt dépenses imprévues', icon: 'umbrella', description: 'Simulez la gestion d’une dépense inattendue.', minAmount: 20_000, maxAmount: 300_000, minMonths: 3, maxMonths: 24, annualRateBps: 650, requiresPurpose: false, enabled: true },
  { id: 'prd_custom', name: 'Prêt personnalisable', icon: 'sliders', description: 'Tous les paramètres sont libres dans les limites de démonstration.', minAmount: 10_000, maxAmount: 5_000_000, minMonths: 3, maxMonths: 60, annualRateBps: 600, requiresPurpose: false, enabled: true },
];

function defaultContacts(now: string): Contact[] {
  const base = [
    { name: 'Lina Moreau', emoji: '🦊', color: '#E44F62', description: 'Colocataire fictive' },
    { name: 'Hugo Bernard', emoji: '🐼', color: '#4285F4', description: 'Ami de démonstration' },
    { name: 'Sarah Lefèvre', emoji: '🌸', color: '#B9A7FF', description: 'Collègue fictive' },
    { name: 'Maël Dubois', emoji: '🎮', color: '#26B879', description: 'Partenaire de jeu' },
    { name: 'Inès Garnier', emoji: '☕', color: '#F3A642', description: 'Contact de test' },
    { name: 'Club Photo Démo', emoji: '📷', color: '#7656F6', description: 'Association fictive' },
  ];
  return base.map((c, i) => ({
    id: `ctc_default_${i + 1}`,
    ...c,
    handle: `@demo-${c.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '')}`,
    favorite: i < 3,
    archived: false,
    createdAt: now,
  }));
}

export function createEmptyState(ctx: Ctx): BankState {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { displayName: 'Alex', holderName: 'ALEX MARTIN', avatarEmoji: '🦄', avatarColor: '#7656F6', demoHandle: '@demo-alex' },
    settings: { ...DEFAULT_SETTINGS },
    accounts: [{ id: 'acc_main', name: 'Compte principal', kind: 'main', color: '#7656F6', icon: 'wallet', createdAt: ctx.now, archived: false }],
    cards: [],
    transactions: [],
    contacts: defaultContacts(ctx.now),
    vaults: [],
    budgets: [],
    customCategories: [],
    loanProducts: DEFAULT_PRODUCTS.map((p) => ({ ...p })),
    loanApplications: [],
    loans: [],
    loanEvents: [],
    notifications: [],
    simLog: [],
  };
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : jeu d'exemple reproductible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERCHANTS: Record<string, { names: string[]; min: number; max: number; weight: number }> = {
  food: { names: ['Marché Lavande', 'Boulangerie du Coin', 'Supérette Démo', 'Sushi Fictif', 'Pizzeria Test'], min: 600, max: 6500, weight: 9 },
  transport: { names: ['Métro Démo', 'Trottinette Test', 'Train Fictif', 'Station Essence Démo'], min: 190, max: 4500, weight: 4 },
  shopping: { names: ['Boutique Violette', 'Mode Démo', 'Librairie Test'], min: 1500, max: 9000, weight: 3 },
  gaming: { names: ['Store Jeux Démo', 'Pass Gaming Fictif'], min: 499, max: 5999, weight: 2 },
  subscriptions: { names: ['Streaming Démo', 'Musique Fictive', 'Cloud Test'], min: 499, max: 1599, weight: 2 },
  leisure: { names: ['Cinéma Démo', 'Salle d’escalade Test', 'Concert Fictif'], min: 900, max: 4500, weight: 2 },
  computer: { names: ['Composants Démo', 'Accessoires Tech Test'], min: 1999, max: 12000, weight: 1 },
};

/** Construit le jeu d'exemple en rejouant des opérations datées dans le passé. */
export function createDemoState(today: ISODate = toISODate(new Date())): BankState {
  let seq = 0;
  const ctxAt = (day: ISODate, time = '10:00:00'): Ctx => ({ now: `${day}T${time}`, today: day, realNow: new Date().toISOString(), id: (p) => `${randomId(p)}${(seq++).toString(36)}` });
  let state = createEmptyState(ctxAt(addDays(today, -100)));
  const apply = <T>(res: OpResult<T>): T | undefined => {
    if (res.state) state = res.state;
    return res.ok ? res.data : undefined;
  };
  const day = (offset: number) => addDays(today, offset);

  const spending = apply(createAccount(state, ctxAt(day(-98)), { name: 'Compte dépenses', kind: 'spending', color: '#4285F4', icon: 'credit-card' }));
  const savings = apply(createAccount(state, ctxAt(day(-98)), { name: 'Compte épargne', kind: 'savings', color: '#26B879', icon: 'piggy-bank' }));
  const projects = apply(createAccount(state, ctxAt(day(-98)), { name: 'Compte projets', kind: 'projects', color: '#F3A642', icon: 'rocket' }));
  const main = 'acc_main';
  if (!spending || !savings || !projects) return state;

  apply(deposit(state, ctxAt(day(-97), '09:12:00'), { accountId: main, amount: 820_000, label: 'Fonds de test initiaux' }));
  apply(deposit(state, ctxAt(day(-97), '09:13:00'), { accountId: spending.id, amount: 120_000, label: 'Fonds de test initiaux' }));
  apply(deposit(state, ctxAt(day(-97), '09:14:00'), { accountId: savings.id, amount: 250_000, label: 'Fonds de test initiaux' }));

  const premium = apply(createCard(state, ctxAt(day(-96)), { name: 'Violet Premium', accountId: main, color: '#7656F6', accent: '#4930B5', style: 'gradient', avatar: '🦄', monthlyLimit: 250_000, locked: false }));
  const online = apply(createCard(state, ctxAt(day(-96)), { name: 'Achats en ligne', accountId: spending.id, color: '#101014', accent: '#7656F6', style: 'metal', avatar: null, monthlyLimit: 60_000, locked: false }));
  apply(createCard(state, ctxAt(day(-60)), { name: 'Voyage', accountId: main, color: '#B9A7FF', accent: '#4285F4', style: 'aurora', avatar: '✈️', monthlyLimit: null, locked: true }));

  for (const [cat, limit] of [['food', 45_000], ['gaming', 8_000], ['shopping', 25_000], ['transport', 9_000], ['subscriptions', 4_500], ['loan_repayment', 12_000]] as const) {
    apply(upsertBudget(state, ctxAt(day(-95)), cat, limit));
  }

  const pc = apply(createVault(state, ctxAt(day(-94)), { name: 'Nouveau PC', goal: 180_000, targetDate: day(120), color: '#7656F6', icon: 'laptop' }));
  const trip = apply(createVault(state, ctxAt(day(-94)), { name: 'Vacances', goal: 120_000, targetDate: day(200), color: '#4285F4', icon: 'plane' }));
  const emergency = apply(createVault(state, ctxAt(day(-94)), { name: 'Fonds d’urgence', goal: 300_000, targetDate: null, color: '#26B879', icon: 'shield' }));

  // Loan : achat informatique activé il y a 80 jours, deux échéances déjà payées.
  const app = apply(createApplication(state, ctxAt(day(-80), '14:20:00'), {
    productId: 'prd_computer', amount: 120_000, months: 12, annualRateBps: 390, repaymentMode: 'annuity', startDate: day(-80), purpose: 'Ordinateur portable de démonstration', accountId: main,
  }, true));
  if (app) {
    apply(decideApplication(state, ctxAt(day(-80), '14:21:00'), app.id));
    const loan = apply(activateLoan(state, ctxAt(day(-80), '14:25:00'), app.id));
    if (loan) {
      for (const inst of loan.schedule.slice(0, 3)) {
        if (inst.dueDate <= day(-1)) apply(payInstallment(state, ctxAt(inst.dueDate, '08:30:00'), loan.id, main, inst.index));
      }
    }
  }
  // Dossier refusé (montant hors limites) pour illustrer les décisions.
  const refused = apply(createApplication(state, ctxAt(day(-30), '18:05:00'), {
    productId: 'prd_small', amount: 250_000, months: 12, annualRateBps: 490, repaymentMode: 'annuity', startDate: day(-30), purpose: '', accountId: main,
  }, true));
  if (refused) apply(decideApplication(state, ctxAt(day(-30), '18:06:00'), refused.id));

  const rand = rng(42);
  const cats = Object.entries(MERCHANTS);
  const totalWeight = cats.reduce((s, [, m]) => s + m.weight, 0);
  for (let d = -92; d <= 0; d++) {
    const date = day(d);
    // Fonds de test « mensuels » le 1er de chaque mois.
    if (date.endsWith('-01')) apply(deposit(state, ctxAt(date, '07:00:00'), { accountId: main, amount: 185_000, label: 'Fonds de test mensuels' }));
    const count = rand() < 0.35 ? 0 : rand() < 0.7 ? 1 : 2;
    for (let k = 0; k < count; k++) {
      let pick = rand() * totalWeight;
      let entry = cats[0] as (typeof cats)[number];
      for (const c of cats) {
        pick -= c[1].weight;
        if (pick <= 0) {
          entry = c;
          break;
        }
      }
      const [cat, m] = entry;
      const merchant = m.names[Math.floor(rand() * m.names.length)] as string;
      const amount = Math.round(m.min + rand() * (m.max - m.min));
      const useOnline = cat === 'shopping' || cat === 'subscriptions' || cat === 'gaming';
      const hh = String(8 + Math.floor(rand() * 13)).padStart(2, '0');
      const mm = String(Math.floor(rand() * 60)).padStart(2, '0');
      apply(recordExpense(state, ctxAt(date, `${hh}:${mm}:00`), {
        accountId: useOnline ? spending.id : main,
        cardId: useOnline ? online?.id ?? null : premium?.id ?? null,
        amount,
        merchant,
        category: cat,
      }));
    }
    if (d % 30 === -2) apply(transferInternal(state, ctxAt(date, '19:00:00'), { fromAccountId: main, toAccountId: spending.id, amount: 30_000, note: 'Alimentation mensuelle' }));
  }
  apply(sendToContact(state, ctxAt(day(-40), '20:15:00'), { accountId: main, contactId: 'ctc_default_1', amount: 2_500, message: 'Pizza de vendredi 🍕' }));
  apply(receiveFromContact(state, ctxAt(day(-33), '12:40:00'), { accountId: main, contactId: 'ctc_default_2', amount: 4_000, message: 'Place de cinéma' }));
  apply(sendToContact(state, ctxAt(day(-12), '18:30:00'), { accountId: main, contactId: 'ctc_default_4', amount: 1_500, message: 'Extension du jeu', category: 'gaming' }));
  apply(receiveFromContact(state, ctxAt(day(-5), '09:10:00'), { accountId: main, contactId: 'ctc_default_3', amount: 2_250, message: 'Cadeau commun' }));
  if (pc) {
    apply(vaultDeposit(state, ctxAt(day(-90)), pc.id, main, 40_000));
    apply(vaultDeposit(state, ctxAt(day(-60)), pc.id, main, 35_000));
    apply(vaultDeposit(state, ctxAt(day(-30)), pc.id, main, 30_000));
  }
  if (trip) apply(vaultDeposit(state, ctxAt(day(-45)), trip.id, savings.id, 52_000));
  if (emergency) apply(vaultDeposit(state, ctxAt(day(-85)), emergency.id, savings.id, 150_000));
  apply(transferInternal(state, ctxAt(day(-20), '11:00:00'), { fromAccountId: main, toAccountId: projects.id, amount: 45_075, note: 'Mise de côté projet' }));

  // Les notifications du jeu d'exemple sont marquées lues : seules les nouvelles s'affichent.
  state = { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
  state = syncLoanReminders(state, ctxAt(today, '08:00:00'));
  return state;
}
