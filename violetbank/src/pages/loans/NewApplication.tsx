import clsx from 'clsx';
import { ArrowLeft, ArrowRight, FileCheck2, Send } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AccountSelect } from '../../components/AccountSelect';
import { DecisionPanel } from '../../components/LoanDecision';
import { AmountField, DurationField, ProductSelect, RateAndDateFields } from '../../components/LoanParamsFields';
import { ProductIcon, SimulationDisclaimer } from '../../components/LoanParts';
import { Button, Callout, Card, Field, KeyValue, PageHeader, TextArea } from '../../components/ui';
import { formatDate } from '../../domain/dates';
import { createApplication, submitApplication, updateApplication, validateApplicationInput, type ApplicationInput } from '../../domain/loans';
import { formatRate } from '../../domain/money';
import { useActiveAccounts, useBankState, useBusy, useMoney, useToday } from '../../lib/hooks';
import { REPAYMENT_MODE_LABEL } from '../../lib/labels';
import { useLoanParams } from '../../lib/loanParams';
import { useBank } from '../../store/bank';

const STEPS = ['Montant', 'Durée', 'Motif', 'Récapitulatif', 'Confirmation', 'Décision'];
const PURPOSES = ['Achat informatique', 'Téléphone', 'Projet personnel', 'Dépense imprévue', 'Équipement', 'Voyage', 'Autre'];

