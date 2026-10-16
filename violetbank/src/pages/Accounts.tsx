import clsx from 'clsx';
import { Archive, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Pencil, Plus, Receipt, Wallet } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Icon, PALETTE, PICKABLE_ICONS } from '../components/Icon';
import { TransactionList } from '../components/Transactions';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Modal, PageHeader, Select, TextInput } from '../components/ui';
import { archiveAccount, createAccount, updateAccount, type CreateAccountInput } from '../domain/accounts';
import type { Account, AccountKind } from '../domain/schema';
import { useBalances, useBankState, useMoney } from '../lib/hooks';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';

const KINDS: { value: AccountKind; label: string; icon: string; color: string }[] = [
  { value: 'main', label: 'Compte principal', icon: 'wallet', color: '#7656F6' },
  { value: 'spending', label: 'Compte dépenses', icon: 'shopping-bag', color: '#4285F4' },
  { value: 'savings', label: 'Compte épargne', icon: 'piggy-bank', color: '#26B879' },
  { value: 'projects', label: 'Compte projets', icon: 'rocket', color: '#F3A642' },
  { value: 'custom', label: 'Compte personnalisé', icon: 'star', color: '#D946A8' },
];

export function ColorPicker({ value, onChange, label = 'Couleur' }: { value: string; onChange: (c: string) => void; label?: string }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Couleur ${c}`}
            aria-pressed={value === c}
            className={clsx('h-9 w-9 rounded-full border-2 transition', value === c ? 'scale-110 border-ink' : 'border-transparent')}
            style={{ background: c }}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function IconPicker({ value, onChange }: { value: string; onChange: (i: string) => void }) {
  return (
    <fieldset>
      <legend className="label">Icône</legend>
      <div className="flex flex-wrap gap-2">
        {PICKABLE_ICONS.map((i) => (
          <button key={i} type="button" onClick={() => onChange(i)} aria-label={`Icône ${i}`} aria-pressed={value === i} className={clsx('flex h-10 w-10 items-center justify-center rounded-xl border transition', value === i ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line hover:bg-raised')}>
            <Icon name={i} size={18} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const act = useBank((s) => s.act);
  const [form, setForm] = useState<CreateAccountInput>(() => account ? { name: account.name, kind: account.kind, color: account.color, icon: account.icon } : { name: '', kind: 'custom', color: '#D946A8', icon: 'star' });
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return setError('Donnez un nom au compte.');
    const res = account ? act((s, ctx) => updateAccount(s, ctx, account.id, form), { quietError: true }) : act((s, ctx) => createAccount(s, ctx, form), { quietError: true });
    if (res.ok) onClose();
    else setError(res.error);
  };
  return (
    <Modal open onClose={onClose} title={account ? 'Modifier le compte' : 'Nouveau compte fictif'}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Type" htmlFor="acc-kind">
          <Select
            id="acc-kind"
            value={form.kind}
            onChange={(e) => {
              const k = KINDS.find((x) => x.value === e.target.value);
              if (k) setForm((f) => ({ ...f, kind: k.value, icon: account ? f.icon : k.icon, color: account ? f.color : k.color, name: f.name || (k.value !== 'custom' ? k.label : '') }));
            }}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nom" error={error} htmlFor="acc-name">
          <TextInput id="acc-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} maxLength={40} placeholder="Ex. Compte voyages" invalid={!!error} />
        </Field>
        <ColorPicker value={form.color} onChange={(color) => setForm((f) => ({ ...f, color }))} />
        <IconPicker value={form.icon} onChange={(icon) => setForm((f) => ({ ...f, icon }))} />
        <Button type="submit" block size="lg">
          {account ? 'Enregistrer' : 'Créer le compte'}
        </Button>
        {!account && <p className="text-center text-xs text-muted">Un nouveau compte démarre à 0 : alimentez-le par un virement interne ou un ajout de fonds de test.</p>}
      </form>
    </Modal>
  );
}

export default function Accounts() {
  const state = useBankState();
  const balances = useBalances();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const open = useUi((s) => s.openModal);
  const [editing, setEditing] = useState<Account | 'new' | null>(null);
  const [archiving, setArchiving] = useState<Account | null>(null);
  const active = state.accounts.filter((a) => !a.archived);
  const [selected, setSelected] = useState<string>(active[0]?.id ?? '');
  const current = active.find((a) => a.id === selected) ?? active[0];
  const total = active.reduce((s, a) => s + (balances.accounts.get(a.id) ?? 0), 0);
  const txs = useMemo(() => state.transactions.filter((t) => t.accountId === current?.id).slice(0, 30), [state.transactions, current?.id]);
  const archived = state.accounts.filter((a) => a.archived);

  return (
    <div>
      <PageHeader
        title="Comptes"
        icon={Wallet}
        subtitle={<>Total disponible fictif : <strong className="num text-ink">{money(total, { sensitive: true })}</strong></>}
        actions={<Button icon={Plus} onClick={() => setEditing('new')}>Nouveau compte</Button>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {active.map((a) => (
          <button key={a.id} type="button" onClick={() => setSelected(a.id)} className={clsx('card relative overflow-hidden p-5 text-left transition hover:-translate-y-0.5', current?.id === a.id && 'ring-2 ring-brand')} aria-pressed={current?.id === a.id}>
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20" style={{ background: a.color }} />
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: a.color }}>
                <Icon name={a.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold">{a.name}</span>
                <span className="text-xs text-muted">{KINDS.find((k) => k.value === a.kind)?.label}</span>
              </span>
            </div>
            <p className="num mt-4 text-2xl font-extrabold tracking-tight">{money(balances.accounts.get(a.id) ?? 0, { sensitive: true })}</p>
          </button>
        ))}
      </div>

      {current && (
        <Card className="mt-6 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">{current.name}</h2>
              <p className="text-sm text-muted">{txs.length ? `${txs.length} dernières opérations` : 'Aucune opération'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={ArrowDownToLine} onClick={() => open('deposit', { accountId: current.id })}>Ajouter</Button>
              <Button size="sm" variant="secondary" icon={ArrowUpFromLine} onClick={() => open('withdraw', { accountId: current.id })}>Retirer</Button>
              <Button size="sm" variant="secondary" icon={ArrowLeftRight} onClick={() => open('transfer', { accountId: current.id })}>Transférer</Button>
              <Button size="sm" variant="secondary" icon={Receipt} onClick={() => open('expense', { accountId: current.id })}>Dépense</Button>
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(current)}>Modifier</Button>
              <Button size="sm" variant="ghost" icon={Archive} onClick={() => setArchiving(current)}>Archiver</Button>
            </div>
          </div>
          <div className="mt-4">
            <TransactionList txs={txs} empty={<EmptyState icon={Wallet} title="Compte vide">Alimentez ce compte avec des fonds de test ou un virement interne.</EmptyState>} />
          </div>
        </Card>
      )}

      {archived.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Comptes archivés</h2>
          <div className="flex flex-wrap gap-2">
            {archived.map((a) => (
              <Badge key={a.id}>{a.name}</Badge>
            ))}
          </div>
        </div>
      )}

      {editing && <AccountForm account={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!archiving}
        onClose={() => setArchiving(null)}
        title="Archiver ce compte ?"
        tone="danger"
        confirmLabel="Archiver"
        onConfirm={() => {
          if (!archiving) return;
          const res = act((s, ctx) => archiveAccount(s, ctx, archiving.id));
          if (res.ok) {
            setArchiving(null);
            setSelected(active.find((a) => a.id !== archiving.id)?.id ?? '');
          }
        }}
      >
        Le compte doit être vide et sans carte ni prêt actif. Son historique reste consultable.
      </ConfirmDialog>
    </div>
  );
}
