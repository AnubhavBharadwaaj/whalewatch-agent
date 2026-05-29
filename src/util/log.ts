type Level = 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, extra?: unknown): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${level.toUpperCase().padEnd(5)} ${msg}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (extra !== undefined) sink(line, extra);
  else sink(line);
}

export const log = {
  info: (msg: string, extra?: unknown): void => emit('info', msg, extra),
  warn: (msg: string, extra?: unknown): void => emit('warn', msg, extra),
  error: (msg: string, extra?: unknown): void => emit('error', msg, extra),
};
