import { useMemo, useState } from 'react';
import { DURATION_PRESETS } from '../domain/loans';
import { quoteLoan, type LoanQuote, type RepaymentMode } from '../domain/loanMath';
import { centsToInput, parseAmount } from '../domain/money';
import type { LoanProduct } from '../domain/schema';

export function parseRate(input: string): { ok: true; bps: number } | { ok: false; error: string } {
  const s = input.trim().replace(',', '.').replace('%', '').trim();
  if (!/^\d{1,2}(\.\d{0,2})?$/.test(s)) return { ok: false, error: 'Taux invalide (ex. 5,90).' };
  const [i = '0', d = ''] = s.split('.');
  const bps = Number(i) * 100 + Number((d + '00').slice(0, 2));
  if (bps > 5000) return { ok: false, error: 'Taux fictif maximum : 50 %.' };
  return { ok: true, bps };
}

export function bpsToInput(bps: number): string {
  return `${Math.floor(bps / 100)},${String(bps % 100).padStart(2, '0')}`;
}

export function durationOptions(product: LoanProduct | undefined): number[] {
  if (!product) return [...DURATION_PRESETS];
  const opts: number[] = DURATION_PRESETS.filter((d) => d >= product.minMonths && d <= product.maxMonths);
  if (!opts.length) opts.push(product.minMonths);
  return opts;
}

export interface LoanParamsState {
  productId: string;
  amount: string;
  months: number;
  rate: string;
  startDate: string;
  mode: RepaymentMode;
}

export interface LoanParamsInit {
  products: LoanProduct[];
  today: string;
  query?: URLSearchParams;
}

/** État des paramètres de simulation, initialisable depuis l'URL et recalculé à chaque saisie. */
export function useLoanParams({ products, today, query }: LoanParamsInit) {
  const [params, setParams] = useState<LoanParamsState>(() => {
    const product = products.find((p) => p.id === query?.get('produit')) ?? products.find((p) => p.id === 'prd_custom') ?? products[0];
    const amountQ = Number(query?.get('montant'));
    const monthsQ = Number(query?.get('duree'));
    const rateQ = Number(query?.get('taux'));
    const amount = Number.isSafeInteger(amountQ) && amountQ > 0 ? amountQ : Math.min(product?.maxAmount ?? 100_000, Math.max(product?.minAmount ?? 0, 100_000));
    const months = Number.isInteger(monthsQ) && monthsQ > 0 ? monthsQ : Math.min(product?.maxMonths ?? 12, Math.max(product?.minMonths ?? 12, 12));
    const start = query?.get('debut');
    return {
      productId: product?.id ?? '',
      amount: centsToInput(amount),
      months,
      rate: bpsToInput(Number.isInteger(rateQ) && rateQ >= 0 && rateQ <= 5000 && query?.has('taux') ? rateQ : product?.annualRateBps ?? 600),
      startDate: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : today,
      mode: query?.get('mode') === 'constant_principal' ? 'constant_principal' : 'annuity',
    };
  });
  const product = products.find((p) => p.id === params.productId);
  const amount = parseAmount(params.amount);
  const rate = parseRate(params.rate);

  const errors = {
    amount: !amount.ok ? amount.error : null,
    rate: !rate.ok ? rate.error : null,
    months: product && (params.months < product.minMonths || params.months > product.maxMonths) ? `Durée entre ${product.minMonths} et ${product.maxMonths} mois pour ce scénario.` : null,
    minPerMonth: amount.ok && amount.cents < params.months * 100 ? 'Montant trop faible pour cette durée (1,00 minimum par mensualité).' : null,
  };
  const outOfLimits = product && amount.ok ? amount.cents < product.minAmount || amount.cents > product.maxAmount : false;

  const quote: LoanQuote | null = useMemo(() => {
    if (!amount.ok || !rate.ok || errors.minPerMonth || !/^\d{4}-\d{2}-\d{2}$/.test(params.startDate)) return null;
    try {
      return quoteLoan({ principal: amount.cents, annualRateBps: rate.bps, months: params.months, mode: params.mode, startDate: params.startDate });
    } catch {
      return null;
    }
  }, [amount.ok, amount.ok ? amount.cents : 0, rate.ok, rate.ok ? rate.bps : 0, params.months, params.mode, params.startDate, errors.minPerMonth]);

  const selectProduct = (id: string) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setParams((s) => {
      const current = parseAmount(s.amount);
      const clamped = current.ok ? Math.min(p.maxAmount, Math.max(p.minAmount, current.cents)) : p.minAmount;
      return { ...s, productId: id, amount: centsToInput(clamped), months: Math.min(p.maxMonths, Math.max(p.minMonths, s.months)), rate: bpsToInput(p.annualRateBps) };
    });
  };

  const toQuery = (): string => {
    const q = new URLSearchParams();
    q.set('produit', params.productId);
    if (amount.ok) q.set('montant', String(amount.cents));
    q.set('duree', String(params.months));
    if (rate.ok) q.set('taux', String(rate.bps));
    q.set('debut', params.startDate);
    q.set('mode', params.mode);
    return q.toString();
  };

  return { params, setParams, product, amount, rate, errors, outOfLimits, quote, selectProduct, toQuery };
}
