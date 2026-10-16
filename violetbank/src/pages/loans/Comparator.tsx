import { Scale } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AmountInput } from '../../components/AmountInput';
import { SimulationDisclaimer } from '../../components/LoanParts';
import { Callout, Card, Field, PageHeader, Segmented, TextInput } from '../../components/ui';
import { amortize, monthlyRate, quoteLoan, summarize } from '../../domain/loanMath';
import { centsToInput, formatMoney, formatRate, parseAmount } from '../../domain/money';
import { useChartColors, useMoney, useToday } from '../../lib/hooks';
import { bpsToInput, parseRate } from '../../lib/loanParams';
import { useBank } from '../../store/bank';

interface Scenario {
  name: string;
  detail: string;
  count: number;
  payment: number;
  interest: number;
  total: number;
}

export default function Comparator() {
  const today = useToday();
  const money = useMoney();
  const c = useChartColors();
  const currency = useBank((s) => s.state.settings.currency);
  const [amount, setAmount] = useState(centsToInput(500_000));
  const [rate, setRate] = useState(bpsToInput(600));
  const [months, setMonths] = useState('36');
  const [view, setView] = useState<'chart' | 'table'>('table');
  const p = parseAmount(amount);
  const r = parseRate(rate);
  const n = Number(months);
  const valid = p.ok && r.ok && Number.isInteger(n) && n >= 3 && n <= 120 && p.cents >= n * 100;

  const scenarios: Scenario[] = useMemo(() => {
    if (!valid || !p.ok || !r.ok) return [];
    const make = (name: string, detail: string, mo: number, bps: number): Scenario => {
      const q = quoteLoan({ principal: p.cents, annualRateBps: bps, months: mo, mode: 'annuity', startDate: today });
      return { name, detail, count: q.count, payment: q.firstPayment, interest: q.totalInterest, total: q.totalAmount };
    };
    const short = Math.max(3, Math.round(n / 2));
    const long = Math.min(120, n * 2);
    const base = make('Référence', `${n} mois · ${formatRate(r.bps)}`, n, r.bps);
    // Mensualité +25 % : la durée est déduite du nouveau montant mensuel.
    const higher = Math.round(base.payment * 1.25);
    const rowsHigher = amortize({ principal: p.cents, rate: monthlyRate(r.bps), mode: 'annuity', fixedPayment: higher });
    const sh = summarize(rowsHigher);
    // Anticipé : 20 % du capital remboursé après 12 mois, durée réduite.
    const qBase = quoteLoan({ principal: p.cents, annualRateBps: r.bps, months: n, mode: 'annuity', startDate: today });
    const cut = Math.min(12, n - 1);
    const paidRows = qBase.rows.slice(0, cut);
    const remaining = qBase.rows[cut - 1]?.balanceAfter ?? p.cents;
    const extra = Math.min(remaining, Math.round(p.cents * 0.2));
    let prepay: Scenario;
    if (remaining - extra <= 0) {
      const paid = summarize(paidRows);
      prepay = { name: 'Remboursement anticipé', detail: `soldé au mois ${cut}`, count: cut, payment: base.payment, interest: paid.totalInterest, total: paid.totalAmount + remaining };
    } else {
      const rest = summarize(amortize({ principal: remaining - extra, rate: monthlyRate(r.bps), mode: 'annuity', fixedPayment: base.payment }));
      const paid = summarize(paidRows);
      prepay = { name: 'Remboursement anticipé', detail: `${money(extra)} au mois ${cut}`, count: cut + rest.count, payment: base.payment, interest: paid.totalInterest + rest.totalInterest, total: paid.totalAmount + extra + rest.totalAmount };
    }
    return [
      make('Durée courte', `${short} mois`, short, r.bps),
      base,
      make('Durée longue', `${long} mois`, long, r.bps),
      { name: 'Mensualité plus élevée', detail: `${money(higher)} / mois`, count: sh.count, payment: higher, interest: sh.totalInterest, total: sh.totalAmount },
      prepay,
      make('Taux fictif différent', formatRate(Math.max(0, r.bps - 200)), n, Math.max(0, r.bps - 200)),
      make('Taux fictif plus élevé', formatRate(r.bps + 200), n, r.bps + 200),
    ];
  }, [valid, p.ok ? p.cents : 0, r.ok ? r.bps : 0, n, today, money]);

  const ref = scenarios[1];
  const fmt = (v: number) => formatMoney(Math.round(v * 100), { currency });

  return (
    <div>
      <PageHeader title="Comparateur de remboursement" icon={Scale} subtitle="Visualisez l’influence de la durée, de la mensualité et du taux sur le coût théorique." />
      <Card className="mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <AmountInput value={amount} onChange={setAmount} label="Capital fictif" error={p.ok ? null : p.error} />
        <Field label="Taux fictif (%)" htmlFor="cmp-rate" error={r.ok ? null : r.error}>
          <TextInput id="cmp-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </Field>
        <Field label="Durée de référence (mois)" htmlFor="cmp-months" hint="Entre 3 et 120 mois.">
          <TextInput id="cmp-months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/\D/g, ''))} />
        </Field>
      </Card>
      {!valid ? (
        <Callout tone="warn">Paramètres invalides : vérifiez le capital, le taux (0 à 50 %) et la durée (3 à 120 mois).</Callout>
      ) : (
        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex justify-end">
            <Segmented size="sm" label="Affichage" value={view} onChange={setView} options={[{ value: 'table', label: 'Tableau' }, { value: 'chart', label: 'Graphique' }]} />
          </div>
          {view === 'table' ? (
            <>
            <ul className="space-y-2 md:hidden">
              {scenarios.map((s) => (
                <li key={s.name} className={`rounded-2xl border border-line p-3 ${s === ref ? 'bg-brand-soft/40' : ''}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold">{s.name}</p>
                    <p className="num font-bold">{money(s.payment)}<span className="text-xs font-medium text-muted">/mois</span></p>
                  </div>
                  <p className="text-xs text-muted">{s.detail}</p>
                  <div className="num mt-2 flex flex-wrap gap-x-3 text-xs">
                    <span>{s.count} mois</span>
                    <span>Intérêts {money(s.interest)}</span>
                    <span>Total {money(s.total)}</span>
                    {ref && s !== ref && <span className={s.interest < ref.interest ? 'font-semibold text-ok' : 'font-semibold text-danger'}>{money(s.interest - ref.interest, { signed: true })}</span>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Scénario</th>
                    <th className="py-2 pr-3 text-right">Durée</th>
                    <th className="py-2 pr-3 text-right">Mensualité</th>
                    <th className="py-2 pr-3 text-right">Intérêts</th>
                    <th className="py-2 pr-3 text-right">Total</th>
                    <th className="py-2 text-right">Écart vs référence</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {scenarios.map((s) => (
                    <tr key={s.name} className={`border-b border-line/60 last:border-0 ${s === ref ? 'bg-brand-soft/40' : ''}`}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted">{s.detail}</p>
                      </td>
                      <td className="py-3 pr-3 text-right">{s.count} mois</td>
                      <td className="py-3 pr-3 text-right font-semibold">{money(s.payment)}</td>
                      <td className="py-3 pr-3 text-right">{money(s.interest)}</td>
                      <td className="py-3 pr-3 text-right">{money(s.total)}</td>
                      <td className={`py-3 text-right font-semibold ${ref && s.interest < ref.interest ? 'text-ok' : ref && s.interest > ref.interest ? 'text-danger' : 'text-muted'}`}>{ref ? money(s.interest - ref.interest, { signed: true }) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          ) : (
            <div className="h-80" role="img" aria-label="Comparaison des intérêts et du capital par scénario">
              <ResponsiveContainer>
                <BarChart data={scenarios.map((s) => ({ name: s.name, Capital: (s.total - s.interest) / 100, Intérêts: s.interest / 100 }))} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={c.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatMoney(v * 100, { currency, compact: true })} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 14, border: `1px solid ${c.grid}`, background: c.surface }} cursor={{ fill: 'rgb(118 86 246 / .08)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Capital" stackId="a" fill={c.violet} stroke={c.surface} strokeWidth={2} />
                  <Bar dataKey="Intérêts" stackId="a" fill={c.orange} stroke={c.surface} strokeWidth={2} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}
      <SimulationDisclaimer className="mt-6" />
    </div>
  );
}
