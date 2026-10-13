// Démarre un serveur de test isolé : base neuve à chaque exécution.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'e2e', '.data');
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

const child = spawn(path.join(root, 'node_modules', '.bin', 'tsx'), ['src/index.ts'], {
  cwd: path.join(root, 'server'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
    NODE_OPTIONS: '--disable-warning=ExperimentalWarning',
    PORT: process.env.E2E_PORT ?? '4700',
    HOST: '127.0.0.1',
    DATABASE_FILE: path.join(dataDir, 'e2e.db'),
    APP_PASSWORD: 'e2e-password',
    SERVE_CLIENT: 'true',
    SIMULATION_SPEED: 'demo',
    SCHEDULER_INTERVAL_MS: '250',
    AI_PROVIDER: 'local',
    ANTHROPIC_API_KEY: '',
    RATE_LIMIT_PER_MINUTE: '100000',
    LOG_LEVEL: 'warn',
  },
});
const stop = () => child.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => process.exit(code ?? 0));
