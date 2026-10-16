import clsx from 'clsx';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useId, useState } from 'react';
import { formatDate } from '../domain/dates';
import { formatMoney } from '../domain/money';
import type { Installment, Loan, LoanApplication, LoanProduct } from '../domain/schema';
import { installmentDisplayStatus, LOAN_STATUS_LABEL, type UnifiedLoanStatus } from '../domain/selectors';
import { useBank } from '../store/bank';
import { useChartColors, useMoney, useToday } from '../lib/hooks';
import { INSTALLMENT_LABEL, INSTALLMENT_TONE, UNIFIED_TONE } from '../lib/labels';
import { Icon } from './Icon';
import { Badge, Segmented } from './ui';

export function ProductIcon({ product, size = 44 }: { product?: LoanProduct; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#B9A7FF] to-brand text-white" style={{ width: size, height: size }}>
      <Icon name={product?.icon ?? 'landmark'} size={size * 0.45} />
    </span>
  );
}

export function UnifiedStatusBadge({ status }: { status: UnifiedLoanStatus }) {
  return <Badge tone={UNIFIED_TONE[status]}>{LOAN_STATUS_LABEL[status]}</Badge>;
}

export function SimulationDisclaimer({ className }: { className?: string }) {
  return (
    <p className={clsx('rounded-2xl border border-dashed border-brand/40 bg-brand-soft/40 px-4 py-3 text-xs font-medium text-brand-ink', className)}>
      Prêts, taux, décisions et remboursements entièrement fictifs. Les taux sont hypothétiques et ne correspondent à aucune offre commerciale. Aucune banque n’examine ni n’approuve ces demandes.
    </p>
  );
}

export interface ScheduleLine {
  index: number;
  dueDate: string;
  amount: number;
  principal: number;
  interest: number;
  balanceAfter: number;
  installment?: Installment;
}

