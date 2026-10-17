import { describe, expect, it } from 'vitest';
import { addDays, addMonths, diffDays, isISODate } from '../src/domain/dates';

describe('dates de simulation', () => {
  it('borne les fins de mois sans dériver', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-01-31', 3)).toBe('2026-04-30');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-05-10', 24)).toBe('2028-05-10');
  });
  it('ajoute des jours et calcule les écarts', () => {
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(diffDays('2026-01-01', '2026-03-01')).toBe(59);
  });
  it('valide les dates', () => {
    expect(isISODate('2026-02-29')).toBe(false);
    expect(isISODate('2028-02-29')).toBe(true);
    expect(isISODate('2026-13-01')).toBe(false);
    expect(isISODate('hello')).toBe(false);
  });
});
