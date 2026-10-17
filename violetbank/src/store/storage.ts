/** Accès au stockage local, résistant aux navigateurs qui le bloquent (navigation privée, quotas). */
import { validateState } from '../domain/persistence';
import type { BankState } from '../domain/schema';

export const STORAGE_KEY = 'violetbank-demo:v1';
const BACKUP_KEY = 'violetbank-demo:corrupted-backup';

export type LoadResult = { kind: 'ok'; state: BankState } | { kind: 'empty' } | { kind: 'invalid'; error: string };

export function loadState(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return { kind: 'empty' };
  }
  if (!raw) return { kind: 'empty' };
  try {
    const result = validateState(JSON.parse(raw));
    if (result.ok) return { kind: 'ok', state: result.state };
    backup(raw);
    return { kind: 'invalid', error: result.error };
  } catch {
    backup(raw);
    return { kind: 'invalid', error: 'Données locales illisibles (JSON invalide).' };
  }
}

function backup(raw: string): void {
  try {
    localStorage.setItem(BACKUP_KEY, raw);
  } catch {
    /* sauvegarde de secours impossible : on ne bloque pas le démarrage */
  }
}

export function saveState(state: BankState): string | null {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return null;
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === 'QuotaExceededError' || e.code === 22);
    return quota
      ? 'Espace de stockage local plein : les dernières modifications ne seront pas conservées après actualisation.'
      : 'Stockage local indisponible : les données ne seront pas conservées après actualisation.';
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BACKUP_KEY);
  } catch {
    /* rien à nettoyer */
  }
}

export function readPreference<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(`violetbank-pref:${key}`) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePreference(key: string, value: string): void {
  try {
    localStorage.setItem(`violetbank-pref:${key}`, value);
  } catch {
    /* préférence non persistée */
  }
}
