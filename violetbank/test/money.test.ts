import { describe, expect, it } from 'vitest';
import { centsToDecimal, centsToInput, formatMoney, formatRate, parseAmount, roundHalfUp, sumCents } from '../src/domain/money';

describe('parseAmount', () => {
  it('accepte les formats français et anglais', () => {
    expect(parseAmount('12,50')).toEqual({ ok: true, cents: 1250 });
    expect(parseAmount('12.5')).toEqual({ ok: true, cents: 1250 });
    expect(parseAmount('1 234,56 €')).toEqual({ ok: true, cents: 123456 });
    expect(parseAmount('100')).toEqual({ ok: true, cents: 10000 });
    expect(parseAmount('0,01')).toEqual({ ok: true, cents: 1 });
  });
  it('refuse les montants invalides', () => {
    expect(parseAmount('-5').ok).toBe(false);
    expect(parseAmount('0').ok).toBe(false);
    expect(parseAmount('0,00').ok).toBe(false);
    expect(parseAmount('').ok).toBe(false);
    expect(parseAmount('abc').ok).toBe(false);
    expect(parseAmount('1,234').ok).toBe(false);
    expect(parseAmount('1e5').ok).toBe(false);
    expect(parseAmount('10000000').ok).toBe(false);
  });
  it('respecte min et max', () => {
    expect(parseAmount('5', { min: 1000 }).ok).toBe(false);
    expect(parseAmount('50', { max: 4000 }).ok).toBe(false);
    expect(parseAmount('0', { allowZero: true })).toEqual({ ok: true, cents: 0 });
  });
});

describe('arrondis et formats', () => {
  it('arrondit demi vers le haut, y compris les artefacts binaires', () => {
    expect(roundHalfUp(0.285 * 100)).toBe(29);
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
    expect(roundHalfUp(0)).toBe(0);
  });
  it('additionne des centimes sans erreur flottante', () => {
    expect(sumCents([10, 20, 30])).toBe(60);
    // 0,1 + 0,2 en euros flottants donnerait 0,30000000000000004
    expect(sumCents([10, 20])).toBe(30);
  });
  it('formate', () => {
    expect(formatMoney(1245075).replace(/\s/g, ' ')).toBe('12 450,75 €');
    expect(formatMoney(500, { signed: true }).startsWith('+')).toBe(true);
    expect(formatMoney(500, { hidden: true })).toContain('••••');
    expect(centsToInput(123405)).toBe('1234,05');
    expect(centsToDecimal(-5)).toBe('-0.05');
    expect(formatRate(600)).toBe('6,00 %');
  });
});
