import { bootstrap } from './ui/App.js';

try {
  bootstrap();
} catch (e) {
  // Échec avant que l'interface n'existe : message brut plutôt qu'un écran vide.
  document.body.textContent = `Impossible de démarrer le laboratoire : ${e instanceof Error ? e.message : String(e)}`;
  throw e;
}

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {
    /* hors ligne indisponible : l'application fonctionne normalement en ligne */
  });
}
