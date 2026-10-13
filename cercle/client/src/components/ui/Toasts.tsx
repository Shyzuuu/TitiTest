import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { Avatar } from './Avatar';

/** Notifications éphémères. Un clic ouvre la conversation ; elles ne naviguent jamais d'elles-mêmes. */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const characters = useStore((s) => s.characters);
  const dismiss = useStore((s) => s.dismissToast);
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[60] flex flex-col items-center gap-2 px-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end" aria-live="polite">
      {toasts.map((t) => {
        const character = t.characterId ? characters[t.characterId] : null;
        const clickable = Boolean(t.conversationId);
        return (
          <div
            key={t.id}
            role={clickable ? 'button' : 'status'}
            tabIndex={clickable ? 0 : -1}
            data-testid="toast"
            onClick={() => {
              if (!t.conversationId) return;
              navigate(`/chats/${t.conversationId}${t.messageId ? `?m=${t.messageId}` : ''}`);
              dismiss(t.id);
            }}
            onKeyDown={(e) => e.key === 'Enter' && clickable && (e.currentTarget as HTMLElement).click()}
            className={clsx(
              'pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-2xl border border-line bg-panel/95 p-3 shadow-xl backdrop-blur',
              clickable && 'cursor-pointer hover:border-accent/60',
            )}
          >
            {t.kind === 'message' ? (
              <Avatar character={character} size={36} />
            ) : t.kind === 'error' ? (
              <AlertTriangle className="mt-0.5 shrink-0 text-danger" size={20} />
            ) : t.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 shrink-0 text-ok" size={20} />
            ) : (
              <Info className="mt-0.5 shrink-0 text-accent" size={20} />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{t.title}</div>
              {t.body && <div className="line-clamp-2 text-sm text-muted">{t.body}</div>}
            </div>
            <button
              className="icon-btn -mr-1 -mt-1 h-7 w-7"
              aria-label="Fermer la notification"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(t.id);
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
