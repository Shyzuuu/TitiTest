import clsx from 'clsx';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, Segmented } from '../../components/ui';
import { daysInMonth, formatDate, formatMonth, makeISODate, monthKey } from '../../domain/dates';
import type { Installment, Loan } from '../../domain/schema';
import { installmentDisplayStatus } from '../../domain/selectors';
import { useBankState, useMoney, useToday } from '../../lib/hooks';
import { INSTALLMENT_LABEL, INSTALLMENT_TONE } from '../../lib/labels';

interface Entry {
  loan: Loan;
  inst: Installment;
}
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DOT: Record<string, string> = { ok: 'bg-ok', danger: 'bg-danger', warn: 'bg-warn', info: 'bg-info', brand: 'bg-brand', neutral: 'bg-muted' };

export default function LoanCalendar() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const navigate = useNavigate();
  const [view, setView] = useState<'month' | 'list'>('month');
  const [cursor, setCursor] = useState(monthKey(today));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const entries = useMemo(() => {
    const out: Entry[] = [];
    for (const loan of state.loans) {
      if (loan.status === 'cancelled') continue;
      for (const inst of loan.schedule) out.push({ loan, inst });
    }
    return out.sort((a, b) => (a.inst.dueDate < b.inst.dueDate ? -1 : a.inst.dueDate > b.inst.dueDate ? 1 : 0));
  }, [state.loans]);
  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const arr = m.get(e.inst.dueDate);
      if (arr) arr.push(e);
      else m.set(e.inst.dueDate, [e]);
    }
    return m;
  }, [entries]);

  const [y, mo] = cursor.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
  const offset = (first + 6) % 7;
  const total = daysInMonth(y, mo);
  const cells: (string | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: total }, (_, i) => makeISODate(y, mo, i + 1))];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => {
    const t = y * 12 + (mo - 1) + n;
    setCursor(`${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`);
    setSelectedDay(null);
  };
  const monthEntries = entries.filter((e) => monthKey(e.inst.dueDate) === cursor);
  const monthTotal = monthEntries.reduce((s, e) => s + (e.inst.status === 'paid' || e.inst.status === 'settled' ? 0 : e.inst.amount - e.inst.paidInterest - e.inst.paidPrincipal), 0);
  const dayList = selectedDay ? byDay.get(selectedDay) ?? [] : monthEntries;

  const row = (e: Entry) => {
    const st = installmentDisplayStatus(e.inst, today, e.loan);
    return (
      <li key={`${e.loan.id}-${e.inst.index}`}>
        <Link to={`/prets/${e.loan.id}`} className="flex flex-wrap items-center gap-3 rounded-2xl p-3 transition hover:bg-raised">
          <div className="w-14 shrink-0 text-center">
            <p className="text-xl font-extrabold leading-none">{e.inst.dueDate.slice(8)}</p>
            <p className="text-xs text-muted">{formatMonth(monthKey(e.inst.dueDate)).split(' ')[0]?.slice(0, 4)}.</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">
              {e.loan.label} · n°{e.inst.index}
            </p>
            <p className="num text-xs text-muted">
              capital {money(e.inst.principal)} · intérêts {money(e.inst.interest)} · reste après {money(e.inst.balanceAfter)}
            </p>
          </div>
          <div className="text-right">
            <p className="num font-bold">{money(e.inst.amount)}</p>
            <Badge tone={INSTALLMENT_TONE[st]}>{INSTALLMENT_LABEL[st]}</Badge>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div>
      <PageHeader title="Calendrier des remboursements" icon={CalendarDays} subtitle="Échéances calculées depuis la date de début de chaque prêt fictif (horloge de simulation)." actions={<Segmented label="Vue" value={view} onChange={setView} options={[{ value: 'month', label: 'Mois' }, { value: 'list', label: 'Liste' }]} />} />
      {entries.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title="Aucune échéance" action={<Button onClick={() => navigate('/prets/simulateur')}>Simuler un prêt</Button>}>
            Les échéances des prêts fictifs actifs apparaîtront ici.
          </EmptyState>
        </Card>
      ) : view === 'month' ? (
        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="p-4 sm:p-5 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <IconButton icon={ChevronLeft} label="Mois précédent" onClick={() => shift(-1)} />
              <div className="text-center">
                <p className="text-lg font-bold capitalize">{formatMonth(cursor)}</p>
                <p className="num text-xs text-muted">Reste à payer ce mois : {money(monthTotal)}</p>
              </div>
              <IconButton icon={ChevronRight} label="Mois suivant" onClick={() => shift(1)} />
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={i} />;
                const items = byDay.get(day) ?? [];
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                    aria-label={`${formatDate(day, 'long')}${items.length ? `, ${items.length} échéance(s)` : ''}`}
                    aria-pressed={selectedDay === day}
                    className={clsx(
                      'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition',
                      day === today && 'ring-2 ring-brand',
                      selectedDay === day ? 'bg-brand text-white' : items.length ? 'bg-brand-soft/60 font-bold hover:bg-brand-soft' : 'hover:bg-raised',
                    )}
                  >
                    {Number(day.slice(8))}
                    {items.length > 0 && (
                      <span className="flex gap-0.5">
                        {items.slice(0, 3).map((e) => (
                          <span key={`${e.loan.id}-${e.inst.index}`} className={clsx('h-1.5 w-1.5 rounded-full', DOT[INSTALLMENT_TONE[installmentDisplayStatus(e.inst, today, e.loan)]])} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
              {(['upcoming', 'late', 'paid', 'partial', 'deferred'] as const).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={clsx('h-2 w-2 rounded-full', DOT[INSTALLMENT_TONE[s]])} /> {INSTALLMENT_LABEL[s]}
                </span>
              ))}
            </div>
          </Card>
          <Card className="p-4 sm:p-5 lg:col-span-2">
            <h2 className="mb-2 text-lg font-bold">{selectedDay ? formatDate(selectedDay, 'long') : 'Échéances du mois'}</h2>
            {dayList.length ? <ul>{dayList.map(row)}</ul> : <p className="py-6 text-center text-sm text-muted">Aucune échéance.</p>}
          </Card>
        </div>
      ) : (
        <Card className="p-3 sm:p-5">
          <ul className="divide-y divide-line">{entries.map(row)}</ul>
        </Card>
      )}
    </div>
  );
}
