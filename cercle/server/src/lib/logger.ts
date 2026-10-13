import type { Database } from '../db/database.js';
import type { Clock } from './clock.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MAX_PERSISTED_LOGS = 5000;

export interface Logger {
  debug(scope: string, message: string, data?: unknown): void;
  info(scope: string, message: string, data?: unknown): void;
  warn(scope: string, message: string, data?: unknown): void;
  error(scope: string, message: string, data?: unknown): void;
}

/**
 * Journal technique : console + table `logs` (consultable dans l'administration).
 * Les niveaux info et supérieurs sont persistés ; la table est purgée par rotation.
 */
export function createLogger(options: { db?: Database; clock: Clock; level: LogLevel; silent?: boolean }): Logger {
  let writes = 0;
  const write = (level: LogLevel, scope: string, message: string, data?: unknown) => {
    if (ORDER[level] < ORDER[options.level]) return;
    if (!options.silent) {
      const line = `[${new Date(options.clock.now()).toISOString()}] ${level.toUpperCase()} ${scope}: ${message}`;
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      if (data !== undefined) fn(line, data);
      else fn(line);
    }
    if (!options.db || ORDER[level] < ORDER.info) return;
    try {
      options.db.run(
        'INSERT INTO logs (level, scope, message, data_json, created_at) VALUES ($level, $scope, $message, $data, $at)',
        {
          level,
          scope,
          message: message.slice(0, 2000),
          data: data === undefined ? null : JSON.stringify(data, replacer).slice(0, 8000),
          at: options.clock.now(),
        },
      );
      if (++writes % 200 === 0) {
        options.db.run('DELETE FROM logs WHERE id <= (SELECT MAX(id) FROM logs) - $keep', { keep: MAX_PERSISTED_LOGS });
      }
    } catch {
      // Le journal ne doit jamais faire échouer l'opération appelante.
    }
  };
  return {
    debug: (s, m, d) => write('debug', s, m, d),
    info: (s, m, d) => write('info', s, m, d),
    warn: (s, m, d) => write('warn', s, m, d),
    error: (s, m, d) => write('error', s, m, d),
  };
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message };
  return value;
}
