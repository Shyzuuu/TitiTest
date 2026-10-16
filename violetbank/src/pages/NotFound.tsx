import { Compass } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState } from '../components/ui';

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState icon={Compass} title="Page introuvable" action={<Button onClick={() => navigate('/')}>Retour à l’accueil</Button>}>
        Cette adresse ne correspond à aucune page de la simulation.
      </EmptyState>
    </Card>
  );
}
