import { Pencil, Plus, Search, Send, Star, Trash2, Users } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Modal, PageHeader, Switch, TextInput } from '../components/ui';
import { archiveContact, createContact, updateContact, type ContactInput } from '../domain/misc';
import type { Contact } from '../domain/schema';
import { useBankState, useMoney } from '../lib/hooks';
import { useBank } from '../store/bank';
import { ColorPicker } from './Accounts';

const EMOJIS = ['🙂', '🦊', '🐼', '🌸', '🎮', '☕', '📷', '🎧', '🐶', '🌵', '⚽', '🎨'];

function ContactForm({ contact, onClose }: { contact?: Contact; onClose: () => void }) {
  const act = useBank((s) => s.act);
  const [form, setForm] = useState<ContactInput>(() => (contact ? { name: contact.name, emoji: contact.emoji, color: contact.color, description: contact.description, favorite: contact.favorite } : { name: '', emoji: '🙂', color: '#7656F6', description: '', favorite: false }));
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Donnez un nom au contact.');
    const res = contact ? act((s, ctx) => updateContact(s, ctx, contact.id, form), { quietError: true }) : act((s, ctx) => createContact(s, ctx, form), { quietError: true });
    if (res.ok) onClose();
    else setError(res.error);
  };
  return (
    <Modal open onClose={onClose} title={contact ? 'Modifier le contact' : 'Nouveau contact fictif'} description="N’utilisez pas de coordonnées réelles : un nom suffit.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nom" error={error} htmlFor="ct-name">
          <TextInput id="ct-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={40} invalid={!!error} />
        </Field>
        <fieldset>
          <legend className="label">Avatar</legend>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button key={e} type="button" aria-pressed={form.emoji === e} onClick={() => setForm((f) => ({ ...f, emoji: e }))} className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${form.emoji === e ? 'border-brand bg-brand-soft' : 'border-line'}`}>
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        <ColorPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
        <Field label="Description (facultatif)" htmlFor="ct-desc">
          <TextInput id="ct-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={120} />
        </Field>
        <Switch checked={!!form.favorite} onChange={(favorite) => setForm((f) => ({ ...f, favorite }))} label="Favori" />
        <Button type="submit" block size="lg">
          {contact ? 'Enregistrer' : 'Ajouter le contact'}
        </Button>
      </form>
    </Modal>
  );
}

export default function Contacts() {
  const state = useBankState();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [removing, setRemoving] = useState<Contact | null>(null);
  const totals = useMemo(() => {
    const m = new Map<string, { sent: number; received: number }>();
    for (const t of state.transactions) {
      if (!t.contactId || t.status !== 'completed') continue;
      const e = m.get(t.contactId) ?? { sent: 0, received: 0 };
      if (t.amount < 0) e.sent -= t.amount;
      else e.received += t.amount;
      m.set(t.contactId, e);
    }
    return m;
  }, [state.transactions]);
  const contacts = state.contacts
    .filter((c) => !c.archived && (c.name.toLowerCase().includes(query.toLowerCase()) || c.handle.includes(query.toLowerCase())))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader title="Contacts fictifs" icon={Users} subtitle="Des personnes imaginaires pour tester les envois et réceptions." actions={<Button icon={Plus} onClick={() => setEditing('new')}>Ajouter</Button>} />
      <div className="relative mb-4">
        <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher" className="pl-11" aria-label="Rechercher un contact" />
      </div>
      {contacts.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Aucun contact" action={<Button onClick={() => setEditing('new')}>Ajouter un contact</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((c) => {
            const t = totals.get(c.id);
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar emoji={c.emoji} color={c.color} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-bold">
                      {c.name} {c.favorite && <Star size={13} className="shrink-0 fill-warn text-warn" aria-label="Favori" />}
                    </p>
                    <p className="truncate text-xs text-muted">{c.handle}</p>
                    {c.description && <p className="mt-1 truncate text-sm text-muted">{c.description}</p>}
                  </div>
                </div>
                <div className="mt-3 flex gap-3 text-xs text-muted">
                  <span>Envoyé : <strong className="num text-ink">{money(t?.sent ?? 0)}</strong></span>
                  <span>Reçu : <strong className="num text-ink">{money(t?.received ?? 0)}</strong></span>
                </div>
                <div className="mt-3 flex items-center gap-1">
                  <Button size="sm" variant="soft" icon={Send} onClick={() => navigate(`/envoyer?contact=${c.id}`)}>
                    Envoyer
                  </Button>
                  <IconButton icon={Pencil} label={`Modifier ${c.name}`} onClick={() => setEditing(c)} className="ml-auto" />
                  <IconButton icon={Trash2} label={`Supprimer ${c.name}`} onClick={() => setRemoving(c)} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <ContactForm contact={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        tone="danger"
        title="Supprimer ce contact ?"
        confirmLabel="Supprimer"
        onConfirm={() => {
          if (removing && act((s, ctx) => archiveContact(s, ctx, removing.id)).ok) setRemoving(null);
        }}
      >
        Les opérations passées avec {removing?.name} restent visibles dans l’historique.
      </ConfirmDialog>
    </div>
  );
}
