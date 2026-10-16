import { describe, expect, it } from 'vitest';
import { deposit, recordExpense, reverseTransaction, sendToContact, transferInternal, withdraw, createAccount, archiveAccount } from '../src/domain/accounts';
import { createCard, setCardLock } from '../src/domain/cards';
import { accountBalance, computeBalances } from '../src/domain/core';
import { upsertBudget } from '../src/domain/misc';
import { checkIntegrity, validateState } from '../src/domain/persistence';
import { createDemoState } from '../src/domain/seed';
import { categorySpent, dashboardSummary, flowBuckets } from '../src/domain/selectors';
import { closeVault, createVault, vaultDeposit, vaultWithdraw } from '../src/domain/vaults';
import { ctxAt, freshState, unwrap } from './helpers';

const D = '2026-01-15';

describe('opérations fictives (scénario A)', () => {
  it('ajout de 100 € : solde, transaction, notification, persistance', () => {
    const s0 = freshState(D);
    const r = unwrap(deposit(s0, ctxAt(D), { accountId: 'acc_main', amount: 10_000 }));
    expect(accountBalance(r.state, 'acc_main')).toBe(10_000);
    expect(r.state.transactions[0]?.type).toBe('deposit');
    expect(r.state.notifications[0]?.title).toMatch(/Fonds de test/);
    const reloaded = validateState(JSON.parse(JSON.stringify(r.state)));
    expect(reloaded.ok && accountBalance(reloaded.state, 'acc_main')).toBe(10_000);
  });

  it('scénario G : montants invalides et soldes insuffisants', () => {
    const s = freshState(D, 5_000);
    expect(deposit(s, ctxAt(D), { accountId: 'acc_main', amount: -100 }).ok).toBe(false);
    expect(deposit(s, ctxAt(D), { accountId: 'acc_main', amount: 0 }).ok).toBe(false);
    expect(deposit(s, ctxAt(D), { accountId: 'acc_main', amount: 1.5 }).ok).toBe(false);
    expect(deposit(s, ctxAt(D), { accountId: 'acc_main', amount: 1e12 }).ok).toBe(false);
    expect(withdraw(s, ctxAt(D), { accountId: 'acc_main', amount: 5_001 }).ok).toBe(false);
    expect(withdraw(s, ctxAt(D), { accountId: 'acc_main', amount: 5_000 }).ok).toBe(true);
  });

  it('virement interne : aucune création de fonds', () => {
    let s = freshState(D, 10_000);
    const acc = unwrap(createAccount(s, ctxAt(D), { name: 'Épargne', kind: 'savings', color: '#26B879', icon: 'piggy-bank' }));
    s = unwrap(transferInternal(acc.state, ctxAt(D), { fromAccountId: 'acc_main', toAccountId: acc.data.id, amount: 4_000 })).state;
    expect(accountBalance(s, 'acc_main')).toBe(6_000);
    expect(accountBalance(s, acc.data.id)).toBe(4_000);
    expect(transferInternal(s, ctxAt(D), { fromAccountId: 'acc_main', toAccountId: acc.data.id, amount: 6_001 }).ok).toBe(false);
    expect(archiveAccount(s, ctxAt(D), acc.data.id).ok).toBe(false);
    // Contrepassation d'un virement : les deux jambes sont annulées.
    const tx = s.transactions.find((t) => t.type === 'transfer_out')!;
    const r = unwrap(reverseTransaction(s, ctxAt(D), tx.id));
    expect(r.data).toHaveLength(2);
    expect(accountBalance(r.state, 'acc_main')).toBe(10_000);
    expect(reverseTransaction(r.state, ctxAt(D), tx.id).ok).toBe(false);
  });

  it('contrepassation d’un dépôt impossible si les fonds sont dépensés', () => {
    let s = freshState(D);
    const dep = unwrap(deposit(s, ctxAt(D), { accountId: 'acc_main', amount: 5_000 }));
    s = unwrap(withdraw(dep.state, ctxAt(D), { accountId: 'acc_main', amount: 3_000 })).state;
    expect(reverseTransaction(s, ctxAt(D), dep.data.id).ok).toBe(false);
  });
});

