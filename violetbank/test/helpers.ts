import type { Ctx } from '../src/domain/core';
import { createEmptyState } from '../src/domain/seed';
import { deposit } from '../src/domain/accounts';
import type { BankState } from '../src/domain/schema';
import type { OpResult } from '../src/domain/core';

let counter = 0;
export function ctxAt(day: string, time = '12:00:00'): Ctx {
  return { now: `${day}T${time}`, today: day, realNow: '2026-01-01T00:00:00.000Z', id: (p) => `${p}_${(++counter).toString(36)}` };
}

export function unwrap<T>(res: OpResult<T>): { state: BankState; data: T } {
  if (!res.ok) throw new Error(`Opération refusée : ${res.error}`);
  return { state: res.state, data: res.data };
}

export function freshState(day = '2026-01-15', funds = 0): BankState {
  let s = createEmptyState(ctxAt(day));
  if (funds > 0) s = unwrap(deposit(s, ctxAt(day), { accountId: 'acc_main', amount: funds })).state;
  return s;
}
