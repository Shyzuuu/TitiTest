import { Database, Download, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { validateState } from '../domain/persistence';
import { useUi } from '../store/ui';
import { useNavigate } from 'react-router-dom';
import { Button, Callout, Card, ConfirmDialog, PageHeader, TextInput } from '../components/ui';
import { makeCtx, withLog } from '../domain/core';
import { createDemoState, createEmptyState } from '../domain/seed';
import { exportFile } from '../lib/native';
import { useBankState, useToday } from '../lib/hooks';
import { useBank } from '../store/bank';

export default function Reset() {
  const state = useBankState();
  const replace = useBank((s) => s.replace);
  const today = useToday();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState<'empty' | 'demo' | null>(null);
  const [typed, setTyped] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const toast = useUi((s) => s.toast);

  // Restauration : le fichier passe par la même validation (schéma + intégrité) qu'au démarrage.
  const restore = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 15_000_000) return toast('error', 'Fichier trop volumineux', 'Une sauvegarde VBanque fait au plus quelques mégaoctets.');
    try {
      const result = validateState(JSON.parse(await file.text()));
      if (!result.ok) return toast('error', 'Sauvegarde refusée', result.error);
      replace(result.state, 'Sauvegarde restaurée.');
      navigate('/');
    } catch {
      toast('error', 'Sauvegarde illisible', 'Le fichier n’est pas un JSON VBanque valide.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const apply = (kind: 'empty' | 'demo') => {
    // Les préférences d'affichage survivent à la réinitialisation des données.
    const keep = { theme: state.settings.theme, animations: state.settings.animations, cardAnimations: state.settings.cardAnimations, sidebarCollapsed: state.settings.sidebarCollapsed };
    const ctx = makeCtx(null);
    const base = kind === 'empty' ? createEmptyState(ctx) : createDemoState(today);
    const next = withLog({ ...base, settings: { ...base.settings, ...keep } }, ctx, 'warning', kind === 'empty' ? 'Données réinitialisées' : 'Jeu d’exemple chargé', 'Toutes les données locales précédentes ont été remplacées.');
    replace(next, kind === 'empty' ? 'Données de démonstration effacées.' : 'Jeu de données d’exemple chargé.');
    setConfirm(null);
    setTyped('');
    navigate('/');
  };

  const counts = [
    ['Transactions', state.transactions.length],
    ['Cartes', state.cards.filter((c) => !c.deletedAt).length],
    ['Prêts', state.loans.length],
    ['Demandes', state.loanApplications.length],
    ['Coffres', state.vaults.filter((v) => !v.archived).length],
    ['Notifications', state.notifications.length],
  ] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Réinitialisation des données" icon={RotateCcw} subtitle="Les données sont stockées uniquement dans ce navigateur (stockage local)." />
      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-bold">
          <Database size={18} aria-hidden /> Données locales actuelles
        </h2>
        <dl className="grid grid-cols-3 gap-3 text-center">
          {counts.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-raised p-3">
              <dd className="num text-xl font-extrabold">{v}</dd>
              <dt className="text-xs text-muted">{k}</dt>
            </div>
          ))}
        </dl>
        <Button className="mt-4" variant="secondary" icon={Download} onClick={() => void exportFile(`violetbank-sauvegarde-${today}.json`, JSON.stringify(state, null, 2), 'application/json')}>
          Exporter une sauvegarde JSON
        </Button>
        <Button className="ml-2 mt-4" variant="ghost" icon={Upload} onClick={() => fileInput.current?.click()}>
          Restaurer une sauvegarde
        </Button>
        <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void restore(e.target.files?.[0])} aria-label="Fichier de sauvegarde VBanque" />
      </Card>
      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-bold">
          <Sparkles size={18} className="text-brand-ink" aria-hidden /> Charger le jeu de données d’exemple
        </h2>
        <p className="mt-1 text-sm text-muted">Comptes, cartes, 3 mois d’opérations, coffres, budgets, un prêt actif avec deux échéances payées et un dossier refusé — pour tester rapidement toutes les fonctionnalités.</p>
        <Button className="mt-4" icon={Sparkles} onClick={() => setConfirm('demo')}>
          Charger l’exemple
        </Button>
      </Card>
      <Card className="border-danger/40 p-5">
        <h2 className="flex items-center gap-2 font-bold text-danger">
          <Trash2 size={18} aria-hidden /> Tout effacer
        </h2>
        <p className="mt-1 text-sm text-muted">Repart d’un compte principal vide, sans opérations ni prêts. Les préférences d’affichage sont conservées.</p>
        <Button className="mt-4" variant="danger" icon={Trash2} onClick={() => setConfirm('empty')}>
          Réinitialiser
        </Button>
      </Card>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => {
          setConfirm(null);
          setTyped('');
        }}
        tone="danger"
        title={confirm === 'demo' ? 'Remplacer par le jeu d’exemple ?' : 'Effacer toutes les données ?'}
        confirmLabel={confirm === 'demo' ? 'Charger' : 'Effacer'}
        onConfirm={() => confirm && typed.trim().toUpperCase() === 'EFFACER' && apply(confirm)}
      >
        <Callout tone="danger">Cette action effacera les données locales de démonstration de ce navigateur (opérations, cartes, prêts, historique). Elle est irréversible, sauf sauvegarde JSON préalable.</Callout>
        <p className="mt-3 text-sm">
          Tapez <strong>EFFACER</strong> pour confirmer :
        </p>
        <TextInput className="mt-2" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Saisissez EFFACER pour confirmer" autoComplete="off" />
      </ConfirmDialog>
    </div>
  );
}
