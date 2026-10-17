import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMoney } from '../lib/hooks';
import { useBank } from '../store/bank';

/**
 * Anime un montant de son ancienne valeur vers la nouvelle (easing cubique).
 * Désactivé si les animations sont coupées ou si le système demande moins de mouvement.
 */
export function useCountUp(target: number, duration = 650): number {
  const animations = useBank((s) => s.state.settings.animations);
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = !animations || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || from.current === target) {
      from.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(origin + (target - origin) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, duration, animations]);
  return value;
}

/** Montant en grand, centimes et devise réduits en exposant. */
export function BigAmount({ text }: { text: string }) {
  const m = /^(.*?)([,.]\d{2})(\s*\S+)$/.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <span className="text-[0.55em] align-[0.62em]">{m[2]}</span>
      <span className="ml-1 text-[0.55em] align-[0.62em]">{m[3]?.trim()}</span>
    </>
  );
}

export function HeroAmount({ cents, sensitive = true, testId, className }: { cents: number; sensitive?: boolean; testId?: string; className?: string }) {
  const money = useMoney();
  const hidden = useBank((s) => s.state.settings.balanceHidden) && sensitive;
  const animated = useCountUp(cents);
  // Les tests lisent la valeur finale : l'attribut porte toujours le montant exact.
  return (
    <span className={clsx('num block font-extrabold leading-tight tracking-tight', className)} data-testid={testId} data-cents={cents}>
      {hidden ? money(cents, { sensitive: true }) : <BigAmount text={money(animated)} />}
    </span>
  );
}

export interface RoundAction {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  to?: string;
  aria?: string;
  tone?: 'default' | 'danger' | 'active';
}

export function RoundActions({ actions, onHero = true }: { actions: RoundAction[]; onHero?: boolean }) {
  return (
    <div className={clsx('grid w-full gap-2', actions.length >= 4 ? 'grid-cols-4' : actions.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {actions.map((a) => {
        const inner = (
          <>
            <span
              className={clsx(
                'flex h-14 w-14 items-center justify-center rounded-full backdrop-blur transition active:scale-95',
                onHero ? 'bg-white/25 text-white hover:bg-white/35' : 'bg-raised text-ink hover:bg-line',
                a.tone === 'active' && 'bg-white text-brand-deep hover:bg-white',
                a.tone === 'danger' && (onHero ? 'bg-white/15 text-[#FFD0D6]' : 'text-danger'),
              )}
            >
              <a.icon size={24} aria-hidden />
            </span>
            <span className="max-w-[92px]">{a.label}</span>
          </>
        );
        const cls = clsx('flex flex-col items-center gap-2 text-[14px] font-semibold leading-tight', onHero ? 'text-white' : 'text-ink');
        return a.to ? (
          <Link key={a.label} to={a.to} aria-label={a.aria} className={cls}>
            {inner}
          </Link>
        ) : (
          <button key={a.label} type="button" onClick={a.onClick} aria-label={a.aria} className={cls}>
            {inner}
          </button>
        );
      })}
    </div>
  );
}

export function HeroPill({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="rounded-full bg-white/25 px-6 py-3 text-[16px] font-semibold text-white backdrop-blur transition hover:bg-white/35">
      {children}
    </Link>
  );
}

/** Section d'en-tête posée sur le dégradé plein écran de l'AppShell. */
export function Hero({ eyebrow, title, children, className }: { eyebrow: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('flex flex-col items-center pt-6 text-center text-white', className)}>
      <h1 className="sr-only">{title}</h1>
      <p className="text-[17px] font-semibold text-white/90">{eyebrow}</p>
      {children}
    </section>
  );
}

/** Bloc arrondi standard des écrans principaux. */
export function Widget({ title, to, action, children, className }: { title?: string; to?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-[28px] border border-line/60 bg-surface p-5 shadow-soft', className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title &&
            (to ? (
              <Link to={to} className="inline-flex items-center gap-1 text-[15px] font-semibold text-muted hover:text-ink">
                {title}
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ) : (
              <h2 className="text-[15px] font-semibold text-muted">{title}</h2>
            ))}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
