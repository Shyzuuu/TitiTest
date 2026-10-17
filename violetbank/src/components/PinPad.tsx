import clsx from 'clsx';
import { Delete } from 'lucide-react';
import { PIN_LENGTH } from '../lib/appLock';

/** Pavé numérique tactile (grandes touches) avec indicateur de saisie. */
export function PinPad({ value, onChange, disabled, error, light }: { value: string; onChange: (v: string) => void; disabled?: boolean; error?: boolean; light?: boolean }) {
  const press = (d: string) => {
    if (disabled) return;
    if (d === 'del') onChange(value.slice(0, -1));
    else if (value.length < PIN_LENGTH) onChange(value + d);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div className="flex flex-col items-center">
      <div className={clsx('mb-8 flex gap-4', error && 'animate-shake')} aria-live="polite" aria-label={`${value.length} chiffre(s) saisi(s) sur ${PIN_LENGTH}`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={clsx('h-4 w-4 rounded-full border-2 transition', light ? 'border-white' : 'border-brand', i < value.length && (light ? 'bg-white' : 'bg-brand'), error && 'border-danger bg-danger')} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {keys.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              disabled={disabled}
              aria-label={k === 'del' ? 'Effacer' : k}
              className={clsx(
                'flex h-[72px] w-[72px] items-center justify-center rounded-full text-[28px] font-semibold transition active:scale-95 disabled:opacity-40',
                light ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-raised text-ink hover:bg-line',
                k === 'del' && 'bg-transparent',
              )}
            >
              {k === 'del' ? <Delete size={26} aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
