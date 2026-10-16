import { Clock, Landmark, Palette, RotateCcw, Settings as SettingsIcon, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AmountInput } from '../components/AmountInput';
import { ProductIcon } from '../components/LoanParts';
import { Button, Callout, Card, Field, PageHeader, Segmented, Select, Switch, TextInput } from '../components/ui';
import { addDays, formatDate, isISODate, toISODate } from '../domain/dates';
import { CURRENCIES, centsToInput, formatRate, parseAmount, type CurrencyCode } from '../domain/money';
import { updateLoanProduct } from '../domain/misc';
import type { LoanProduct, Settings } from '../domain/schema';
import { useBankState, useToday } from '../lib/hooks';
import { bpsToInput, parseRate } from '../lib/loanParams';
import { useBank } from '../store/bank';
import { useUi } from '../store/ui';

function Section({ title, icon: I, children, id }: { title: string; icon: typeof Palette; children: React.ReactNode; id?: string }) {
  return (
    <Card className="p-5 sm:p-6" id={id}>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
        <I size={19} className="text-brand-ink" aria-hidden /> {title}
      </h2>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

function ProductEditor({ product }: { product: LoanProduct }) {
  const act = useBank((s) => s.act);
  const [open, setOpen] = useState(false);
  const [rate, setRate] = useState(bpsToInput(product.annualRateBps));
  const [minA, setMinA] = useState(centsToInput(product.minAmount));
  const [maxA, setMaxA] = useState(centsToInput(product.maxAmount));
  const [minM, setMinM] = useState(String(product.minMonths));
  const [maxM, setMaxM] = useState(String(product.maxMonths));
  const [error, setError] = useState<string | null>(null);
  const save = (patch: Partial<{ enabled: boolean; requiresPurpose: boolean }> = {}) => {
    const r = parseRate(rate);
    const a = parseAmount(minA);
    const b = parseAmount(maxA);
    if (!r.ok) return setError(r.error);
    if (!a.ok || !b.ok) return setError('Montants invalides.');
    const res = act(
      (s, ctx) =>
        updateLoanProduct(s, ctx, product.id, {
          annualRateBps: r.bps,
          minAmount: a.cents,
          maxAmount: b.cents,
          minMonths: Number(minM),
          maxMonths: Number(maxM),
          enabled: patch.enabled ?? product.enabled,
          requiresPurpose: patch.requiresPurpose ?? product.requiresPurpose,
        }),
      { quietError: true },
    );
    setError(res.ok ? null : res.error);
  };
  return (
    <div className="py-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 text-left" aria-expanded={open}>
        <ProductIcon product={product} size={36} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{product.name}</span>
          <span className="text-xs text-muted">
            {formatRate(product.annualRateBps)} · {product.minMonths}–{product.maxMonths} mois {product.enabled ? '' : '· désactivé'}
          </span>
        </span>
        <span className="text-sm font-semibold text-brand-ink">{open ? 'Fermer' : 'Configurer'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-2xl bg-raised/60 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Taux fictif (%)" htmlFor={`r-${product.id}`}>
              <TextInput id={`r-${product.id}`} value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" />
            </Field>
            <Field label="Durée min. (mois)" htmlFor={`mm-${product.id}`}>
              <TextInput id={`mm-${product.id}`} value={minM} onChange={(e) => setMinM(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </Field>
            <Field label="Durée max. (mois)" htmlFor={`xm-${product.id}`}>
              <TextInput id={`xm-${product.id}`} value={maxM} onChange={(e) => setMaxM(e.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <AmountInput label="Montant minimum" value={minA} onChange={setMinA} />
            <AmountInput label="Montant maximum" value={maxA} onChange={setMaxA} />
          </div>
          <Switch checked={product.enabled} onChange={(enabled) => save({ enabled })} label="Scénario actif" />
          <Switch checked={product.requiresPurpose} onChange={(requiresPurpose) => save({ requiresPurpose })} label="Motif obligatoire" description="Sans motif, la décision simulée renvoie « informations manquantes »." />
          {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
          <Button size="sm" onClick={() => save()}>
            Enregistrer le scénario
          </Button>
          <p className="text-xs text-muted">Les modifications s’appliquent aux futures demandes ; les prêts existants ne sont pas réécrits.</p>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const state = useBankState();
  const today = useToday();
  const update = useBank((s) => s.update);
  const toast = useUi((s) => s.toast);
  const s = state.settings;
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => update((st) => ({ ...st, settings: { ...st.settings, [key]: value } }));
  const [appName, setAppName] = useState(s.appName);
  const [maxDebt, setMaxDebt] = useState(centsToInput(s.maxTotalDebt));
  const [fee, setFee] = useState(bpsToInput(s.earlyRepaymentFeeBps));
  const [simDate, setSimDate] = useState(s.simulationDate ?? toISODate(new Date()));
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Paramètres" icon={SettingsIcon} subtitle="Préférences et règles de la démonstration, sauvegardées localement." />

      <Section title="Apparence" icon={Palette}>
        <div className="py-3">
          <span className="label">Thème</span>
          <Segmented label="Thème" value={s.theme} onChange={(v) => set('theme', v)} options={[{ value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }, { value: 'system', label: 'Système' }]} />
        </div>
        <div className="py-3">
          <Field label="Nom de l’application" htmlFor="app-name" error={errors.appName}>
            <div className="flex gap-2">
              <TextInput id="app-name" value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={32} />
              <Button
                variant="secondary"
                onClick={() => {
                  const v = appName.trim();
                  if (!v) return setErrors((e) => ({ ...e, appName: 'Le nom ne peut pas être vide.' }));
                  setErrors((e) => ({ ...e, appName: null }));
                  set('appName', v.slice(0, 32));
                  toast('success', 'Nom de l’application mis à jour');
                }}
              >
                Appliquer
              </Button>
            </div>
          </Field>
        </div>
        <div className="py-3">
          <Field label="Devise d’affichage" htmlFor="currency" hint="Change uniquement le symbole affiché : aucune conversion n’est appliquée aux montants fictifs.">
            <Select id="currency" value={s.currency} onChange={(e) => set('currency', e.target.value as CurrencyCode)}>
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
                <option key={c} value={c}>
                  {CURRENCIES[c].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Switch checked={s.animations} onChange={(v) => set('animations', v)} label="Animations" description="Transitions et effets. La préférence système « réduire les animations » est toujours respectée." />
        <Switch checked={s.cardAnimations} onChange={(v) => set('cardAnimations', v)} label="Effet 3D des cartes" />
        <Switch checked={s.balanceHidden} onChange={(v) => set('balanceHidden', v)} label="Masquer les soldes" />
        <Switch checked={s.notifications} onChange={(v) => set('notifications', v)} label="Notifications internes" description="Aucun SMS ni e-mail n’est jamais envoyé." />
      </Section>

      <Section title="Règles du crédit simulé" icon={SlidersHorizontal}>
        <div className="py-3">
          <span className="label">Mode de décision</span>
          <Segmented label="Mode de décision" value={s.decisionMode} onChange={(v) => set('decisionMode', v)} options={[{ value: 'auto', label: 'Règles locales' }, { value: 'manual', label: 'Manuel (test)' }]} />
          <p className="mt-1.5 text-xs text-muted">En mode manuel, vous choisissez le résultat de chaque demande pour tester l’interface.</p>
        </div>
        <Switch checked={s.balanceRule} onChange={(v) => set('balanceRule', v)} label="Avertissement de solde" description="Avertit si le solde de test est inférieur à une mensualité (sans refuser)." />
        <Switch checked={s.allowDeferral} onChange={(v) => set('allowDeferral', v)} label="Report d’échéance" description="Autorise le report d’une échéance d’un mois (sans intérêt supplémentaire)." />
        <div className="py-3">
          <AmountInput
            label="Plafond d’encours fictif"
            value={maxDebt}
            onChange={setMaxDebt}
            error={errors.maxDebt}
            hint="Au-delà, les nouvelles demandes sont refusées dans la simulation."
          />
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            onClick={() => {
              const p = parseAmount(maxDebt);
              if (!p.ok) return setErrors((e) => ({ ...e, maxDebt: p.error }));
              setErrors((e) => ({ ...e, maxDebt: null }));
              set('maxTotalDebt', p.cents);
              toast('success', 'Plafond mis à jour');
            }}
          >
            Appliquer
          </Button>
        </div>
        <div className="py-3">
          <Field label="Frais de remboursement anticipé fictifs (%)" htmlFor="fee" error={errors.fee} hint="0 par défaut. Affichés séparément avant toute confirmation. Maximum 10 %.">
            <div className="flex gap-2">
              <TextInput id="fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
              <Button
                variant="secondary"
                onClick={() => {
                  const r = parseRate(fee);
                  if (!r.ok || r.bps > 1000) return setErrors((e) => ({ ...e, fee: 'Valeur entre 0 et 10 %.' }));
                  setErrors((e) => ({ ...e, fee: null }));
                  set('earlyRepaymentFeeBps', r.bps);
                  toast('success', 'Frais de simulation mis à jour');
                }}
              >
                Appliquer
              </Button>
            </div>
          </Field>
        </div>
      </Section>

      <Section title="Horloge de simulation" icon={Clock} id="horloge">
        <div className="py-3">
          <p className="text-sm text-muted">
            Date utilisée par la simulation : <strong className="text-ink">{formatDate(today, 'long')}</strong> {s.simulationDate ? '(imposée)' : '(date réelle)'}
          </p>
          <p className="mt-1 text-xs text-muted">Permet de tester les échéances à venir, échues ou en retard sans attendre. Les nouvelles opérations sont datées selon cette horloge.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <TextInput type="date" value={simDate} onChange={(e) => setSimDate(e.target.value)} className="max-w-[200px]" aria-label="Date de simulation" />
            <Button
              variant="secondary"
              onClick={() => {
                if (!isISODate(simDate)) return toast('error', 'Date invalide');
                set('simulationDate', simDate);
                toast('success', `Horloge de test fixée au ${formatDate(simDate)}`);
              }}
            >
              Appliquer
            </Button>
            <Button variant="ghost" onClick={() => { const d = addDays(today, 30); setSimDate(d); set('simulationDate', d); }}>+30 jours</Button>
            <Button variant="ghost" disabled={!s.simulationDate} onClick={() => { set('simulationDate', null); setSimDate(toISODate(new Date())); }}>
              Revenir à la date réelle
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Scénarios de prêts et taux fictifs" icon={Landmark}>
        <div className="py-3">
          <Callout tone="brand">Les taux sont hypothétiques et ne représentent aucune offre commerciale.</Callout>
        </div>
        {state.loanProducts.map((p) => (
          <ProductEditor key={p.id} product={p} />
        ))}
      </Section>

      <Card className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">Réinitialisation et jeu d’exemple</p>
          <p className="text-sm text-muted">Effacer les données locales ou recharger les données de démonstration.</p>
        </div>
        <Link to="/reinitialisation">
          <Button variant="secondary" icon={RotateCcw}>Ouvrir</Button>
        </Link>
      </Card>
    </div>
  );
}
