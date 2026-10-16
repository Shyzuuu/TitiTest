/**
 * Store central : un seul état immuable, des opérations pures du domaine
 * appliquées de façon synchrone (aucune double exécution possible entre deux
 * rendus), persistance immédiate et synchronisation entre onglets.
 */
import { create } from 'zustand';
import { makeCtx, withLog, type Ctx, type OpResult } from '../domain/core';
import { syncLoanReminders } from '../domain/loans';
import { validateState } from '../domain/persistence';
import type { BankState } from '../domain/schema';
import { createDemoState, createEmptyState } from '../domain/seed';
import { loadState, saveState, STORAGE_KEY } from './storage';
import { useUi } from './ui';

interface ActOptions {
  /** Message de succès ; false pour ne rien afficher ; par défaut, message du domaine. */
  success?: string | false;
  /** N'affiche pas l'erreur (le formulaire l'affiche lui-même). */
  quietError?: boolean;
}

interface BankStore {
  state: BankState;
  bootNotice: string | null;
  storageError: string | null;
  act: <T>(fn: (s: BankState, ctx: Ctx) => OpResult<T>, opts?: ActOptions) => OpResult<T>;
  update: (fn: (s: BankState) => BankState) => void;
  replace: (state: BankState, notice?: string) => void;
  ctx: () => Ctx;
  dismissBootNotice: () => void;
}

function boot(): { state: BankState; notice: string | null } {
  const loaded = typeof window === 'undefined' ? ({ kind: 'empty' } as const) : loadState();
  if (loaded.kind === 'ok') return { state: loaded.state, notice: null };
  const state = createDemoState();
  if (loaded.kind === 'invalid') {
    return {
      state,
      notice: `Les données locales étaient invalides et ont été remplacées par le jeu d’exemple (copie de secours conservée). Détail : ${loaded.error}`,
    };
  }
  return { state, notice: null };
}

const initial = boot();

export const useBank = create<BankStore>((set, get) => {
  const commit = (next: BankState) => {
    const ctx = makeCtx(next.settings.simulationDate);
    const synced = syncLoanReminders(next, ctx);
    const err = saveState(synced);
    if (err && err !== get().storageError) useUi.getState().toast('error', 'Sauvegarde impossible', err);
    set({ state: synced, storageError: err });
  };

  if (typeof window !== 'undefined') queueMicrotask(() => commit(initial.state));

  return {
    state: initial.state,
    bootNotice: initial.notice,
    storageError: null,
    ctx: () => makeCtx(get().state.settings.simulationDate),
    act: (fn, opts = {}) => {
      const ctx = makeCtx(get().state.settings.simulationDate);
      let res: OpResult<never> | OpResult<unknown>;
      try {
        res = fn(get().state, ctx);
      } catch (e) {
        // Erreur inattendue du moteur : l'état n'est pas modifié.
        console.error(e);
        res = { ok: false, error: 'Erreur interne de simulation : opération annulée, aucune donnée modifiée.' };
      }
      const toast = useUi.getState().toast;
      if (res.ok) {
        commit(res.state);
        if (opts.success !== false) toast('success', opts.success ?? res.message ?? 'Opération enregistrée.');
      } else {
        const base = res.state ?? get().state;
        commit(withLog(base, ctx, 'error', 'Opération refusée', res.error));
        if (!opts.quietError) toast('error', 'Opération impossible', res.error);
      }
      return res as never;
    },
    update: (fn) => commit(fn(get().state)),
    replace: (state, notice) => {
      commit(state);
      if (notice) useUi.getState().toast('success', notice);
    },
    dismissBootNotice: () => set({ bootNotice: null }),
  };
});

/** Synchronisation multi-onglets : un onglet ne peut pas écraser les opérations d'un autre. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const result = validateState(JSON.parse(e.newValue));
      if (result.ok) useBank.setState({ state: result.state });
    } catch {
      /* valeur partielle ou illisible : ignorée */
    }
  });
}

export function resetToEmpty(): BankState {
  return createEmptyState(makeCtx(null));
}
