import { CircleHelp, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Callout, Card, PageHeader } from '../components/ui';
import { useBank } from '../store/bank';

const FAQ: { q: string; a: React.ReactNode }[] = [
  { q: 'Est-ce une vraie banque ?', a: 'Non. Il s’agit d’une application de démonstration. Aucun compte réel n’est ouvert, aucun fonds n’est détenu, aucun paiement n’est émis. Elle n’est affiliée à aucun établissement bancaire ou fintech.' },
  { q: 'Où sont stockées mes données ?', a: 'Uniquement dans le stockage local de votre navigateur. Rien n’est envoyé à un serveur. Vider les données du site ou utiliser la page Réinitialisation les efface.' },
  { q: 'Comment l’argent fictif est-il calculé ?', a: 'Chaque montant est un entier en centimes. Les soldes ne sont jamais stockés : ils sont recalculés à partir du grand livre des opérations, ce qui garantit que l’historique et les soldes concordent toujours.' },
  { q: 'Les cartes peuvent-elles payer en ligne ?', a: 'Non. Les identifiants « DEMO » ne respectent aucun format de réseau de paiement et ne sont rattachés à rien. Ils servent uniquement aux dépenses simulées de l’application.' },
  { q: 'Comment fonctionne la décision de prêt ?', a: <>Un moteur local applique des règles de démonstration (limites du scénario, motif requis, plafond d’encours, avertissement de solde). Ce n’est pas une analyse de solvabilité. Le mode manuel des <Link className="font-semibold text-brand-ink" to="/parametres">paramètres</Link> permet de choisir le résultat.</> },
  { q: 'Comment la mensualité est-elle calculée ?', a: 'M = P × r / (1 − (1 + r)^−n), avec r le taux annuel fictif divisé par 12. Les intérêts de chaque mois sont arrondis au centime et la dernière échéance absorbe l’écart d’arrondi pour solder exactement le capital.' },
  { q: 'Que se passe-t-il lors d’un remboursement anticipé ?', a: 'Le capital remboursé réduit le capital restant dû, puis les échéances futures sont recalculées (durée ou mensualité réduite au choix). Aucune pénalité n’est appliquée par défaut ; des frais de simulation peuvent être activés et sont toujours affichés séparément.' },
  { q: 'Puis-je annuler une opération ?', a: 'Rien n’est supprimé sans trace. Une correction crée une contrepassation liée à l’opération initiale. Pour un prêt, seule la dernière opération peut être contrepassée afin de garder un échéancier cohérent.' },
  { q: 'Comment tester des échéances en retard ?', a: <>Avancez l’<Link className="font-semibold text-brand-ink" to="/parametres#horloge">horloge de simulation</Link> : les échéances passées apparaissent « en retard dans la simulation ».</> },
];

export default function Help() {
  const appName = useBank((s) => s.state.settings.appName);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Centre d’aide" icon={CircleHelp} subtitle={`Tout comprendre de ${appName}.`} />
      <Card className="p-6" id="simulation">
        <p className="text-xs font-extrabold uppercase tracking-[.14em] text-brand-ink">Simulation bancaire — argent et crédits fictifs</p>
        <h2 className="mt-2 text-xl font-bold">Une application de démonstration</h2>
        <p className="mt-2 text-muted">
          {appName} imite l’ergonomie d’une application bancaire mobile pour tester des parcours : comptes, cartes, virements, coffres, budgets et un module complet de prêts fictifs. Tous les montants, taux, décisions et documents sont fictifs et sans valeur bancaire ou contractuelle.
        </p>
        <Callout tone="warn" className="mt-4">
          N’y saisissez jamais de données réelles : ni identité, ni coordonnées bancaires, ni numéro de carte. L’application ne les demande pas et n’en a pas besoin.
        </Callout>
      </Card>
      <Card className="divide-y divide-line">
        {FAQ.map((f) => (
          <details key={f.q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
              {f.q}
              <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="mt-2 text-sm text-muted">{f.a}</div>
          </details>
        ))}
      </Card>
      <Card className="p-5 text-sm text-muted">
        Raccourcis : <Link className="font-semibold text-brand-ink" to="/prets/simulateur">Simulateur</Link> · <Link className="font-semibold text-brand-ink" to="/journal">Journal de simulation</Link> · <Link className="font-semibold text-brand-ink" to="/reinitialisation">Réinitialisation</Link>
      </Card>
    </div>
  );
}
