import { CheckCircle2, CircleAlert, FileWarning, Hourglass, Pencil, Play, Rocket, Trash2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatDate } from '../domain/dates';
import { quoteLoan } from '../domain/loanMath';
import { activateLoan, cancelApplication, decideApplication, submitApplication } from '../domain/loans';
import { formatRate } from '../domain/money';
import { useBalances, useBankState, useBusy, useMoney } from '../lib/hooks';
import { APP_STATUS_LABEL, APP_STATUS_TONE, REPAYMENT_MODE_LABEL } from '../lib/labels';
import { useBank } from '../store/bank';
import { AccountSelect } from './AccountSelect';
import { ScheduleTable } from './LoanParts';
import { Badge, Button, Callout, ConfirmDialog, KeyValue, SuccessCheck } from './ui';

const ANALYSIS_STEPS = ['Vérification des limites du scénario…', 'Application des règles locales de démonstration…', 'Calcul de l’échéancier fictif…'];

export function DecisionPanel({ appId, autoStart = false }: { appId: string; autoStart?: boolean }) {
  const state = useBankState();
  const act = useBank((s) => s.act);
  const money = useMoney();
  const balances = useBalances();
  const navigate = useNavigate();
  const app = state.loanApplications.find((a) => a.id === appId);
  const product = state.loanProducts.find((p) => p.id === app?.productId);
  const manual = state.settings.decisionMode === 'manual';
  const [analysing, setAnalysing] = useState(false);
  const [stepText, setStepText] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);
  const [activating, setActivating] = useState(false);
  const [account, setAccount] = useState(app?.accountId ?? '');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { busy, run } = useBusy(600);
  const started = useRef(false);

  const runDecision = (outcome?: 'accepted' | 'refused' | 'info_required') => {
    if (analysing) return;
    setAnalysing(true);
    setStepText(0);
    // Courte animation d'analyse : la décision est calculée localement et instantanément.
    const timers = [setTimeout(() => setStepText(1), 450), setTimeout(() => setStepText(2), 900)];
    setTimeout(() => {
      timers.forEach(clearTimeout);
      act((s, ctx) => decideApplication(s, ctx, appId, outcome), { success: false });
      setAnalysing(false);
    }, 1300);
  };

  useEffect(() => {
    if (autoStart && !manual && app?.status === 'pending' && !started.current) {
      started.current = true;
      runDecision();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, manual, app?.status]);

  if (!app) return <Callout tone="danger">Dossier introuvable.</Callout>;
  const quote = quoteLoan({ principal: app.amount, annualRateBps: app.annualRateBps, months: app.months, mode: app.repaymentMode, startDate: app.startDate });
  const loan = app.loanId ? state.loans.find((l) => l.id === app.loanId) : undefined;

  const recap = (
    <dl className="divide-y divide-line rounded-2xl border border-line px-4">
      <KeyValue label="Identifiant de dossier fictif" value={<span className="font-mono">{app.reference}</span>} />
      <KeyValue label="Scénario" value={product?.name ?? '—'} />
      <KeyValue label="Capital fictif demandé" value={money(app.amount)} strong />
      <KeyValue label="Durée choisie" value={`${app.months} mois`} />
      <KeyValue label="Taux fictif" value={formatRate(app.annualRateBps)} />
      <KeyValue label={app.repaymentMode === 'annuity' ? 'Mensualité calculée' : 'Première mensualité'} value={money(quote.firstPayment)} />
      <KeyValue label="Coût total théorique (intérêts)" value={money(quote.totalInterest)} />
      <KeyValue label="Total théorique à rembourser" value={money(quote.totalAmount)} />
      <KeyValue label="Date de début prévue" value={formatDate(app.startDate, 'long')} />
      <KeyValue label="Mode" value={REPAYMENT_MODE_LABEL[app.repaymentMode]} />
    </dl>
  );

  if (analysing || (app.status === 'pending' && autoStart && !manual && !started.current)) {
    return (
      <div className="flex flex-col items-center py-10 text-center" aria-live="polite">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
          <Hourglass className="absolute inset-0 m-auto text-brand" size={28} aria-hidden />
        </div>
        <p className="mt-5 text-lg font-bold">Demande en cours de simulation</p>
        <p className="mt-1 text-sm text-muted">{ANALYSIS_STEPS[stepText]}</p>
        <p className="mt-4 max-w-sm text-xs text-muted">Moteur local de démonstration : aucune banque ni aucun organisme n’examine cette demande.</p>
      </div>
    );
  }

  if (activating && app.status === 'accepted') {
    const balance = balances.accounts.get(account) ?? 0;
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Activer le scénario de prêt</h3>
        <Callout tone="brand">Cette opération ne crée que de l’argent de test dans l’application, assorti d’une dette de démonstration du même montant.</Callout>
        <AccountSelect value={account} onChange={setAccount} label="Compte de simulation crédité" />
        <dl className="divide-y divide-line rounded-2xl border border-line px-4">
          <KeyValue label="Capital fictif crédité" value={money(app.amount)} strong />
          <KeyValue label="Solde du compte avant" value={money(balance)} />
          <KeyValue label="Solde du compte après" value={money(balance + app.amount)} tone="ok" />
          <KeyValue label="Capital restant dû initial" value={money(app.amount)} />
          <KeyValue label="Échéances générées" value={`${quote.count} · 1re le ${formatDate(quote.rows[0]?.dueDate ?? app.startDate)}`} />
        </dl>
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={() => setActivating(false)} disabled={busy}>
            Retour
          </Button>
          <Button
            block
            icon={Rocket}
            loading={busy}
            data-testid="confirm-activation"
            onClick={() =>
              void run(() => {
                const res = act((s, ctx) => activateLoan(s, ctx, app.id, account));
                if (res.ok) setActivating(false);
              })
            }
          >
            Confirmer l’activation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={APP_STATUS_TONE[app.status]}>{APP_STATUS_LABEL[app.status]}</Badge>
        {app.decidedBy && <Badge tone="neutral">{app.decidedBy === 'auto' ? 'Règles locales' : 'Mode manuel'}</Badge>}
      </div>

      {app.status === 'accepted' && (
        <div className="flex items-center gap-3 rounded-2xl bg-ok/10 p-4">
          <CheckCircle2 className="shrink-0 text-ok" size={28} aria-hidden />
          <div>
            <p className="text-lg font-bold">Demande acceptée dans la simulation</p>
            <p className="text-sm text-muted">{app.decisionReason} Ce n’est pas une décision officielle de crédit.</p>
          </div>
        </div>
      )}
      {app.status === 'refused' && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger/10 p-4">
          <XCircle className="mt-0.5 shrink-0 text-danger" size={26} aria-hidden />
          <div>
            <p className="text-lg font-bold">Demande refusée dans la simulation</p>
            <p className="text-sm">{app.decisionReason}</p>
          </div>
        </div>
      )}
      {app.status === 'info_required' && (
        <div className="flex items-start gap-3 rounded-2xl bg-warn/10 p-4">
          <FileWarning className="mt-0.5 shrink-0 text-warn" size={26} aria-hidden />
          <div>
            <p className="text-lg font-bold">Informations manquantes</p>
            <p className="text-sm">{app.decisionReason}</p>
          </div>
        </div>
      )}
      {app.decisionWarnings.map((w) => (
        <Callout key={w} tone="warn">
          {w}
        </Callout>
      ))}
      {app.status === 'activated' && loan && (
        <div className="flex flex-col items-center py-4 text-center">
          <SuccessCheck />
          <p className="mt-3 text-lg font-bold">Prêt fictif {loan.reference} actif</p>
          <p className="text-sm text-muted">{money(loan.principal)} de capital fictif crédités une seule fois.</p>
          <Link to={`/prets/${loan.id}`} className="mt-4">
            <Button>Ouvrir la fiche du prêt</Button>
          </Link>
        </div>
      )}

      {recap}

      {app.status === 'pending' && (
        <div className="space-y-3">
          <Callout tone="info" title="Demande en cours de simulation">
            {manual ? 'Mode manuel actif : choisissez le résultat à appliquer pour tester l’interface.' : 'Lancez le moteur de décision local.'}
          </Callout>
          {manual ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="soft" onClick={() => runDecision('accepted')}>Accepter</Button>
              <Button variant="secondary" onClick={() => runDecision('refused')}>Refuser</Button>
              <Button variant="secondary" onClick={() => runDecision('info_required')}>Infos manquantes</Button>
            </div>
          ) : (
            <Button block icon={Play} onClick={() => runDecision()}>
              Lancer la décision simulée
            </Button>
          )}
        </div>
      )}

      {app.status === 'accepted' && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={() => setShowSchedule((v) => !v)}>
            {showSchedule ? 'Masquer l’échéancier' : 'Voir mon échéancier'}
          </Button>
          <Button icon={Rocket} onClick={() => setActivating(true)} data-testid="activate-loan">
            Activer le scénario de prêt
          </Button>
        </div>
      )}
      {showSchedule && <ScheduleTable rows={quote.rows} max={12} />}

      {(app.status === 'refused' || app.status === 'info_required' || app.status === 'draft') && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button icon={Pencil} onClick={() => navigate(`/prets/nouvelle?edit=${app.id}`)}>
            {app.status === 'info_required' ? 'Compléter la demande' : 'Modifier le montant ou la durée'}
          </Button>
          {app.status === 'draft' && (
            <Button variant="soft" icon={Play} onClick={() => act((s, ctx) => submitApplication(s, ctx, app.id), { success: false })}>
              Soumettre
            </Button>
          )}
        </div>
      )}

      {['draft', 'pending', 'accepted', 'refused', 'info_required'].includes(app.status) && (
        <button type="button" onClick={() => setConfirmCancel(true)} className="flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline">
          <Trash2 size={15} aria-hidden /> Annuler cette demande
        </button>
      )}
      {app.status === 'cancelled' && (
        <Callout tone="info">
          <span className="inline-flex items-center gap-1.5"><CircleAlert size={14} aria-hidden /> Demande annulée par l’utilisateur. Elle reste visible dans l’historique.</span>
        </Callout>
      )}
      <ConfirmDialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Annuler la demande ?"
        tone="danger"
        confirmLabel="Annuler la demande"
        onConfirm={() => {
          if (act((s, ctx) => cancelApplication(s, ctx, app.id)).ok) setConfirmCancel(false);
        }}
      >
        Le dossier {app.reference} sera marqué comme annulé et ne pourra plus être activé.
      </ConfirmDialog>
    </div>
  );
}
