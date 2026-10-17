import clsx from 'clsx';
import logoUrl from '../assets/violetbank-logo.webp';

export const APP_NAME = 'VBanque';
export const APP_AUTHOR = 'Titi';
export const APP_VERSION = '2.0.0';

/** Icône carrée VBanque (même visuel que l'icône de l'application Android). */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return <img src={logoUrl} width={size} height={size} alt="" aria-hidden className={clsx('shrink-0 rounded-[24%] object-cover', className)} draggable={false} />;
}

/** Nom horizontal : « V » en violet, « Banque » en couleur courante (lisible sur fond clair et sombre). */
export function Wordmark({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={clsx('font-extrabold tracking-tight', className)}>
      <span className={onDark ? 'text-[#C9B8FF]' : 'text-brand'}>V</span>Banque
    </span>
  );
}

/** Crédit de l'auteur, affiché sous le nom de l'application. */
export function Credit({ className }: { className?: string }) {
  return <span className={clsx('text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70', className)}>par {APP_AUTHOR}</span>;
}

export function Logo({ compact, onDark }: { compact?: boolean; onDark?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5" aria-label={APP_NAME}>
      <LogoMark />
      {!compact && (
        <span className="flex min-w-0 flex-col leading-tight">
          <Wordmark className="truncate text-[19px]" onDark={onDark} />
          <Credit />
        </span>
      )}
    </span>
  );
}
