import clsx from 'clsx';
import { ArrowDownLeft, ArrowUpRight, Ban, CreditCard, Landmark, PiggyBank, RotateCcw, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { canReverse, reverseTransaction } from '../domain/accounts';
import { getCategory } from '../domain/categories';
import { formatDate, formatTime } from '../domain/dates';
import type { Transaction } from '../domain/schema';
import { useMoney } from '../lib/hooks';
import { TX_TYPE_LABEL } from '../lib/labels';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';
import { Icon } from './Icon';
import { Badge, Button, ConfirmDialog, KeyValue, Modal, TextInput } from './ui';

export function TxIcon({ tx, size = 44 }: { tx: Transaction; size?: number }) {
  const custom = useBank((s) => s.state.customCategories);
  const cat = getCategory(tx.category, custom);
  const special =
    tx.type === 'reversal' ? RotateCcw : tx.loanId ? Landmark : tx.vaultId ? PiggyBank : tx.type === 'transfer_in' || tx.type === 'p2p_in' ? ArrowDownLeft : tx.type === 'transfer_out' || tx.type === 'p2p_out' ? ArrowUpRight : null;
  const Special = special;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center rounded-2xl" style={{ width: size, height: size, background: `${cat.color}1f`, color: cat.color }}>
      {Special ? <Special size={size * 0.42} aria-hidden /> : <Icon name={cat.icon} size={size * 0.42} />}
      {tx.cardId && <CreditCard size={14} className="absolute -bottom-1 -right-1 rounded-md bg-surface p-[2px] text-muted" aria-hidden />}
    </span>
  );
}

export function TransactionRow({ tx, showDate = true }: { tx: Transaction; showDate?: boolean }) {
  const money = useMoney();
  const open = useUi((s) => s.openModal);
  const accounts = useBank((s) => s.state.accounts);
  const custom = useBank((s) => s.state.customCategories);
  const account = accounts.find((a) => a.id === tx.accountId);
  const declined = tx.status === 'declined';
  return (
    <button type="button" onClick={() => open('transaction', { id: tx.id })} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-raised sm:px-3">
      <TxIcon tx={tx} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={clsx('truncate font-semibold', declined && 'text-muted line-through')}>{tx.label}</span>
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {showDate && (
            <span>
              {formatDate(tx.date)} · {formatTime(tx.date)}
            </span>
          )}
          <span className="hidden sm:inline">{getCategory(tx.category, custom).label}</span>
          <span className="hidden md:inline">· {account?.name}</span>
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className={clsx('num font-bold', declined ? 'text-muted line-through' : tx.amount > 0 ? 'text-ok' : 'text-ink')}>{money(tx.amount, { signed: true })}</span>
        {declined ? <Badge tone="danger">Refusée</Badge> : tx.reversedBy ? <Badge tone="warn">Contrepassée</Badge> : tx.type === 'reversal' ? <Badge tone="info">Correction</Badge> : null}
      </span>
    </button>
  );
}

