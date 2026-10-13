import 'dotenv/config';
import { loadConfig } from './config.js';
import { Database } from './db/database.js';
import { migrate } from './db/migrations.js';
import { createContext, disposeContext } from './bootstrap.js';
import { resetDemoData } from './db/seed.js';

const command = process.argv[2];

async function run() {
  const config = loadConfig();
  switch (command) {
    case 'migrate': {
      const db = new Database(config.databaseFile);
      const applied = migrate(db, Date.now());
      db.close();
      console.log(applied.length ? `Migrations appliquées : ${applied.join(', ')}` : 'Base déjà à jour.');
      return;
    }
    case 'seed': {
      const ctx = createContext({ config, seed: true });
      console.log(`Base initialisée (${ctx.characters.list(ctx.auth.primaryUser().id).length} personnages).`);
      await disposeContext(ctx);
      return;
    }
    case 'reset': {
      const ctx = createContext({ config, seed: false });
      const n = resetDemoData(ctx, ctx.auth.primaryUser().id);
      console.log(`Données réinitialisées : ${n} personnages de démonstration.`);
      await disposeContext(ctx);
      return;
    }
    default:
      console.log('Usage : tsx src/cli.ts <migrate|seed|reset>');
      process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
