/**
 * lib/logger.ts — Structured JSON logger.
 *
 * WHY: console.log('error') is unsearchable in production. Every log line
 * is machine-parseable JSON with a timestamp, level, requestId, and any
 * contextual meta (orderId, sellerId, etc.) attached at the call site.
 *
 * Ported and upgraded from PayProof 1.0 lib/logger.js:
 *   + Added `service` and `version` fields
 *   + Levels are typed (not open strings)
 *   + Stack trace gated to non-production only
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

// Numeric priority — filters out levels below the configured minimum.
const LEVEL_PRIORITY: Record<Level, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
};

// Read once at module load — not imported from env.ts to avoid a circular
// dependency (env.ts may want to log its own parse error before env is set).
const minLevel: number =
  LEVEL_PRIORITY[
    (process.env.LOG_LEVEL as Level) ??
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  ] ?? 1;

export interface LogMeta {
  err?:       unknown;
  requestId?: string;
  orderId?:   string;
  sellerId?:  string | number;
  buyerId?:   string | number;
  [key: string]: unknown;
}

function write(level: Level, message: string, meta: LogMeta = {}): void {
  if ((LEVEL_PRIORITY[level] ?? 0) < minLevel) return;

  const { err, ...rest } = meta;

  const entry: Record<string, unknown> = {
    ts:      new Date().toISOString(),
    level,
    msg:     message,
    service: 'payproof-api',
    v:       '2.0',
    env:     process.env.NODE_ENV ?? 'development',
    ...rest,
  };

  if (err instanceof Error) {
    entry.error = {
      name:    err.name,
      message: err.message,
      // Stack only in non-production — stacks can leak internal paths.
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    };
  } else if (err !== undefined) {
    entry.error = { message: String(err) };
  }

  const line = JSON.stringify(entry);

  // Route to the appropriate stderr/stdout stream.
  // JSON is always written even for errors — log aggregators parse stdout.
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, meta?: LogMeta) => write('debug', msg, meta),
  info:  (msg: string, meta?: LogMeta) => write('info',  msg, meta),
  warn:  (msg: string, meta?: LogMeta) => write('warn',  msg, meta),
  error: (msg: string, meta?: LogMeta) => write('error', msg, meta),
};
