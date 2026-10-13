import { MessageCircle, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar, STATUS_LABEL } from '../components/ui/Avatar';
import { useStore } from '../store/store';

export function ContactsPage() {
  const characters = useStore((s) => s.characters);
  const conversations = useStore((s) => s.conversations);
  const [q, setQ] = useState('');
  const list = useMemo(
    () =>
      Object.values(characters)
        .filter((c) => c.fullName.toLowerCase().includes(q.trim().toLowerCase()) || c.interests.some((i) => i.toLowerCase().includes(q.trim().toLowerCase())))
        .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.firstName.localeCompare(b.firstName, 'fr')),
    [characters, q],
  );
  const convFor = (characterId: string) => Object.values(conversations).find((c) => c.characterId === characterId)?.id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Contacts"
        subtitle={`${list.length} personne(s)`}
        actions={
          <Link to="/characters/new" className="btn-primary py-1.5 text-xs">
            <Plus size={15} /> Nouveau
          </Link>
        }
      />
      <div className="border-b border-line bg-panel px-3 py-2 sm:px-5">
        <label className="relative block max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input rounded-full pl-9" placeholder="Nom ou centre d’intérêt" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const conv = convFor(c.id);
            return (
              <div key={c.id} className="card flex flex-col p-4">
                <div className="flex items-center gap-3">
                  <Avatar character={c} size={52} showStatus />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.fullName}</div>
                    <div className="text-xs text-muted">{c.isActive ? STATUS_LABEL[c.status] : 'Désactivé'}</div>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted">{c.description}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.interests.slice(0, 4).map((i) => (
                    <span key={i} className="chip">
                      {i}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  {conv && (
                    <Link to={`/chats/${conv}`} className="btn-primary flex-1 py-1.5">
                      <MessageCircle size={15} /> Écrire
                    </Link>
                  )}
                  <Link to={`/characters/${c.id}`} className="btn-outline py-1.5">
                    Profil
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
