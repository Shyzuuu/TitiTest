import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PROJECT_ROOT, SERVER_ROOT } from './config.js';

/** Charge `.env` depuis la racine du projet puis `server/.env` (les variables déjà définies priment). */
export function loadEnvFiles(): void {
  for (const file of [path.join(PROJECT_ROOT, '.env'), path.join(SERVER_ROOT, '.env')]) {
    if (fs.existsSync(file)) dotenv.config({ path: file, quiet: true });
  }
}
