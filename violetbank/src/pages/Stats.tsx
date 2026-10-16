import { ChartPie } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Icon } from '../components/Icon';
import { Card, EmptyState, PageHeader, Progress, Segmented, StatTile } from '../components/ui';
import { getCategory } from '../domain/categories';
import { formatDate, shortMonth } from '../domain/dates';
import { formatMoney } from '../domain/money';
import { expensesByCategory, flowBuckets, loanOutstanding, loanPaidInterest, loanRepaidPrincipal, periodRange, type FlowBucket } from '../domain/selectors';
import { useBalances, useBankState, useChartColors, useMoney, useToday } from '../lib/hooks';
import { Landmark, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

type Period = '7d' | '30d' | '90d' | '12m';

function ChartCard({ title, subtitle, children, table }: { title: string; subtitle?: string; children: ReactNode; table: ReactNode }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <Segmented size="sm" label={`Affichage ${title}`} value={view} onChange={setView} options={[{ value: 'chart', label: 'Graphique' }, { value: 'table', label: 'Tableau' }]} />
      </div>
      {view === 'chart' ? children : <div className="max-h-80 overflow-auto">{table}</div>}
    </Card>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-surface">
        <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
          {head.map((h, i) => (
            <th key={h} className={`py-2 pr-3 ${i ? 'text-right' : ''}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="num">
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line/50">
            {r.map((c, j) => (
              <td key={j} className={`py-2 pr-3 ${j ? 'text-right' : ''}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Stats() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const balances = useBalances();
  const c = useChartColors();
  const [period, setPeriod] = useState<Period>('30d');
  const currency = state.settings.currency;
  const buckets = useMemo(() => flowBuckets(state, today, period), [state, today, period]);
  const range = periodRange(today, period);
  const label = (b: FlowBucket) => (period === '12m' ? shortMonth(b.key) : formatDate(b.key).slice(0, 6));
  const eur = (cents: number) => cents / 100;
  const fmt = (v: number) => formatMoney(Math.round(v * 100), { currency });
  const axisFmt = (v: number) => formatMoney(v * 100, { currency, compact: true });
  const tooltip = { contentStyle: { borderRadius: 14, border: `1px solid ${c.grid}`, background: c.surface }, formatter: (v: number) => fmt(v) };

  const totals = buckets.reduce((s, b) => ({ income: s.income + b.income, expenses: s.expenses + b.expenses, loanIn: s.loanIn + b.loanIn, loanOut: s.loanOut + b.loanOut, interest: s.interest + b.interest }), { income: 0, expenses: 0, loanIn: 0, loanOut: 0, interest: 0 });
  const categories = useMemo(() => [...expensesByCategory(state, range.from, range.to).entries()].sort((a, b) => b[1] - a[1]), [state, range.from, range.to]);
  const catTotal = categories.reduce((s, [, v]) => s + v, 0);
  const loans = state.loans.filter((l) => l.status !== 'cancelled');
  const vaults = state.vaults.filter((v) => !v.archived);

  const balanceData = buckets.map((b) => ({ name: label(b), Comptes: eur(b.balance), Coffres: eur(b.vaults) }));
  const flowData = buckets.map((b) => ({ name: label(b), Entrées: eur(b.income), Sorties: eur(b.expenses) }));
  const loanFlowData = buckets.map((b) => ({ name: label(b), Capital: eur(b.principalRepaid), Intérêts: eur(b.interest) }));
  const loanData = loans.map((l) => ({ name: l.reference, 'Capital initial': eur(l.principal), 'Restant dû': eur(loanOutstanding(l)) }));

  return (
    <div className="space-y-6">
      <PageHeader title="Statistiques" icon={ChartPie} subtitle="Calculées à partir des opérations fictives enregistrées. Les prêts sont présentés séparément des revenus et dépenses." actions={<Segmented label="Période" value={period} onChange={setPeriod} options={[{ value: '7d', label: '7 j' }, { value: '30d', label: '30 j' }, { value: '90d', label: '90 j' }, { value: '12m', label: '12 mois' }]} />} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Entrées fictives" value={money(totals.income)} icon={TrendingUp} tone="ok" hint="Dépôts et réceptions" />
        <StatTile label="Sorties fictives" value={money(totals.expenses)} icon={TrendingDown} tone="danger" hint="Dépenses, envois, retraits" />
        <StatTile label="Crédits simulés reçus" value={money(totals.loanIn)} icon={Landmark} tone="brand" hint="Hors revenus" />
        <StatTile label="Remboursements de prêts" value={money(totals.loanOut)} icon={Wallet} tone="warn" hint={`dont ${money(totals.interest)} d’intérêts`} />
      </div>

      <ChartCard title="Évolution du solde" subtitle="Total des comptes et des coffres en fin de période" table={<SimpleTable head={['Période', 'Comptes', 'Coffres']} rows={buckets.map((b) => [label(b), money(b.balance), money(b.vaults)])} />}>
        <div className="h-72" role="img" aria-label="Courbe d’évolution du solde des comptes et des coffres">
          <ResponsiveContainer>
            <AreaChart data={balanceData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="g-bal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={c.violet} stopOpacity={0.3} />
                  <stop offset="1" stopColor={c.violet} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={64} tickFormatter={axisFmt} />
              <Tooltip {...tooltip} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Comptes" stroke={c.violet} strokeWidth={2} fill="url(#g-bal)" activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
              <Area type="monotone" dataKey="Coffres" stroke={c.blue} strokeWidth={2} fill="transparent" activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Entrées et sorties fictives" subtitle="Hors virements internes, coffres et prêts" table={<SimpleTable head={['Période', 'Entrées', 'Sorties']} rows={buckets.map((b) => [label(b), money(b.income), money(b.expenses)])} />}>
          <div className="h-64" role="img" aria-label="Barres des entrées et sorties">
            <ResponsiveContainer>
              <BarChart data={flowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} maxBarSize={28}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={axisFmt} />
                <Tooltip {...tooltip} cursor={{ fill: 'rgb(118 86 246 / .08)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Entrées" fill={c.green} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Sorties" fill={c.red} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card className="p-4 sm:p-5">
          <h2 className="text-lg font-bold">Dépenses par catégorie</h2>
          <p className="mb-4 text-sm text-muted">Total {money(catTotal)} sur la période</p>
          {categories.length === 0 ? (
            <EmptyState icon={ChartPie} title="Aucune dépense sur la période" />
          ) : (
            <ul className="space-y-3">
              {categories.map(([key, value]) => {
                const cat = getCategory(key, state.customCategories);
                return (
                  <li key={key}>
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${cat.color}22`, color: cat.color }}>
                        <Icon name={cat.icon} size={14} />
                      </span>
                      <span className="flex-1 truncate font-medium">{cat.label}</span>
                      <span className="num font-semibold">{money(value)}</span>
                      <span className="num w-10 text-right text-xs text-muted">{Math.round((value / catTotal) * 100)} %</span>
                    </div>
                    <Progress value={(value / categories[0]![1]) * 100} color={cat.color} label={cat.label} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Prêts fictifs : capital initial et restant dû" table={<SimpleTable head={['Prêt', 'Capital initial', 'Restant dû', 'Capital remboursé', 'Intérêts payés']} rows={loans.map((l) => [l.reference, money(l.principal), money(loanOutstanding(l)), money(loanRepaidPrincipal(l)), money(loanPaidInterest(l))])} />}>
          {loans.length === 0 ? (
            <EmptyState icon={Landmark} title="Aucun prêt fictif" />
          ) : (
            <div className="h-64" role="img" aria-label="Barres du capital initial et restant dû par prêt">
              <ResponsiveContainer>
                <BarChart data={loanData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} maxBarSize={56}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={axisFmt} />
                  <Tooltip {...tooltip} cursor={{ fill: 'rgb(118 86 246 / .08)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Capital initial" fill={c.violet} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Restant dû" fill={c.blue} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
        <ChartCard title="Remboursements effectués" subtitle="Capital et intérêts fictifs payés" table={<SimpleTable head={['Période', 'Capital', 'Intérêts']} rows={buckets.map((b) => [label(b), money(b.principalRepaid), money(b.interest)])} />}>
          <div className="h-64" role="img" aria-label="Barres empilées des remboursements">
            <ResponsiveContainer>
              <BarChart data={loanFlowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} maxBarSize={40}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={12} />
                <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={axisFmt} />
                <Tooltip {...tooltip} cursor={{ fill: 'rgb(118 86 246 / .08)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Capital" stackId="r" fill={c.violet} stroke={c.surface} strokeWidth={1} />
                <Bar dataKey="Intérêts" stackId="r" fill={c.orange} stroke={c.surface} strokeWidth={1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-bold">Progression des objectifs d’épargne</h2>
        {vaults.length === 0 ? (
          <EmptyState icon={Wallet} title="Aucun coffre" />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {vaults.map((v) => {
              const saved = balances.vaults.get(v.id) ?? 0;
              return (
                <li key={v.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold">{v.name}</span>
                    <span className="num text-muted">{money(saved)} / {money(v.goal)}</span>
                  </div>
                  <Progress value={(saved / v.goal) * 100} color={v.color} label={v.name} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
