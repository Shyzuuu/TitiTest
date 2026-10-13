import clsx from 'clsx';
import { AlertTriangle, Bell, Bot, CheckCheck, MessageCircle, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { Empty } from '../components/ui/Empty';
import { del, post } from '../lib/api';
import { formatListTime } from '../lib/format';
import type { AppNotification } from '../lib/types';
import { useStore } from '../store/store';

const ICONS: Record<AppNotification['type'], typeof Bell> = {
  new_message: MessageCircle,
  ai_suggestion: Sparkles,
  ai_confirmation: ShieldAlert,
  ai_auto_sent: Bot,
  ai_error: AlertTriangle,
  task_failed: AlertTriangle,
};

export function NotificationsPage() {
  const items = useStore((s) => s.notifications);
  const conversations = useStore((s) => s.conversations);
  const characters = useStore((s) => s.characters);
  const unread = useStore((s) => s.unreadNotifications);
  const navigate = useNavigate();

  const open = (n: AppNotification) => {
    if (!n.readAt) void post(`/notifications/${n.id}/read`).catch(() => undefined);
    // Chaque notification ouvre SA conversation (identifiant stable porté par la notification).
    if (n.conversationId && conversations[n.conversationId]) navigate(`/chats/${n.conversationId}${n.messageId ? `?m=${n.messageId}` : ''}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} non lue(s)` : 'Tout est lu'}
        actions={
          unread > 0 && (
            <button className="btn-ghost text-xs" onClick={() => void post('/notifications/read-all')}>
              <CheckCheck size={15} /> Tout marquer comme lu
            </button>
          )
        }
      />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2 sm:p-4">
        {items.length === 0 ? (
          <Empty icon={<Bell size={26} />} title="Aucune notification">
            Les nouveaux messages, suggestions et réponses de l’IA apparaîtront ici.
          </Empty>
        ) : (
          <ul className="mx-auto max-w-3xl space-y-1.5">
            {items.map((n) => {
              const conv = n.conversationId ? conversations[n.conversationId] : undefined;
              const character = conv ? characters[conv.characterId] : undefined;
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    data-testid="notification"
                    data-conversation-id={n.conversationId ?? ''}
                    onClick={() => open(n)}
                    onKeyDown={(e) => e.key === 'Enter' && open(n)}
                    className={clsx(
                      'group flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition',
                      n.readAt ? 'border-transparent hover:bg-raised' : 'border-accent/30 bg-accent/5 hover:bg-accent/10',
                    )}
                  >
                    <div className="relative">
                      <Avatar character={character} size={42} />
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-panel p-1 text-accent">
                        <Icon size={12} />
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={clsx('truncate text-sm', !n.readAt && 'font-semibold')}>{n.title}</span>
                        <span className="shrink-0 text-xs text-faint">{formatListTime(n.updatedAt)}</span>
                      </div>
                      {n.body && <p className="line-clamp-2 text-sm text-muted">{n.body}</p>}
                    </div>
                    <button
                      className="icon-btn h-8 w-8 opacity-100 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label="Supprimer la notification"
                      onClick={(e) => {
                        e.stopPropagation();
                        void del(`/notifications/${n.id}`);
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
