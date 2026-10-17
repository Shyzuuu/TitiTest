import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeBalances } from '../domain/core';
import { formatMoney, type FormatOptions } from '../domain/money';
import { useBank } from '../store/bank';
import { toISODate } from '../domain/dates';

export function useBankState() {
  return useBank((s) => s.state);
}

export function useToday(): string {
  const simDate = useBank((s) => s.state.settings.simulationDate);
  const [real, setReal] = useState(() => toISODate(new Date()));
  useEffect(() => {
    if (simDate) return;
    // Passage à minuit : la date réelle est réévaluée chaque minute.
    const t = setInterval(() => setReal(toISODate(new Date())), 60_000);
    return () => clearInterval(t);
  }, [simDate]);
  return simDate ?? real;
}

/** Formateur monétaire lié à la devise d'affichage et au masquage du solde. */
export function useMoney() {
  const currency = useBank((s) => s.state.settings.currency);
  const hiddenPref = useBank((s) => s.state.settings.balanceHidden);
  return useCallback(
    (cents: number, opts: Omit<FormatOptions, 'currency'> & { sensitive?: boolean } = {}) =>
      formatMoney(cents, { ...opts, currency, hidden: opts.sensitive ? hiddenPref : opts.hidden }),
    [currency, hiddenPref],
  );
}

export function useBalances() {
  const transactions = useBank((s) => s.state.transactions);
  return useMemo(() => computeBalances(transactions), [transactions]);
}

export function useActiveAccounts() {
  const accounts = useBank((s) => s.state.accounts);
  return useMemo(() => accounts.filter((a) => !a.archived), [accounts]);
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setMatches(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/** Thème effectif (le mode « système » suit la préférence de l'OS). */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useBank((s) => s.state.settings.theme);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}

/**
 * Évite les doubles soumissions : verrou synchrone, état de chargement, puis
 * exécution. L'écran de résultat n'apparaît qu'après le délai, si bien que le
 * second clic d'un double-clic ne peut pas atteindre le bouton suivant.
 */
export function useBusy(defaultDelay = 450) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const run = useCallback(
    async (fn: () => void | Promise<void>, minDelay = defaultDelay) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        await new Promise((r) => setTimeout(r, minDelay));
        await fn();
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [defaultDelay],
  );
  return { busy, run };
}

export function useChartColors() {
  const theme = useResolvedTheme();
  // Palette validée (séparation daltonisme et contraste) pour chaque thème.
  return theme === 'dark'
    ? { violet: '#8A6CFF', orange: '#C97F22', green: '#1FA872', blue: '#4F8CF5', red: '#E0566A', grid: '#302E3E', axis: '#A0A0AC', surface: '#1B1B23' }
    : { violet: '#7656F6', orange: '#D6851F', green: '#1E9E66', blue: '#4285F4', red: '#D93A50', grid: '#ECEAF3', axis: '#7A7A86', surface: '#FFFFFF' };
}
