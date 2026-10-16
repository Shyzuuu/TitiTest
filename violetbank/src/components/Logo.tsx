import { useId } from 'react';
import { useBank } from '../store/bank';

/** Logo original : hexagone facetté violet et chevron, sans lien avec une marque existante. */
export function LogoMark({ size = 36 }: { size?: number }) {
  // Identifiant unique par instance : un dégradé défini dans un SVG masqué (display:none) ne s'applique pas ailleurs.
  const gradientId = `vb-logo-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B9A7FF" />
          <stop offset=".5" stopColor="#7656F6" />
          <stop offset="1" stopColor="#4930B5" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="#101014" />
      <path d="M32 9 53 21v22L32 55 11 43V21z" fill={`url(#${gradientId})`} />
      <path d="M32 9v46M11 21l42 22M53 21 11 43" stroke="#fff" strokeOpacity=".3" strokeWidth="1.5" />
      <path d="m22 26 10 18 10-18" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  const name = useBank((s) => s.state.settings.appName);
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <LogoMark />
      {!compact && <span className="truncate text-[17px] font-extrabold tracking-tight">{name}</span>}
    </span>
  );
}