export default function NewApplication() {
  const state = useBankState();
  const today = useToday();
  const money = useMoney();
  const accounts = useActiveAccounts();
  const act = useBank((s) => s.act);
  const { busy, run } = useBusy(500);
  const [query] = useSearchParams();
  const editId = query.get('edit');
  const editing = editId ? state.loanApplications.find((a) => a.id === editId && ['draft', 'refused', 'info_required'].includes(a.status)) : undefined;

  // En édition, les paramètres du dossier initialisent le formulaire via la même mécanique que l'URL.
  const initQuery = useMemo(() => {
    if (!editing) return query;
    const q = new URLSearchParams();
    q.set('produit', editing.productId);
    q.set('montant', String(editing.amount));
    q.set('duree', String(editing.months));
    q.set('taux', String(editing.annualRateBps));
    q.set('debut', editing.startDate);
    q.set('mode', editing.repaymentMode);
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const ctl = useLoanParams({ products: state.loanProducts.filter((p) => p.enabled), today, query: initQuery });
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState(editing?.purpose ?? '');
  const [account, setAccount] = useState(editing?.accountId ?? accounts[0]?.id ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const q = ctl.quote;

  const input: ApplicationInput | null =
    ctl.amount.ok && ctl.rate.ok
      ? { productId: ctl.params.productId, amount: ctl.amount.cents, months: ctl.params.months, annualRateBps: ctl.rate.bps, repaymentMode: ctl.params.mode, startDate: ctl.params.startDate, purpose, accountId: account }
      : null;
  const blocking = input ? validateApplicationInput(state, input, today) : ['Paramètres incomplets.'];

  const next = () => {
    setError(null);
    if (step === 0 && (ctl.errors.amount || ctl.errors.minPerMonth)) return setError(ctl.errors.amount ?? ctl.errors.minPerMonth);
    if (step === 1 && (ctl.errors.months || ctl.errors.rate || !q)) return setError(ctl.errors.months ?? ctl.errors.rate ?? 'Paramètres invalides.');
    if (step === 3 && blocking.length) return setError(blocking[0] ?? null);
    setStep((s) => Math.min(s + 1, 4));
  };

  const submit = () =>
    run(() => {
      if (!input || !confirmed) return setError('Cochez la confirmation pour créer la demande de démonstration.');
      if (editing) {
        const upd = act((s, ctx) => updateApplication(s, ctx, editing.id, input), { success: false, quietError: true });
        if (!upd.ok) return setError(upd.error);
        const sub = act((s, ctx) => submitApplication(s, ctx, editing.id), { success: 'Demande modifiée et soumise.', quietError: true });
        if (!sub.ok) return setError(sub.error);
        setAppId(editing.id);
      } else {
        const res = act((s, ctx) => createApplication(s, ctx, input, true), { success: 'Demande de démonstration créée.', quietError: true });
        if (!res.ok) return setError(res.error);
        setAppId(res.data.id);
      }
      setStep(5);
    });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={editing ? `Modifier la demande ${editing.reference}` : 'Nouvelle demande de prêt fictif'} icon={FileCheck2} subtitle="Parcours de démonstration en 6 étapes. Aucun document ni information sensible n’est demandé." />
      <ol className="mb-6 grid grid-cols-6 gap-1.5" aria-label="Étapes de la demande">
        {STEPS.map((l, i) => (
          <li key={l} aria-current={i === step ? 'step' : undefined}>
            <div className={clsx('h-1.5 rounded-full transition', i <= step ? 'bg-brand' : 'bg-line')} />
            <span className={clsx('mt-1.5 hidden text-xs font-semibold sm:block', i === step ? 'text-ink' : 'text-muted')}>
              {i + 1}. {l}
            </span>
          </li>
        ))}
      </ol>
      <p className="mb-3 text-sm font-semibold text-muted sm:hidden">
        Étape {step + 1}/6 · {STEPS[step]}
      </p>
      <Card className="p-5 sm:p-7">
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Quel montant fictif souhaitez-vous ?</h2>
            <ProductSelect ctl={ctl} />
            {ctl.product && (
              <div className="flex items-center gap-3 rounded-2xl bg-raised p-3 text-sm">
                <ProductIcon product={ctl.product} size={38} />
                <span className="text-muted">{ctl.product.description}</span>
              </div>
            )}
            <AmountField ctl={ctl} />
          </div>
        )}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Sur quelle durée ?</h2>
            <DurationField ctl={ctl} />
            <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-5 text-white">
              <p className="text-sm text-white/80">Mensualité calculée</p>
              <p className="num text-3xl font-extrabold" data-testid="wizard-payment">{q ? money(q.firstPayment) : '—'}</p>
              {q && <p className="mt-1 text-sm text-white/80">Total théorique {money(q.totalAmount)} · intérêts {money(q.totalInterest)}</p>}
            </div>
            <RateAndDateFields ctl={ctl} />
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Motif (facultatif)</h2>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => (
                <button key={p} type="button" onClick={() => setPurpose(p)} className={clsx('rounded-xl border px-3 py-1.5 text-sm font-semibold', purpose === p ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line')}>
                  {p}
                </button>
              ))}
            </div>
            <Field label="Motif libre" htmlFor="purpose" hint={ctl.product?.requiresPurpose ? 'Ce scénario exige un motif : sans motif, la simulation renverra « informations manquantes ».' : 'Texte libre, aucun justificatif.'}>
              <TextArea id="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={200} placeholder="Ex. Ordinateur portable pour mes projets" />
            </Field>
            <AccountSelect value={account} onChange={setAccount} label="Compte qui recevra le capital fictif" />
          </div>
        )}
        {step === 3 && q && input && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Récapitulatif</h2>
            <dl className="divide-y divide-line rounded-2xl border border-line px-4">
              <KeyValue label="Scénario" value={ctl.product?.name} />
              <KeyValue label="Montant fictif demandé" value={money(input.amount)} strong />
              <KeyValue label="Durée" value={`${input.months} mois`} />
              <KeyValue label="Taux fictif" value={formatRate(input.annualRateBps)} />
              <KeyValue label={input.repaymentMode === 'annuity' ? 'Mensualité estimée' : 'Première mensualité'} value={money(q.firstPayment)} />
              <KeyValue label="Total théorique à rembourser" value={money(q.totalAmount)} />
              <KeyValue label="Intérêts théoriques" value={money(q.totalInterest)} />
              <KeyValue label="Date de début envisagée" value={formatDate(input.startDate, 'long')} />
              <KeyValue label="Mode" value={REPAYMENT_MODE_LABEL[input.repaymentMode]} />
              <KeyValue label="Motif" value={purpose || '—'} />
              <KeyValue label="Compte crédité" value={accounts.find((a) => a.id === account)?.name} />
            </dl>
            <Callout tone="brand" title="Conditions de la simulation">
              Les taux sont hypothétiques, la décision est produite par des règles locales de démonstration et le capital éventuellement crédité est de l’argent de test. Aucun frais n’est appliqué.
            </Callout>
            {ctl.outOfLimits && <Callout tone="warn">Montant hors limites du scénario : la simulation refusera la demande avec une explication.</Callout>}
          </div>
        )}
        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Confirmation</h2>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-4">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 accent-[rgb(var(--brand))]" />
              <span className="text-sm">Je confirme vouloir créer une <strong>demande de démonstration</strong>. Je comprends qu’il ne s’agit pas d’une demande de crédit réelle et qu’aucune banque ne l’examinera.</span>
            </label>
            <SimulationDisclaimer />
          </div>
        )}
        {step === 5 && appId && <DecisionPanel appId={appId} autoStart />}

        {error && step < 5 && (
          <p role="alert" className="mt-4 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {step < 5 && (
          <div className="mt-6 flex gap-2 border-t border-line pt-5">
            {step > 0 && (
              <Button variant="secondary" icon={ArrowLeft} onClick={() => { setError(null); setStep((s) => s - 1); }} disabled={busy}>
                Retour
              </Button>
            )}
            <div className="flex-1" />
            {step < 4 ? (
              <Button onClick={next} disabled={step === 3 && !q}>
                Continuer <ArrowRight size={18} aria-hidden />
              </Button>
            ) : (
              <Button icon={Send} onClick={() => void submit()} loading={busy} disabled={!confirmed} data-testid="submit-application">
                Créer la demande
              </Button>
            )}
          </div>
        )}
        {step === 5 && (
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-line pt-5 text-sm">
            <Link to="/prets/demandes" className="font-semibold text-brand-ink hover:underline">Mes demandes</Link>
            <Link to="/prets/mes-prets" className="font-semibold text-brand-ink hover:underline">Mes prêts</Link>
          </div>
        )}
      </Card>
    </div>
  );
}
