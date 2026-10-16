import { assertAmount, assertFunds } from './accounts';
import { DomainError, buildTx, guard, ok, requireActiveAccount, sanitizeText, vaultBalance, withLog, withNotification, withTx, type Ctx, type OpResult } from './core';
import { isISODate } from './dates';
import { formatMoney } from './money';
import type { BankState, Vault } from './schema';

export interface VaultInput {
  name: string;
  goal: number;
  targetDate: string | null;
  color: string;
  icon: string;
}

function validate(input: VaultInput): VaultInput {
  const name = sanitizeText(input.name, 40);
  if (!name) throw new DomainError('Donnez un nom au coffre.');
  assertAmount(input.goal);
  if (input.targetDate !== null && !isISODate(input.targetDate)) throw new DomainError('Date cible invalide.');
  return { ...input, name };
}

function requireVault(state: BankState, vaultId: string): Vault {
  const vault = state.vaults.find((v) => v.id === vaultId && !v.archived);
  if (!vault) throw new DomainError('Coffre introuvable.');
  return vault;
}

export function createVault(state: BankState, ctx: Ctx, input: VaultInput): OpResult<Vault> {
  return guard(() => {
    const v = validate(input);
    if (state.vaults.filter((x) => !x.archived).length >= 20) throw new DomainError('Maximum 20 coffres actifs.');
    const vault: Vault = { id: ctx.id('vlt'), ...v, createdAt: ctx.now, archived: false, goalReachedAt: null };
    let next: BankState = { ...state, vaults: [...state.vaults, vault] };
    next = withLog(next, ctx, 'success', 'Coffre créé', `${vault.name} · objectif ${formatMoney(vault.goal)}`);
    return ok(next, vault, `Coffre « ${vault.name} » créé.`);
  });
}

export function updateVault(state: BankState, ctx: Ctx, vaultId: string, input: VaultInput): OpResult<Vault> {
  return guard(() => {
    const vault = requireVault(state, vaultId);
    const v = validate(input);
    const saved = vaultBalance(state, vaultId);
    // Relever l'objectif au-dessus de l'épargne réarme la notification d'objectif atteint.
    const updated: Vault = { ...vault, ...v, goalReachedAt: saved >= v.goal ? vault.goalReachedAt : null };
    let next: BankState = { ...state, vaults: state.vaults.map((x) => (x.id === vaultId ? updated : x)) };
    next = withLog(next, ctx, 'info', 'Coffre modifié', updated.name);
    next = checkGoal(next, ctx, vaultId);
    return ok(next, updated, 'Coffre mis à jour.');
  });
}

function checkGoal(state: BankState, ctx: Ctx, vaultId: string): BankState {
  const vault = state.vaults.find((v) => v.id === vaultId);
  if (!vault || vault.goalReachedAt) return state;
  if (vaultBalance(state, vaultId) < vault.goal) return state;
  const next = { ...state, vaults: state.vaults.map((v) => (v.id === vaultId ? { ...v, goalReachedAt: ctx.now } : v)) };
  return withNotification(next, ctx, {
    kind: 'vault_goal',
    title: 'Objectif d’épargne atteint 🎉',
    body: `Le coffre « ${vault.name} » a atteint ${formatMoney(vault.goal)}.`,
    link: '/coffres',
  });
}

export function vaultDeposit(state: BankState, ctx: Ctx, vaultId: string, accountId: string, amount: number): OpResult {
  return guard(() => {
    assertAmount(amount);
    const vault = requireVault(state, vaultId);
    const account = requireActiveAccount(state, accountId);
    assertFunds(state, account.id, amount);
    const tx = buildTx(ctx, { type: 'vault_deposit', accountId: account.id, amount: -amount, label: `Vers le coffre ${vault.name}`, category: 'savings', vaultId });
    let next = withTx(state, tx);
    next = withLog(next, ctx, 'success', 'Coffre alimenté', `${formatMoney(amount)} → ${vault.name}`);
    next = checkGoal(next, ctx, vaultId);
    return ok(next, undefined, `${formatMoney(amount)} placés dans « ${vault.name} ».`);
  });
}

export function vaultWithdraw(state: BankState, ctx: Ctx, vaultId: string, accountId: string, amount: number): OpResult {
  return guard(() => {
    assertAmount(amount);
    const vault = requireVault(state, vaultId);
    const account = requireActiveAccount(state, accountId);
    const saved = vaultBalance(state, vaultId);
    if (amount > saved) throw new DomainError(`Le coffre ne contient que ${formatMoney(saved)}.`);
    const tx = buildTx(ctx, { type: 'vault_withdrawal', accountId: account.id, amount, label: `Depuis le coffre ${vault.name}`, category: 'savings', vaultId });
    let next = withTx(state, tx);
    next = withLog(next, ctx, 'success', 'Retrait du coffre', `${formatMoney(amount)} ← ${vault.name}`);
    return ok(next, undefined, `${formatMoney(amount)} retirés de « ${vault.name} ».`);
  });
}

/** Clôture : le reliquat retourne sur un compte, puis le coffre est archivé (historique intact). */
export function closeVault(state: BankState, ctx: Ctx, vaultId: string, accountId: string): OpResult {
  return guard(() => {
    const vault = requireVault(state, vaultId);
    let next = state;
    const saved = vaultBalance(state, vaultId);
    if (saved > 0) {
      const res = vaultWithdraw(state, ctx, vaultId, accountId, saved);
      if (!res.ok) return res;
      next = res.state;
    }
    next = { ...next, vaults: next.vaults.map((v) => (v.id === vaultId ? { ...v, archived: true } : v)) };
    next = withLog(next, ctx, 'info', 'Coffre clôturé', vault.name);
    return ok(next, undefined, `Coffre « ${vault.name} » clôturé.`);
  });
}
