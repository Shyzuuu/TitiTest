import { Plus, Target, Trash2, Pencil } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AmountInput } from '../components/AmountInput';
import { Icon, PALETTE } from '../components/Icon';
import { Badge, Button, Card, EmptyState, Field, IconButton, Modal, PageHeader, Progress, Select, TextInput } from '../components/ui';
import { getCategory, spendingCategories } from '../domain/categories';
import { formatMonth, monthKey } from '../domain/dates';
import { centsToInput, parseAmount } from '../domain/money';
import { addCustomCategory, deleteBudget, upsertBudget } from '../domain/misc';
import type { Budget } from '../domain/schema';
import { categorySpent } from '../domain/selectors';
import { useBankState, useMoney, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';

function BudgetForm({ budget, onClose }: { budget?: Budget; onClose: () => void }) {
  const state = useBankState();
  const act = useBank((s) => s.act);
  const used = new Set(state.budgets.map((b) => b.category));
  const options = spendingCategories(state.customCategories).filter((c) => budget?.category === c.key || !used.has(c.key));
  const [category, setCategory] = useState(budget?.category ?? options[0]?.key ?? '');
  const [limit, setLimit] = useState(budget ? centsToInput(budget.limit) : '');
  const [newCat, setNewCat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parseAmount(limit);
    if (!p.ok) return setError(p.error);
    let cat = category;
    if (category === '__new') {
      const res = act((s, ctx) => addCustomCategory(s, ctx, { label: newCat, color: PALETTE[state.customCategories.length % PALETTE.length] ?? '#7656F6', icon: 'tag' }), { success: false, quietError: true });
      if (!res.ok) return setError(res.error);
      cat = res.data;
    }
    const res = act((s, ctx) => upsertBudget(s, ctx, cat, p.cents), { quietError: true });
    if (res.ok) onClose();
    else setError(res.error);
  };
  return (
    <Modal open onClose={onClose} title={budget ? 'Modifier le budget' : 'Nouveau budget mensuel'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Catégorie" htmlFor="b-cat">
          <Select id="b-cat" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!!budget}>
            {options.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
            {!budget && <option value="__new">+ Catégorie personnalisée…</option>}
          </Select>
        </Field>
        {category === '__new' && (
          <Field label="Nom de la catégorie" htmlFor="b-new">
            <TextInput id="b-new" value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={32} placeholder="Ex. Animaux" />
          </Field>
        )}
        <AmountInput value={limit} onChange={setLimit} label="Budget mensuel" error={error} />
        <Button type="submit" block size="lg">
          Enregistrer
        </Button>
      </form>
    </Modal>
  );
}

export default function Budgets() {
  const state = useBankState();
  const money = useMoney();
  const today = useToday();
  const act = useBank((s) => s.act);
  const [editing, setEditing] = useState<Budget | 'new' | null>(null);
  const month = monthKey(today);
  const rows = useMemo(
    () =>
      state.budgets.map((b) => {
        const spent = categorySpent(state, b.category, month);
        return { b, cat: getCategory(b.category, state.customCategories), spent, pct: (spent / b.limit) * 100 };
      }),
    [state, month],
  );
  const totalLimit = rows.reduce((s, r) => s + r.b.limit, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div>
      <PageHeader title="Budgets" icon={Target} subtitle={`Suivi des dépenses simulées — ${formatMonth(month)}`} actions={<Button icon={Plus} onClick={() => setEditing('new')}>Nouveau budget</Button>} />
      {rows.length > 0 && (
        <Card className="mb-6 p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm text-muted">Consommé ce mois</p>
              <p className="num text-3xl font-extrabold">{money(totalSpent)} <span className="text-base font-semibold text-muted">/ {money(totalLimit)}</span></p>
            </div>
            <p className="num text-sm text-muted">Reste global : {money(totalLimit - totalSpent)}</p>
          </div>
          <Progress className="mt-3" value={(totalSpent / Math.max(1, totalLimit)) * 100} color={totalSpent > totalLimit ? 'rgb(var(--danger))' : undefined} label="Consommation globale" />
          <p className="mt-3 text-xs text-muted">Les crédits de prêts fictifs ne sont pas comptés comme revenus. Les remboursements de prêts sont suivis dans la catégorie « Remboursement de prêt fictif ».</p>
        </Card>
      )}
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={Target} title="Aucun budget" action={<Button onClick={() => setEditing('new')}>Créer un budget</Button>}>
            Définissez un plafond mensuel fictif par catégorie.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ b, cat, spent, pct }) => (
            <Card key={b.id} className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${cat.color}22`, color: cat.color }}>
                  <Icon name={cat.icon} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{cat.label}</p>
                  <p className="num text-xs text-muted">{money(spent)} / {money(b.limit)}</p>
                </div>
                {pct > 100 ? <Badge tone="danger">Dépassé</Badge> : pct >= 80 ? <Badge tone="warn">{Math.round(pct)} %</Badge> : <Badge tone="ok">{Math.round(pct)} %</Badge>}
                <IconButton icon={Pencil} label={`Modifier ${cat.label}`} onClick={() => setEditing(b)} />
                <IconButton icon={Trash2} label={`Supprimer ${cat.label}`} onClick={() => act((s, ctx) => deleteBudget(s, ctx, b.id))} />
              </div>
              <Progress className="mt-4" value={pct} color={pct > 100 ? 'rgb(var(--danger))' : pct >= 80 ? 'rgb(var(--warn))' : cat.color} label={`Budget ${cat.label}`} />
              <p className="num mt-2 text-sm">{spent > b.limit ? <span className="font-semibold text-danger">Dépassement de {money(spent - b.limit)}</span> : <span className="text-muted">Reste {money(b.limit - spent)}</span>}</p>
            </Card>
          ))}
        </div>
      )}
      {editing && <BudgetForm budget={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
