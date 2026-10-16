import clsx from 'clsx';
import { useId } from 'react';
import { parseAmount, centsToInput, type Cents } from '../domain/money';
import { useBank } from '../store/bank';
import { Field } from './ui';

const SYMBOL = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF' } as const;

/** Champ de montant : la saisie reste textuelle (pas de flottant), l'analyse se fait en centimes. */
export function AmountInput({
  value,
  onChange,
  label = 'Montant',
  error,
  hint,
  presets,
  autoFocus,
  name = 'amount',
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  error?: string | null;
  hint?: React.ReactNode;
  presets?: Cents[];
  autoFocus?: boolean;
  name?: string;
}) {
  const id = useId();
  const currency = useBank((s) => s.state.settings.currency);
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          name={name}
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder="0,00"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,\s]/g, ''))}
          aria-invalid={!!error || undefined}
          className={clsx('input num h-16 pr-14 text-3xl font-bold tracking-tight', error && 'border-danger focus:border-danger focus:ring-danger/15')}
        />
        <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted">{SYMBOL[currency]}</span>
      </div>
      {presets && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(centsToInput(p))}
              className={clsx(
                'rounded-xl border px-3 py-1.5 text-sm font-semibold transition',
                parseAmount(value).ok && (parseAmount(value) as { cents: number }).cents === p ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line hover:border-brand/50 hover:bg-raised',
              )}
            >
              {p / 100} {SYMBOL[currency]}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

export const DEPOSIT_PRESETS: Cents[] = [1_000, 2_500, 5_000, 10_000, 25_000, 50_000];
