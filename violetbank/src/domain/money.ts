/**
 * Arithmétique monétaire : tous les montants sont des entiers en centimes.
 * Aucun calcul financier ne passe par des euros flottants ; la conversion en
 * unités n'a lieu qu'à l'affichage.
 */

export type Cents = number;

/** Plafond d'une opération unitaire de simulation (1 000 000,00). */
export const MAX_OPERATION_CENTS = 100_000_000;

export const CURRENCIES = {
  EUR: { label: 'Euro (€)', locale: 'fr-FR' },
  USD: { label: 'Dollar US ($)', locale: 'fr-FR' },
  GBP: { label: 'Livre sterling (£)', locale: 'fr-FR' },
  CHF: { label: 'Franc suisse (CHF)', locale: 'fr-FR' },
} as const;
export type CurrencyCode = keyof typeof CURRENCIES;

export function isCents(value: unknown): value is Cents {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function assertCents(value: number, label = 'montant'): void {
  if (!Number.isSafeInteger(value)) throw new Error(`${label} invalide : ${value} n'est pas un entier de centimes`);
}

/**
 * Arrondi commercial (demi vers le haut, symétrique). Le facteur epsilon corrige
 * les représentations binaires du type 0.285 * 100 = 28.499999…
 */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) throw new Error(`Arrondi impossible : ${value}`);
  const sign = value < 0 ? -1 : 1;
  const rounded = Math.round(Math.abs(value) * (1 + Number.EPSILON));
  return rounded === 0 ? 0 : sign * rounded;
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export type ParseResult = { ok: true; cents: Cents } | { ok: false; error: string };

/**
 * Analyse une saisie utilisateur (« 1 234,56 », « 1234.5 », « 12 »).
 * Refuse les négatifs, le zéro, plus de deux décimales et les montants hors plafond.
 */
export function parseAmount(
  input: string,
  opts: { allowZero?: boolean; max?: Cents; min?: Cents } = {},
): ParseResult {
  const raw = (input ?? '').trim().replace(/[\s  ]/g, '').replace(/[€$£]|CHF/gi, '');
  if (raw === '') return { ok: false, error: 'Saisissez un montant.' };
  if (raw.startsWith('-')) return { ok: false, error: 'Le montant ne peut pas être négatif.' };
  const normalized = raw.replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
    return /^\d+\.\d{3,}$/.test(normalized)
      ? { ok: false, error: 'Deux décimales maximum.' }
      : { ok: false, error: 'Montant invalide.' };
  }
  const [intPart = '0', decPart = ''] = normalized.split('.');
  if (intPart.length > 12) return { ok: false, error: 'Montant trop élevé.' };
  const cents = Number(intPart) * 100 + Number((decPart + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return { ok: false, error: 'Montant invalide.' };
  if (cents === 0 && !opts.allowZero) return { ok: false, error: 'Le montant doit être supérieur à zéro.' };
  const max = opts.max ?? MAX_OPERATION_CENTS;
  if (cents > max) return { ok: false, error: `Montant maximum : ${formatMoney(max)}.` };
  if (opts.min !== undefined && cents < opts.min) return { ok: false, error: `Montant minimum : ${formatMoney(opts.min)}.` };
  return { ok: true, cents };
}

const formatterCache = new Map<string, Intl.NumberFormat>();
function formatter(currency: CurrencyCode, decimals: boolean): Intl.NumberFormat {
  const key = `${currency}:${decimals}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(CURRENCIES[currency].locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    });
    formatterCache.set(key, f);
  }
  return f;
}

export interface FormatOptions {
  currency?: CurrencyCode;
  /** Affiche « + » devant les montants positifs. */
  signed?: boolean;
  /** Masque la valeur (préférence « solde masqué »). */
  hidden?: boolean;
  /** Supprime les décimales (axes de graphiques). */
  compact?: boolean;
}

export function formatMoney(cents: Cents, opts: FormatOptions = {}): string {
  const currency = opts.currency ?? 'EUR';
  if (opts.hidden) return '•••• ' + formatter(currency, false).formatToParts(0).find((p) => p.type === 'currency')?.value;
  const text = formatter(currency, !opts.compact).format(cents / 100);
  return opts.signed && cents > 0 ? `+${text}` : text;
}

/** Valeur éditable d'un montant (« 1234,50 ») pour pré-remplir un champ. */
export function centsToInput(cents: Cents): string {
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
  return cents < 0 ? `-${s}` : s;
}

/** Montant décimal à point (« 1234.50 ») pour les exports. */
export function centsToDecimal(cents: Cents): string {
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Taux en points de base (600 = 6,00 %) vers texte. */
export function formatRate(bps: number): string {
  return `${(bps / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}