/** Tableau d'amortissement : tableau sur grand écran, cartes compactes sur mobile. */
export function ScheduleTable({ rows, loan, max }: { rows: ScheduleLine[]; loan?: Loan; max?: number }) {
  const money = useMoney();
  const today = useToday();
  const [all, setAll] = useState(false);
  const shown = max && !all ? rows.slice(0, max) : rows;
  return (
    <div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-3 font-semibold">N°</th>
              <th className="py-2 pr-3 font-semibold">Date théorique</th>
              <th className="py-2 pr-3 text-right font-semibold">Montant</th>
              <th className="py-2 pr-3 text-right font-semibold">Capital</th>
              <th className="py-2 pr-3 text-right font-semibold">Intérêts</th>
              <th className="py-2 pr-3 text-right font-semibold">Restant dû après</th>
              {loan && <th className="py-2 font-semibold">Statut</th>}
            </tr>
          </thead>
          <tbody className="num">
            {shown.map((r) => {
              const st = r.installment ? installmentDisplayStatus(r.installment, today, loan) : null;
              return (
                <tr key={r.index} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5 pr-3 font-semibold">{r.index}</td>
                  <td className="py-2.5 pr-3">{formatDate(r.dueDate)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold">{money(r.amount)}</td>
                  <td className="py-2.5 pr-3 text-right">{money(r.principal)}</td>
                  <td className="py-2.5 pr-3 text-right text-muted">{money(r.interest)}</td>
                  <td className="py-2.5 pr-3 text-right">{money(r.balanceAfter)}</td>
                  {loan && st && (
                    <td className="py-2.5">
                      <Badge tone={INSTALLMENT_TONE[st]}>{INSTALLMENT_LABEL[st]}</Badge>
                      {r.installment?.status === 'partial' && <span className="ml-2 text-xs text-muted">payé {money(r.installment.paidInterest + r.installment.paidPrincipal)}</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {shown.map((r) => {
          const st = r.installment ? installmentDisplayStatus(r.installment, today, loan) : null;
          return (
            <li key={r.index} className="rounded-2xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold">
                  N°{r.index} · {formatDate(r.dueDate)}
                </span>
                <span className="num font-bold">{money(r.amount)}</span>
              </div>
              <div className="num mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                <span>Capital {money(r.principal)}</span>
                <span>Intérêts {money(r.interest)}</span>
                <span>Reste {money(r.balanceAfter)}</span>
              </div>
              {st && (
                <div className="mt-2">
                  <Badge tone={INSTALLMENT_TONE[st]}>{INSTALLMENT_LABEL[st]}</Badge>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {max && rows.length > max && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-3 text-sm font-semibold text-brand-ink hover:underline">
          {all ? 'Réduire' : `Afficher les ${rows.length} échéances`}
        </button>
      )}
    </div>
  );
}

/** Répartition capital / intérêts par échéance, avec vue tableau alternative. */
export function ScheduleChart({ rows }: { rows: ScheduleLine[] }) {
  const c = useChartColors();
  const currency = useBank((s) => s.state.settings.currency);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const data = rows.map((r) => ({ name: `${r.index}`, Capital: r.principal / 100, Intérêts: r.interest / 100 }));
  const fmt = (v: number) => formatMoney(Math.round(v * 100), { currency });
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Segmented size="sm" label="Affichage" value={view} onChange={setView} options={[{ value: 'chart', label: 'Graphique' }, { value: 'table', label: 'Tableau' }]} />
      </div>
      {view === 'chart' ? (
        <div className="h-64 w-full" role="img" aria-label="Graphique de répartition capital et intérêts par échéance">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={rows.length > 24 ? 1 : 3}>
              <CartesianGrid stroke={c.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => formatMoney(v * 100, { currency, compact: true })} />
              <Tooltip
                cursor={{ fill: 'rgb(118 86 246 / .08)' }}
                formatter={(v: number) => fmt(v)}
                labelFormatter={(l) => `Échéance n°${l}`}
                contentStyle={{ borderRadius: 14, border: `1px solid ${c.grid}`, background: c.surface }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Capital" stackId="a" fill={c.violet} stroke={c.surface} strokeWidth={1} />
              <Bar dataKey="Intérêts" stackId="a" fill={c.orange} stroke={c.surface} strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ScheduleTable rows={rows} max={12} />
      )}
    </div>
  );
}

export function applicationSummaryLine(app: LoanApplication, product?: LoanProduct): string {
  return `${product?.name ?? 'Scénario'} · ${formatMoney(app.amount)} sur ${app.months} mois`;
}

/** Illustration originale de la page Prêts : pièces et courbe d'amortissement stylisées. */
export function LoansIllustration() {
  const gid = `li-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 220 160" className="h-36 w-auto sm:h-40" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#B9A7FF" />
          <stop offset="1" stopColor="#4930B5" />
        </linearGradient>
      </defs>
      <rect x="20" y="22" width="150" height="104" rx="18" fill="#fff" fillOpacity=".14" stroke="#fff" strokeOpacity=".35" />
      <path d="M36 104 C70 100 92 70 112 62 S150 44 158 40" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect key={i} x={40 + i * 20} y={110 - (6 - i) * 10} width="10" height={(6 - i) * 10} rx="3" fill="#fff" fillOpacity={0.25 + i * 0.08} />
      ))}
      <g transform="translate(150 92)">
        <ellipse cx="30" cy="44" rx="30" ry="9" fill="#2a1f63" />
        <rect x="0" y="22" width="60" height="22" fill={`url(#${gid})`} />
        <ellipse cx="30" cy="22" rx="30" ry="9" fill="#E9E3FF" />
        <ellipse cx="30" cy="12" rx="30" ry="9" fill="#B9A7FF" />
        <rect x="0" y="2" width="60" height="10" fill="#B9A7FF" />
        <ellipse cx="30" cy="2" rx="30" ry="9" fill="#fff" />
        <text x="30" y="6" textAnchor="middle" fontSize="11" fontWeight="800" fill="#4930B5">DEMO</text>
      </g>
    </svg>
  );
}
