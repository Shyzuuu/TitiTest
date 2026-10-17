import clsx from 'clsx';
import logoUrl from '../assets/violetbank-logo.webp';

export const APP_NAME = 'VIOLETBANK';

/** Icône carrée VIOLETBANK (même visuel que l'icône de l'application Android). */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return <img src={logoUrl} width={size} height={size} alt="" aria-hidden className={clsx('shrink-0 rounded-[24%] object-cover', className)} draggable={false} />;
}

/** Nom horizontal : « VIOLET » en couleur courante, « BANK » en violet (lisible sur fond clair et sombre). */
export function Wordmark({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={clsx('font-extrabold tracking-[0.08em]', className)}>
      VIOLET<span className={onDark ? 'text-[#C9B8FF]' : 'text-brand'}>BANK</span>
    </span>
  );
}

export function Logo({ compact, onDark }: { compact?: boolean; onDark?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5" aria-label={APP_NAME}>
      <LogoMark />
      {!compact && <Wordmark className="truncate text-[17px]" onDark={onDark} />}
    </span>
  );
}