describe('cartes (scénario B)', () => {
  it('carte verrouillée : dépense bloquée et tracée sans impact', () => {
    let s = freshState(D, 20_000);
    const c = unwrap(createCard(s, ctxAt(D), { name: 'Violette', accountId: 'acc_main', color: '#7656F6', accent: '#4930B5', style: 'gradient', avatar: null, monthlyLimit: null, locked: false }));
    expect(c.data.demoId).toMatch(/^DEMO \d{4} \d{4}$/);
    s = unwrap(setCardLock(c.state, ctxAt(D), c.data.id, true)).state;
    const res = recordExpense(s, ctxAt(D), { accountId: 'acc_main', cardId: c.data.id, amount: 1_000, merchant: 'Test', category: 'food' });
    expect(res.ok).toBe(false);
    expect(res.state?.transactions[0]?.status).toBe('declined');
    expect(accountBalance(res.state!, 'acc_main')).toBe(20_000);
    s = unwrap(setCardLock(res.state!, ctxAt(D), c.data.id, false)).state;
    s = unwrap(recordExpense(s, ctxAt(D), { accountId: 'acc_main', cardId: c.data.id, amount: 1_000, merchant: 'Test', category: 'food' })).state;
    expect(accountBalance(s, 'acc_main')).toBe(19_000);
  });

  it('plafond mensuel de test', () => {
    const c = unwrap(createCard(freshState(D, 50_000), ctxAt(D), { name: 'Plafond', accountId: 'acc_main', color: '#7656F6', accent: '#4930B5', style: 'minimal', avatar: null, monthlyLimit: 5_000, locked: false }));
    const ok1 = unwrap(recordExpense(c.state, ctxAt(D), { accountId: 'acc_main', cardId: c.data.id, amount: 4_000, merchant: 'A', category: 'food' }));
    expect(recordExpense(ok1.state, ctxAt(D), { accountId: 'acc_main', cardId: c.data.id, amount: 1_001, merchant: 'B', category: 'food' }).ok).toBe(false);
  });
});

describe('coffres et budgets', () => {
  it('les coffres déplacent l’argent sans en créer', () => {
    const v = unwrap(createVault(freshState(D, 10_000), ctxAt(D), { name: 'PC', goal: 5_000, targetDate: null, color: '#7656F6', icon: 'laptop' }));
    let s = unwrap(vaultDeposit(v.state, ctxAt(D), v.data.id, 'acc_main', 6_000)).state;
    const b = computeBalances(s.transactions);
    expect(b.accounts.get('acc_main')).toBe(4_000);
    expect(b.vaults.get(v.data.id)).toBe(6_000);
    expect(s.notifications.some((n) => n.kind === 'vault_goal')).toBe(true);
    expect(vaultWithdraw(s, ctxAt(D), v.data.id, 'acc_main', 6_001).ok).toBe(false);
    s = unwrap(closeVault(s, ctxAt(D), v.data.id, 'acc_main')).state;
    expect(accountBalance(s, 'acc_main')).toBe(10_000);
    expect(dashboardSummary(s, D).inVaults).toBe(0);
  });

  it('les dépenses alimentent les budgets et l’alerte est unique par mois', () => {
    let s = unwrap(upsertBudget(freshState(D, 50_000), ctxAt(D), 'food', 3_000)).state;
    s = unwrap(recordExpense(s, ctxAt(D), { accountId: 'acc_main', amount: 2_000, merchant: 'A', category: 'food' })).state;
    s = unwrap(sendToContact(s, ctxAt(D), { accountId: 'acc_main', contactId: 'ctc_default_1', amount: 1_500, category: 'food' })).state;
    expect(categorySpent(s, 'food', '2026-01')).toBe(3_500);
    s = unwrap(recordExpense(s, ctxAt(D), { accountId: 'acc_main', amount: 100, merchant: 'B', category: 'food' })).state;
    expect(s.notifications.filter((n) => n.kind === 'budget')).toHaveLength(1);
  });
});

describe('jeu d’exemple', () => {
  it('est valide, cohérent et ne présente pas la dette comme disponible', () => {
    const s = createDemoState('2026-10-16');
    expect(validateState(JSON.parse(JSON.stringify(s))).ok).toBe(true);
    expect(checkIntegrity(s)).toBeNull();
    const summary = dashboardSummary(s, '2026-10-16');
    expect(summary.loanOutstanding).toBeGreaterThan(0);
    expect(summary.available).toBeGreaterThan(0);
    for (const [, v] of computeBalances(s.transactions).accounts) expect(v).toBeGreaterThanOrEqual(0);
    expect(s.loans[0]?.payments.length).toBeGreaterThanOrEqual(2);
    expect(s.loanApplications.some((a) => a.status === 'refused')).toBe(true);
    const buckets = flowBuckets(s, '2026-10-16', '30d');
    expect(buckets).toHaveLength(30);
    const total = [...computeBalances(s.transactions).accounts.values()].reduce((a, b) => a + b, 0);
    expect(buckets.at(-1)?.balance).toBe(total);
  });

  it('rejette les données corrompues', () => {
    expect(validateState(null).ok).toBe(false);
    expect(validateState({ schemaVersion: 99 }).ok).toBe(false);
    const s = createDemoState('2026-10-16');
    const broken = JSON.parse(JSON.stringify(s));
    broken.transactions[0].amount = 12.5;
    expect(validateState(broken).ok).toBe(false);
  });
});
