type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<Level, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
};

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

      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    };
  } else if (err !== undefined) {
    entry.error = { message: String(err) };
  }

  const line = JSON.stringify(entry);

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
