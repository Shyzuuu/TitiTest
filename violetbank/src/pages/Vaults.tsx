import { ArrowDownToLine, ArrowUpFromLine, Lock, Pencil, PiggyBank, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccountSelect } from '../components/AccountSelect';
import { AmountInput } from '../components/AmountInput';
import { Icon } from '../components/Icon';
import { Badge, Button, Card, EmptyState, Field, IconButton, Modal, PageHeader, Progress, TextInput } from '../components/ui';
import { diffDays, formatDate } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import type { Vault } from '../domain/schema';
import { closeVault, createVault, updateVault, vaultDeposit, vaultWithdraw, type VaultInput } from '../domain/vaults';
import { useActiveAccounts, useBalances, useBankState, useBusy, useMoney, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';
import { ColorPicker, IconPicker } from './Accounts';

function VaultForm({ vault, onClose }: { vault?: Vault; onClose: () => void }) {
  const act = useBank((s) => s.act);
  const [name, setName] = useState(vault?.name ?? '');
  const [goal, setGoal] = useState(vault ? centsToInput(vault.goal) : '');
  const [targetDate, setTargetDate] = useState(vault?.targetDate ?? '');
  const [color, setColor] = useState(vault?.color ?? '#7656F6');
  const [icon, setIcon] = useState(vault?.icon ?? 'piggy-bank');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Donnez un nom au coffre.');
    const g = parseAmount(goal);
    if (!g.ok) return setError(`Objectif : ${g.error}`);
    const input: VaultInput = { name, goal: g.cents, targetDate: targetDate || null, color, icon };
    const res = vault ? act((s, ctx) => updateVault(s, ctx, vault.id, input), { quietError: true }) : act((s, ctx) => createVault(s, ctx, input), { quietError: true });
    if (res.ok) onClose();
    else setError(res.error);
  };
  return (
    <Modal open onClose={onClose} title={vault ? 'Modifier le coffre' : 'Nouveau coffre fictif'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nom" htmlFor="v-name">
          <TextInput id="v-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex. Nouveau PC" />
        </Field>
        <AmountInput value={goal} onChange={setGoal} label="Objectif" />
        <Field label="Date cible (facultatif)" htmlFor="v-date">
          <TextInput id="v-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
        </Field>
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker value={icon} onChange={setIcon} />
        {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" block size="lg">
          {vault ? 'Enregistrer' : 'Créer le coffre'}
        </Button>
      </form>
    </Modal>
  );
}

function MoveModal({ vault, direction, onClose }: { vault: Vault; direction: 'in' | 'out'; onClose: () => void }) {
  const accounts = useActiveAccounts();
  const balances = useBalances();
  const money = useMoney();
  const act = useBank((s) => s.act);
  const { busy, run } = useBusy();
  const [account, setAccount] = useState(accounts[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const saved = balances.vaults.get(vault.id) ?? 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(amount);
    if (!p.ok) return setError(p.error);
    void run(() => {
      const res = act((s, ctx) => (direction === 'in' ? vaultDeposit(s, ctx, vault.id, account, p.cents) : vaultWithdraw(s, ctx, vault.id, account, p.cents)), { quietError: true });
      if (res.ok) onClose();
      else setError(res.error);
    });
  };
  return (
    <Modal open onClose={onClose} title={direction === 'in' ? `Alimenter « ${vault.name} »` : `Retirer de « ${vault.name} »`} description="Les fonds sont déplacés, jamais créés.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <AccountSelect value={account} onChange={setAccount} label={direction === 'in' ? 'Compte source' : 'Compte destinataire'} />
        <AmountInput value={amount} onChange={setAmount} error={error} autoFocus hint={direction === 'in' ? `Disponible : ${money(balances.accounts.get(account) ?? 0)}` : `Dans le coffre : ${money(saved)}`} presets={direction === 'in' ? [2_000, 5_000, 10_000, 25_000] : undefined} />
        {direction === 'out' && saved > 0 && (
          <button type="button" className="text-sm font-semibold text-brand-ink" onClick={() => setAmount(centsToInput(saved))}>
            Tout retirer ({money(saved)})
          </button>
        )}
        <Button type="submit" block size="lg" loading={busy}>
          Confirmer
        </Button>
      </form>
    </Modal>
  );
}

export default function Vaults() {
  const state = useBankState();
  const balances = useBalances();
  const money = useMoney();
  const today = useToday();
  const act = useBank((s) => s.act);
  const accounts = useActiveAccounts();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Vault | 'new' | null>(null);
  const [moving, setMoving] = useState<{ vault: Vault; direction: 'in' | 'out' } | null>(null);
  const [closing, setClosing] = useState<Vault | null>(null);
  const [closeAccount, setCloseAccount] = useState(accounts[0]?.id ?? '');
  const vaults = state.vaults.filter((v) => !v.archived);
  const total = vaults.reduce((s, v) => s + (balances.vaults.get(v.id) ?? 0), 0);

  useEffect(() => {
    if (params.get('nouveau')) {
      setEditing('new');
      params.delete('nouveau');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <div>
      <PageHeader title="Coffres d’épargne" icon={PiggyBank} subtitle={<>Total épargné fictif : <strong className="num text-ink">{money(total, { sensitive: true })}</strong></>} actions={<Button icon={Plus} onClick={() => setEditing('new')}>Nouveau coffre</Button>} />
      {vaults.length === 0 ? (
        <Card>
          <EmptyState icon={PiggyBank} title="Aucun coffre" action={<Button onClick={() => setEditing('new')}>Créer un coffre</Button>}>
            Mettez de côté des fonds fictifs pour un objectif.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vaults.map((v) => {
            const saved = balances.vaults.get(v.id) ?? 0;
            const pct = (saved / v.goal) * 100;
            const days = v.targetDate ? diffDays(today, v.targetDate) : null;
            return (
              <Card key={v.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ background: v.color }}>
                    <Icon name={v.icon} size={22} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{v.name}</p>
                    <p className="text-xs text-muted">{v.targetDate ? `Objectif le ${formatDate(v.targetDate)}${days !== null ? (days >= 0 ? ` · J-${days}` : ' · dépassée') : ''}` : 'Sans date cible'}</p>
                  </div>
                  <IconButton icon={Pencil} label={`Modifier ${v.name}`} onClick={() => setEditing(v)} />
                </div>
                <p className="num mt-4 text-2xl font-extrabold">{money(saved, { sensitive: true })}</p>
                <p className="num text-sm text-muted">sur {money(v.goal)}</p>
                <Progress className="mt-3" value={pct} color={v.color} label={`Progression ${v.name}`} />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="num font-semibold">{Math.min(100, Math.round(pct))} %</span>
                  {saved >= v.goal ? <Badge tone="ok">Objectif atteint 🎉</Badge> : <span className="num text-muted">reste {money(v.goal - saved)}</span>}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Button size="sm" icon={ArrowDownToLine} onClick={() => setMoving({ vault: v, direction: 'in' })}>Ajouter</Button>
                  <Button size="sm" variant="secondary" icon={ArrowUpFromLine} onClick={() => setMoving({ vault: v, direction: 'out' })} disabled={saved === 0}>Retirer</Button>
                  <Button size="sm" variant="ghost" icon={Lock} onClick={() => setClosing(v)}>Clôturer</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {editing && <VaultForm vault={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {moving && <MoveModal vault={moving.vault} direction={moving.direction} onClose={() => setMoving(null)} />}
      {closing && (
        <Modal open onClose={() => setClosing(null)} title={`Clôturer « ${closing.name} » ?`} size="sm">
          <p className="mb-4 text-sm text-muted">Le contenu du coffre ({money(balances.vaults.get(closing.id) ?? 0)}) sera reversé sur le compte choisi. L’historique est conservé.</p>
          <AccountSelect value={closeAccount} onChange={setCloseAccount} label="Compte destinataire" />
          <Button
            className="mt-4"
            block
            variant="danger"
            onClick={() => {
              if (act((s, ctx) => closeVault(s, ctx, closing.id, closeAccount)).ok) setClosing(null);
            }}
          >
            Clôturer le coffre
          </Button>
        </Modal>
      )}
    </div>
  );
}
