import clsx from 'clsx';
import { Lock } from 'lucide-react';
import { useState, type CSSProperties, type PointerEvent } from 'react';
import { demoExpiry } from '../domain/cards';
import type { VirtualCard } from '../domain/schema';
import { useBank } from '../store/bank';
import { LogoMark } from './Logo';

function background(card: Pick<VirtualCard, 'color' | 'accent' | 'style'>): string {
  switch (card.style) {
    case 'aurora':
      return `radial-gradient(120% 120% at 0% 0%, ${card.color} 0%, transparent 55%), radial-gradient(120% 120% at 100% 100%, ${card.accent} 0%, transparent 60%), linear-gradient(135deg, #2a1f63, #101014)`;
    case 'metal':
      return `linear-gradient(135deg, ${card.color} 0%, #2b2b35 45%, ${card.color} 100%), repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 2px, transparent 2px 4px)`;
    case 'minimal':
      return `linear-gradient(160deg, ${card.color}, ${card.color})`;
    default:
      return `linear-gradient(135deg, ${card.color} 0%, ${card.accent} 100%)`;
  }
}

/** Puce dessinée et symbole sans contact purement décoratifs. */
function Chip() {
  return (
    <svg width="42" height="32" viewBox="0 0 42 32" aria-hidden>
      <rect x="1" y="1" width="40" height="30" rx="6" fill="#E8D9A8" stroke="#BFA867" />
      <path d="M1 11h12m16 0h12M1 21h12m16 0h12M13 1v30m16-30v30M13 11h16v10H13z" stroke="#A88F4E" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function Contactless() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="opacity-80">
      <path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a10 10 0 0 1 0 14M15.5 2.5a14 14 0 0 1 0 19" />
    </svg>
  );
}

export interface CardPreview {
  name: string;
  color: string;
  accent: string;
  style: VirtualCard['style'];
  avatar: string | null;
  holderName: string;
  demoId: string;
  createdAt: string;
  locked: boolean;
  kind?: 'standard' | 'disposable';
}

export function VirtualCardView({ card, flippable = true, className, tilt = true }: { card: CardPreview; flippable?: boolean; className?: string; tilt?: boolean }) {
  const enabled = useBank((s) => s.state.settings.cardAnimations && s.state.settings.animations);
  const [flipped, setFlipped] = useState(false);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const light = card.style === 'minimal' && /^#(?:[c-fC-F])/.test(card.color);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || !tilt || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    setRot({ x: ((e.clientY - r.top) / r.height - 0.5) * -10, y: ((e.clientX - r.left) / r.width - 0.5) * 12 });
  };
  const style: CSSProperties = {
    transform: `perspective(900px) rotateX(${rot.x}deg) rotateY(${(flipped ? 180 : 0) + rot.y}deg)`,
  };

  const face = 'card-face absolute inset-0 overflow-hidden rounded-[22px] p-5 shadow-lift';
  return (
    <div className={clsx('relative aspect-[1.586] w-full max-w-[380px] select-none', className)} onPointerMove={onMove} onPointerLeave={() => setRot({ x: 0, y: 0 })}>
      <div
        className={clsx('card-3d relative h-full w-full', flippable && 'cursor-pointer')}
        style={enabled ? style : { transform: flipped ? 'rotateY(180deg)' : undefined }}
        onClick={() => flippable && setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (flippable && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        role={flippable ? 'button' : undefined}
        tabIndex={flippable ? 0 : undefined}
        aria-label={flippable ? `Carte ${card.name} : ${flipped ? 'afficher le recto' : 'retourner la carte'}` : undefined}
      >
        <div className={clsx(face, light ? 'text-[#101014]' : 'text-white')} style={{ background: background(card) }}>
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <LogoMark size={28} />
              <span className="text-sm font-bold opacity-90">{card.name}</span>
            </div>
            <span className="flex items-center gap-1.5">
              {card.kind === 'disposable' && <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider">JETABLE</span>}
              <span className="rounded-md border border-current px-1.5 py-0.5 text-[10px] font-black tracking-[.2em] opacity-90">DEMO</span>
            </span>
          </div>
          <div className="mt-[7%] flex items-center gap-3">
            <Chip />
            <Contactless />
            {card.avatar && <span className="ml-auto text-2xl">{card.avatar}</span>}
          </div>
          <div className="absolute inset-x-5 bottom-4">
            <p className="num font-mono text-[clamp(13px,4.2vw,18px)] tracking-[.18em] opacity-95">{card.demoId}</p>
            <div className="mt-1.5 flex items-end justify-between gap-2 text-[11px] uppercase tracking-wider opacity-80">
              <span className="truncate">{card.holderName}</span>
              <span className="shrink-0">Exp. démo {demoExpiry(card)}</span>
            </div>
          </div>
          {card.locked && (
            <div className="absolute inset-0 flex animate-fade flex-col items-center justify-center gap-2 bg-[#101014]/55 backdrop-blur-[2px]">
              <span className="flex h-12 w-12 animate-pop items-center justify-center rounded-full bg-white/15">
                <Lock size={22} className="text-white" aria-hidden />
              </span>
              <span className="text-sm font-bold text-white">Carte verrouillée</span>
            </div>
          )}
        </div>
        <div className={clsx(face, 'text-white')} style={{ background: '#19191F', transform: 'rotateY(180deg)' }}>
          <div className="absolute inset-x-0 top-6 h-10 bg-black/70" />
          <div className="mt-16 flex items-center gap-3">
            <div className="h-8 flex-1 rounded bg-white/85" />
            <span className="rounded bg-white px-2 py-1 font-mono text-sm font-bold text-[#101014]">DEMO</span>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-white/70">
            Carte de démonstration sans valeur. Identifiant fictif, non rattaché à un réseau de paiement. Aucun paiement réel n’est possible.
          </p>
          <p className="absolute bottom-4 right-5 text-[10px] font-bold tracking-[.25em] text-white/60">SIMULATION</p>
        </div>
      </div>
    </div>
  );
}
