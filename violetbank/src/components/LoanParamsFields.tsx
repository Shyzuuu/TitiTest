import clsx from 'clsx';
import { useId } from 'react';
import { centsToInput, formatMoney } from '../domain/money';
import { durationOptions, type useLoanParams } from '../lib/loanParams';
import { REPAYMENT_MODE_LABEL } from '../lib/labels';
import { useBank } from '../store/bank';
import { AmountInput } from './AmountInput';
import { Callout, Field, Segmented, Select, TextInput } from './ui';

type Ctl = ReturnType<typeof useLoanParams>;

export function ProductSelect({ ctl }: { ctl: Ctl }) {
  const products = useBank((s) => s.state.loanProducts).filter((p) => p.enabled);
  const id = useId();
  return (
    <Field label="Scénario de prêt" htmlFor={id}>
      <Select id={id} value={ctl.params.productId} onChange={(e) => ctl.selectProduct(e.target.value)}>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function AmountField({ ctl }: { ctl: Ctl }) {
  const { product, amount } = ctl;
  const sliderMin = product?.minAmount ?? 10_000;
  const sliderMax = product?.maxAmount ?? 5_000_000;
  const step = sliderMax - sliderMin > 1_000_000 ? 10_000 : sliderMax - sliderMin > 100_000 ? 5_000 : 1_000;
  const value = amount.ok ? Math.min(sliderMax, Math.max(sliderMin, amount.cents)) : sliderMin;
  return (
    <div>
      <AmountInput
        label="Montant fictif souhaité"
        value={ctl.params.amount}
        onChange={(v) => ctl.setParams((s) => ({ ...s, amount: v }))}
        error={ctl.errors.amount ?? ctl.errors.minPerMonth}
        hint={product ? `Limites du scénario : ${formatMoney(product.minAmount)} – ${formatMoney(product.maxAmount)}` : undefined}
      />
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={step}
        value={value}
        onChange={(e) => ctl.setParams((s) => ({ ...s, amount: centsToInput(Number(e.target.value)) }))}
        className="mt-3 w-full accent-[rgb(var(--brand))]"
        aria-label="Curseur du montant"
      />
      {ctl.outOfLimits && <Callout tone="warn" className="mt-2">Montant hors des limites de ce scénario : la demande serait refusée dans la simulation.</Callout>}
    </div>
  );
}

export function DurationField({ ctl }: { ctl: Ctl }) {
  const options = durationOptions(ctl.product);
  return (
    <div>
      <span className="label">Durée</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Durée en mois">
        {options.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={ctl.params.months === m}
            onClick={() => ctl.setParams((s) => ({ ...s, months: m }))}
            className={clsx('rounded-xl border px-3.5 py-2 text-sm font-semibold transition', ctl.params.months === m ? 'border-brand bg-brand text-white' : 'border-line hover:border-brand/50')}
          >
            {m} mois
          </button>
        ))}
      </div>
      {ctl.errors.months && <p className="mt-1.5 text-sm font-medium text-danger">{ctl.errors.months}</p>}
    </div>
  );
}

export function RateAndDateFields({ ctl, showMode = true }: { ctl: Ctl; showMode?: boolean }) {
  const rateId = useId();
  const dateId = useId();
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Taux annuel nominal fictif (%)" error={ctl.errors.rate} hint="Hypothétique, modifiable librement." htmlFor={rateId}>
          <TextInput id={rateId} inputMode="decimal" value={ctl.params.rate} onChange={(e) => ctl.setParams((s) => ({ ...s, rate: e.target.value }))} invalid={!!ctl.errors.rate} />
        </Field>
        <Field label="Date théorique de début" htmlFor={dateId} hint="1re échéance un mois plus tard.">
          <TextInput id={dateId} type="date" value={ctl.params.startDate} onChange={(e) => e.target.value && ctl.setParams((s) => ({ ...s, startDate: e.target.value }))} />
        </Field>
      </div>
      {showMode && (
        <div>
          <span className="label">Mode de remboursement</span>
          <Segmented
            label="Mode de remboursement"
            value={ctl.params.mode}
            onChange={(mode) => ctl.setParams((s) => ({ ...s, mode }))}
            options={[
              { value: 'annuity', label: REPAYMENT_MODE_LABEL.annuity },
              { value: 'constant_principal', label: 'Capital constant' },
            ]}
          />
        </div>
      )}
    </div>
  );
}
