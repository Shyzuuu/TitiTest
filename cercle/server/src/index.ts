import 'dotenv/config';
import { createContext, disposeContext } from './bootstrap.js';
import { createAppServer } from './app.js';
import { loadConfig } from './config.js';

async function main() {
  const config = loadConfig();
  const ctx = createContext({ config });
  const app = createAppServer(ctx);
  ctx.scheduler.start();

  await new Promise<void>((resolve) => app.server.listen(config.port, config.host, resolve));
  const aiProvider = ctx.ai.activeProviderId();
  ctx.logger.info('server', `Cercle démarré sur http://${config.host}:${config.port} (${config.env})`);
  ctx.logger.info(
    'server',
    aiProvider === 'anthropic'
      ? `Fournisseur IA : Claude (${config.ai.model}) — état non vérifié tant qu'aucun test n'a abouti`
      : 'Fournisseur IA : simulation locale (aucune IA réelle configurée)',
  );
  if (config.auth.passwordIsDefault) {
    ctx.logger.warn('server', `Mot de passe par défaut utilisé (identifiant « ${config.auth.username} »). Définissez APP_PASSWORD.`);
  }

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    ctx.logger.info('server', `Arrêt demandé (${signal})`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await app.close();
    await disposeContext(ctx);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Échec du démarrage :', err instanceof Error ? err.message : err);
  process.exit(1);
});
