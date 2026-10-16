import { Component, lazy, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/Layout';
import { Button, Skeleton } from './components/ui';
import { Home } from './pages/Home';

const Accounts = lazy(() => import('./pages/Accounts'));
const Cards = lazy(() => import('./pages/Cards'));
const History = lazy(() => import('./pages/History'));
const SendMoney = lazy(() => import('./pages/Send'));
const Receive = lazy(() => import('./pages/Receive'));
const Transfers = lazy(() => import('./pages/Transfers'));
const Contacts = lazy(() => import('./pages/Contacts'));
const LoansHome = lazy(() => import('./pages/loans/LoansHome'));
const MyLoans = lazy(() => import('./pages/loans/MyLoans'));
const Applications = lazy(() => import('./pages/loans/Applications'));
const NewApplication = lazy(() => import('./pages/loans/NewApplication'));
const LoanDetail = lazy(() => import('./pages/loans/LoanDetail'));
const LoanCalendar = lazy(() => import('./pages/loans/Calendar'));
const Simulator = lazy(() => import('./pages/loans/Simulator'));
const Comparator = lazy(() => import('./pages/loans/Comparator'));
const Repayment = lazy(() => import('./pages/loans/Repayment'));
const Vaults = lazy(() => import('./pages/Vaults'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Stats = lazy(() => import('./pages/Stats'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Help = lazy(() => import('./pages/Help'));
const Journal = lazy(() => import('./pages/Journal'));
const Reset = lazy(() => import('./pages/Reset'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
    </div>
  );
}

/** Une erreur de rendu ne doit jamais bloquer l'application entière. */
class PageBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold">Cette page a rencontré une erreur</h1>
        <p className="mt-2 text-sm text-muted">Vos données de simulation ne sont pas affectées. Détail : {this.state.error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => this.setState({ error: null })}>
            Réessayer
          </Button>
          <Button onClick={() => window.location.assign('/')}>Retour à l’accueil</Button>
        </div>
      </div>
    );
  }
}

export function App() {
  return (
    <AppShell>
      <PageBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/comptes" element={<Accounts />} />
            <Route path="/cartes" element={<Cards />} />
            <Route path="/historique" element={<History />} />
            <Route path="/envoyer" element={<SendMoney />} />
            <Route path="/recevoir" element={<Receive />} />
            <Route path="/virements" element={<Transfers />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/prets" element={<LoansHome />} />
            <Route path="/prets/mes-prets" element={<MyLoans />} />
            <Route path="/prets/demandes" element={<Applications />} />
            <Route path="/prets/nouvelle" element={<NewApplication />} />
            <Route path="/prets/calendrier" element={<LoanCalendar />} />
            <Route path="/prets/simulateur" element={<Simulator />} />
            <Route path="/prets/comparateur" element={<Comparator />} />
            <Route path="/prets/remboursement" element={<Repayment />} />
            <Route path="/prets/:loanId" element={<LoanDetail />} />
            <Route path="/coffres" element={<Vaults />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/statistiques" element={<Stats />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profil" element={<Profile />} />
            <Route path="/parametres" element={<SettingsPage />} />
            <Route path="/aide" element={<Help />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/reinitialisation" element={<Reset />} />
            <Route path="/transactions" element={<Navigate to="/historique" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PageBoundary>
    </AppShell>
  );
}
