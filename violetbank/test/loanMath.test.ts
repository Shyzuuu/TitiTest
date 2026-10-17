import { describe, expect, it } from 'vitest';
import { amortize, annuityPayment, monthlyRate, quoteLoan, summarize } from '../src/domain/loanMath';

describe('formule de mensualité', () => {
  it('exemple de référence : 1 000 € / 12 mois / 6 %', () => {
    const q = quoteLoan({ principal: 100_000, annualRateBps: 600, months: 12, mode: 'annuity', startDate: '2026-01-15' });
    expect(q.monthlyRate).toBeCloseTo(0.005, 12);
    expect(q.firstPayment).toBe(8_607);
    expect(q.count).toBe(12);
    expect(q.totalPrincipal).toBe(100_000);
    // 12 × 86,07 = 1 032,84 € (total théorique naïf) ; l'échéancier réel ajuste la
    // dernière échéance à 86,03 € pour solder exactement le capital : 1 032,80 €.
    expect(q.firstPayment * 12).toBe(103_284);
    expect(q.lastPayment).toBe(8_603);
    expect(q.totalAmount).toBe(103_280);
    expect(q.totalInterest).toBe(3_280);
    expect(q.totalInterest).toBe(q.totalAmount - 100_000);
    expect(q.rows.reduce((s, r) => s + r.amount, 0)).toBe(q.totalAmount);
  });

  it('applique P × r / (1 − (1 + r)^−n)', () => {
    const r = monthlyRate(550);
    const expected = (500_000 * r) / (1 - Math.pow(1 + r, -36));
    expect(annuityPayment(500_000, r, 36)).toBe(Math.round(expected));
  });

  it('taux nul : P / n et dernière échéance ajustée', () => {
    const rows = amortize({ principal: 100_000, rate: 0, mode: 'annuity', count: 3 });
    expect(rows.map((r) => r.amount)).toEqual([33_333, 33_333, 33_334]);
    expect(rows.every((r) => r.interest === 0)).toBe(true);
    expect(rows.at(-1)?.balanceAfter).toBe(0);
  });

  it('dernière échéance : capital restant exactement nul, arrondis absorbés', () => {
    for (const [p, bps, n] of [[123_457, 735, 17], [99_999, 1999, 60], [10_000, 1, 3], [5_000_000, 600, 60]] as const) {
      const rows = amortize({ principal: p, rate: monthlyRate(bps), mode: 'annuity', count: n });
      expect(rows).toHaveLength(n);
      expect(rows.at(-1)?.balanceAfter).toBe(0);
      expect(summarize(rows).totalPrincipal).toBe(p);
      const payment = rows[0]?.amount ?? 0;
      // Seule la dernière échéance peut différer de quelques centimes.
      for (const r of rows.slice(0, -1)) expect(r.amount).toBe(payment);
      expect(Math.abs((rows.at(-1)?.amount ?? 0) - payment)).toBeLessThanOrEqual(n);
      for (const r of rows) {
        expect(Number.isInteger(r.principal)).toBe(true);
        expect(Number.isInteger(r.interest)).toBe(true);
      }
    }
  });

  it('capital constant', () => {
    const rows = amortize({ principal: 120_000, rate: monthlyRate(600), mode: 'constant_principal', count: 12 });
    expect(rows.every((r) => r.principal === 10_000)).toBe(true);
    expect(rows[0]?.interest).toBe(600);
    expect(rows.at(-1)?.interest).toBe(50);
    expect(rows.at(-1)?.balanceAfter).toBe(0);
  });

  it('mensualité imposée : durée déduite', () => {
    const rows = amortize({ principal: 50_000, rate: monthlyRate(600), mode: 'annuity', fixedPayment: 8_607 });
    expect(rows.length).toBe(6);
    expect(rows.at(-1)?.balanceAfter).toBe(0);
    expect(() => amortize({ principal: 100_000, rate: monthlyRate(1200), mode: 'annuity', fixedPayment: 1_000 })).toThrow();
  });

  it('dates d’échéance depuis la date de début (fin de mois)', () => {
    const q = quoteLoan({ principal: 60_000, annualRateBps: 500, months: 4, mode: 'annuity', startDate: '2026-01-31' });
    expect(q.rows.map((r) => r.dueDate)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('refuse les entrées invalides', () => {
    expect(() => annuityPayment(0, 0.01, 12)).toThrow();
    expect(() => annuityPayment(1000, 0.01, 0)).toThrow();
    expect(() => amortize({ principal: 1.5, rate: 0, mode: 'annuity', count: 2 })).toThrow();
  });
});
