/**
 * Lightweight leveled logger for face-engine.
 *
 * Providers previously wrote straight to `console`, which made the face
 * pipeline's diagnostic output impossible to silence or filter in
 * production. This tiny wrapper adds:
 *   - a log-level gate (`FACE_ENGINE_LOG_LEVEL` env var, default `info`),
 *   - namespaced prefixes so multi-provider logs are greppable, and
 *   - a single choke point for future sinks (structured JSON, pino, etc.).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const LEVELS = Object.keys(LEVEL_ORDER) as LogLevel[];

function resolveInitialLevel(): LogLevel {
  const raw = (process.env.FACE_ENGINE_LOG_LEVEL || 'info').toLowerCase() as LogLevel;
  return LEVELS.includes(raw) ? raw : 'info';
}

let currentLevel: LogLevel = resolveInitialLevel();

/** Programmatically set the global log level (e.g. from tests). */
export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

/** Current global log level. */
export function getLogLevel(): LogLevel {
  return currentLevel;
}

export interface FaceEngineLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Create a namespaced logger for a face-engine component. */
export function createLogger(namespace: string): FaceEngineLogger {
  const emit = (
    level: LogLevel,
    method: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    args: unknown[],
  ): void => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[currentLevel]) return;
    const prefix = `[face-engine:${namespace}]`;
    if (args.length > 0) {
      console[method](prefix, message, ...args);
    } else {
      console[method](prefix, message);
    }
  };

  return {
    debug: (message, ...args) => emit('debug', 'debug', message, args),
    info: (message, ...args) => emit('info', 'info', message, args),
    warn: (message, ...args) => emit('warn', 'warn', message, args),
    error: (message, ...args) => emit('error', 'error', message, args),
  };
}
