import clsx from 'clsx';
import type { Character, CharacterStatus } from '../../lib/types';

const STATUS_COLOR: Record<CharacterStatus, string> = {
  online: 'bg-ok',
  away: 'bg-warn',
  busy: 'bg-danger',
  offline: 'bg-faint',
};

export const STATUS_LABEL: Record<CharacterStatus, string> = {
  online: 'En ligne',
  away: 'Absent·e',
  busy: 'Occupé·e',
  offline: 'Hors ligne',
};

interface Props {
  character?: Pick<Character, 'firstName' | 'lastName' | 'avatarColor' | 'avatarEmoji' | 'avatarUrl' | 'status' | 'isActive'> | null;
  size?: number;
  showStatus?: boolean;
  className?: string;
}

/** Avatar : image si fournie, sinon initiales sur dégradé de la couleur du personnage. */
export function Avatar({ character, size = 40, showStatus = false, className }: Props) {
  const initials = character ? `${character.firstName[0] ?? ''}${character.lastName[0] ?? ''}`.toUpperCase() : '?';
  const color = character?.avatarColor ?? '#64748b';
  const dot = Math.max(8, Math.round(size * 0.26));
  return (
    <div className={clsx('relative shrink-0', className)} style={{ width: size, height: size }}>
      {character?.avatarUrl ? (
        <img src={character.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        <div
          aria-hidden
          className={clsx('flex h-full w-full select-none items-center justify-center rounded-full font-semibold text-white', !character?.isActive && 'grayscale')}
          style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, fontSize: size * 0.38 }}
        >
          {initials}
        </div>
      )}
      {character?.avatarEmoji && size >= 40 && (
        <span aria-hidden className="absolute -left-1 -top-1 select-none text-[13px] drop-shadow" style={{ fontSize: Math.max(11, size * 0.3) }}>
          {character.avatarEmoji}
        </span>
      )}
      {showStatus && character && (
        <span
          title={STATUS_LABEL[character.status]}
          className={clsx('absolute bottom-0 right-0 rounded-full ring-2 ring-panel', STATUS_COLOR[character.status])}
          style={{ width: dot, height: dot }}
        />
      )}
    </div>
  );
}
