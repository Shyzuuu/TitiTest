import clsx from 'clsx';
import { MessagesSquare } from 'lucide-react';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChatView } from '../components/chat/ChatView';
import { ConversationList } from '../components/chat/ConversationList';
import { InfoPanel } from '../components/info/InfoPanel';
import { Empty } from '../components/ui/Empty';
import { useStore } from '../store/store';

/**
 * Messagerie : liste à gauche, conversation au centre, informations à droite.
 * La conversation affichée dépend uniquement de l'URL : aucun événement ne la change.
 */
export function ChatsPage() {
  const { conversationId } = useParams();
  const infoOpen = useStore((s) => s.infoPanelOpen);
  const overlayOpen = useStore((s) => s.infoOverlayOpen);
  const closeInfo = useStore((s) => s.closeInfo);
  const exists = useStore((s) => (conversationId ? Boolean(s.conversations[conversationId]) : false));
  const active = conversationId ?? null;

  // La surimpression appartient à la conversation affichée : elle se ferme quand on en change.
  useEffect(() => {
    useStore.setState({ infoOverlayOpen: false });
  }, [active]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className={clsx('min-h-0 w-full shrink-0 border-r border-line bg-panel md:w-[340px] lg:w-[360px]', active ? 'hidden md:block' : 'block')}>
        <ConversationList activeId={active} />
      </div>
      <div className={clsx('min-h-0 min-w-0 flex-1', active ? 'flex' : 'hidden md:flex')}>
        {active ? (
          <ChatView key={active} conversationId={active} />
        ) : (
          <Empty icon={<MessagesSquare size={26} />} title="Choisissez une conversation">
            Passez librement d’une personne à l’autre : chaque conversation garde son historique, son brouillon et ses réponses en attente.
          </Empty>
        )}
      </div>
      {active && exists && infoOpen && <InfoPanel conversationId={active} onClose={closeInfo} className="hidden w-[340px] shrink-0 xl:flex" />}
      {active && exists && overlayOpen && (
        // Écrans plus étroits : panneau en surimpression, sans quitter la conversation.
        <div className="fixed inset-0 z-40 flex justify-end bg-black/50 xl:hidden" onClick={closeInfo}>
          <div className="h-full w-full max-w-[380px]" onClick={(e) => e.stopPropagation()}>
            <InfoPanel conversationId={active} onClose={closeInfo} className="w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
