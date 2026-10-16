import { useId } from 'react';
import { useActiveAccounts, useBalances, useMoney } from '../lib/hooks';
import { Field, Select } from './ui';

export function AccountSelect({ value, onChange, label = 'Compte', exclude, error, hint }: { value: string; onChange: (id: string) => void; label?: string; exclude?: string; error?: string | null; hint?: React.ReactNode }) {
  const accounts = useActiveAccounts();
  const balances = useBalances();
  const money = useMoney();
  const id = useId();
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {accounts
          .filter((a) => a.id !== exclude)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} — {money(balances.accounts.get(a.id) ?? 0)}
            </option>
          ))}
      </Select>
    </Field>
  );
}