/** Liste groupée par jour. */
export function TransactionList({ txs, empty }: { txs: Transaction[]; empty?: React.ReactNode }) {
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of txs) {
      const d = tx.date.slice(0, 10);
      const arr = map.get(d);
      if (arr) arr.push(tx);
      else map.set(d, [tx]);
    }
    return [...map.entries()];
  }, [txs]);
  if (!txs.length) return <>{empty}</>;
  return (
    <div className="space-y-4">
      {groups.map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-muted sm:px-3">{formatDate(day, 'long')}</h3>
          <div>
            {list.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} showDate={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function TransactionDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useBank((s) => s.state);
  const act = useBank((s) => s.act);
  const money = useMoney();
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) {
    return (
      <Modal open onClose={onClose} title="Opération introuvable" size="sm">
        <p className="text-muted">Cette opération n’existe plus (données réinitialisées ?).</p>
      </Modal>
    );
  }
  const account = state.accounts.find((a) => a.id === tx.accountId);
  const card = tx.cardId ? state.cards.find((c) => c.id === tx.cardId) : null;
  const contact = tx.contactId ? state.contacts.find((c) => c.id === tx.contactId) : null;
  const vault = tx.vaultId ? state.vaults.find((v) => v.id === tx.vaultId) : null;
  const loan = tx.loanId ? state.loans.find((l) => l.id === tx.loanId) : null;
  const original = tx.reversalOf ? state.transactions.find((t) => t.id === tx.reversalOf) : null;
  const reversal = tx.reversedBy ? state.transactions.find((t) => t.id === tx.reversedBy) : null;
  const rev = canReverse(state, tx);
  const typeLabel = tx.type === 'reversal' && tx.origType ? `Contrepassation · ${TX_TYPE_LABEL[tx.origType]}` : TX_TYPE_LABEL[tx.type];

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Détail de l’opération"
        description="Opération de simulation — aucune valeur bancaire."
        footer={
          rev.ok ? (
            <Button variant="secondary" icon={Undo2} onClick={() => setConfirm(true)}>
              Contrepasser
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col items-center pb-4 text-center">
          <TxIcon tx={tx} size={56} />
          <p className="mt-3 font-semibold">{tx.label}</p>
          <p className={clsx('num mt-1 text-3xl font-extrabold tracking-tight', tx.status === 'declined' ? 'text-muted line-through' : tx.amount > 0 ? 'text-ok' : 'text-ink')}>{money(tx.amount, { signed: true })}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {tx.status === 'declined' ? <Badge tone="danger"><Ban size={12} /> Refusée</Badge> : <Badge tone="ok">Effectuée dans la simulation</Badge>}
            {tx.reversedBy && <Badge tone="warn">Contrepassée</Badge>}
          </div>
        </div>
        {tx.declineReason && <p className="mb-3 rounded-2xl bg-danger/10 p-3 text-sm text-danger">{tx.declineReason}</p>}
        <dl className="divide-y divide-line rounded-2xl border border-line px-4">
          <KeyValue label="Type" value={typeLabel} />
          <KeyValue label="Date" value={`${formatDate(tx.date, 'long')} à ${formatTime(tx.date)}`} />
          <KeyValue label="Compte" value={account?.name ?? '—'} />
          <KeyValue label="Catégorie" value={getCategory(tx.category, state.customCategories).label} />
          {card && <KeyValue label="Carte" value={`${card.name}${card.deletedAt ? ' (supprimée)' : ''}`} />}
          {contact && <KeyValue label="Contact fictif" value={contact.name} />}
          {vault && <KeyValue label="Coffre" value={vault.name} />}
          {tx.principalPart !== null && <KeyValue label="Part de capital" value={money(tx.principalPart)} />}
          {tx.interestPart !== null && <KeyValue label="Part d’intérêts fictifs" value={money(tx.interestPart)} />}
          {tx.note && <KeyValue label="Message / note" value={tx.note} />}
          <KeyValue label="Identifiant" value={<span className="font-mono text-xs">{tx.id}</span>} />
        </dl>
        {loan && (
          <Link to={`/prets/${loan.id}`} onClick={onClose} className="mt-3 block rounded-2xl bg-brand-soft p-3 text-sm font-semibold text-brand-ink">
            Voir le prêt fictif {loan.reference} →
          </Link>
        )}
        {original && <p className="mt-3 text-sm text-muted">Corrige l’opération « {original.label} » du {formatDate(original.date)}.</p>}
        {reversal && <p className="mt-3 text-sm text-muted">Contrepassée le {formatDate(reversal.date)} ({reversal.note}).</p>}
        {!rev.ok && tx.status === 'completed' && !tx.reversedBy && tx.type !== 'reversal' && <p className="mt-3 text-xs text-muted">{rev.reason}</p>}
      </Modal>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Contrepasser l’opération ?"
        confirmLabel="Contrepasser"
        onConfirm={() => {
          const res = act((s, ctx) => reverseTransaction(s, ctx, tx.id, reason || undefined));
          if (res.ok) setConfirm(false);
        }}
      >
        <p>Une écriture inverse de {money(Math.abs(tx.amount))} sera créée et liée à l’opération initiale, qui reste visible dans l’historique.</p>
        <TextInput className="mt-3" placeholder="Motif de la correction (facultatif)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
      </ConfirmDialog>
    </>
  );
}
