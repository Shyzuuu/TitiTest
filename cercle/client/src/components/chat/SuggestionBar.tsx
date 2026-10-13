import { ShieldAlert, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Suggestion } from '../../lib/types';
import { useStore } from '../../store/store';

/** Réponse préparée par l'IA : envoyer telle quelle, modifier puis envoyer, ou supprimer. */
export function SuggestionBar({ suggestion }: { suggestion: Suggestion }) {
  const send = useStore((s) => s.sendSuggestion);
  const discard = useStore((s) => s.discardSuggestion);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(suggestion.content);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setText(suggestion.content);
    setEditing(false);
  }, [suggestion.id, suggestion.content]);
  const needsConfirmation = Boolean(suggestion.reason);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-2 mb-2 rounded-2xl border border-warn/40 bg-warn/10 p-3 sm:mx-4" data-testid="suggestion-bar">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warn">
        {needsConfirmation ? <ShieldAlert size={14} /> : <Sparkles size={14} />}
        {needsConfirmation ? suggestion.reason : 'Réponse suggérée par l’IA'}
      </div>
      {editing ? (
        <textarea className="input mb-2 min-h-[70px] text-sm" value={text} onChange={(e) => setText(e.target.value)} aria-label="Modifier la suggestion" />
      ) : (
        <p className="mb-2 whitespace-pre-wrap text-sm">{suggestion.content}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary py-1.5"
          disabled={busy || !text.trim()}
          onClick={() => run(() => send(suggestion.conversationId, editing ? text : undefined))}
        >
          {needsConfirmation ? 'Confirmer et envoyer' : 'Envoyer'}
        </button>
        {!editing && (
          <button className="btn-outline py-1.5" onClick={() => setEditing(true)}>
            Modifier
          </button>
        )}
        <button className="btn-ghost py-1.5" disabled={busy} onClick={() => run(() => discard(suggestion.conversationId))}>
          Supprimer
        </button>
      </div>
    </div>
  );
}
