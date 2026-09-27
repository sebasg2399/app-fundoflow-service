type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type Logger = {
  debug: (msg: string, ctx?: Record<string, unknown>) => void;
  info: (msg: string, ctx?: Record<string, unknown>) => void;
  warn: (msg: string, ctx?: Record<string, unknown>) => void;
  error: (msg: string, ctx?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => Logger;
};

function emit(level: Level, threshold: number, msg: string, ctx?: Record<string, unknown>): void {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString();
  const payload = ctx && Object.keys(ctx).length > 0 ? ` ${JSON.stringify(ctx)}` : "";
  const line = `${ts} ${level.toUpperCase().padEnd(5)} ${msg}${payload}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(level: Level = "info", bindings: Record<string, unknown> = {}): Logger {
  const threshold = LEVELS[level];
  const wrap = (extra?: Record<string, unknown>) => ({ ...bindings, ...(extra ?? {}) });

  return {
    debug: (msg, ctx) => emit("debug", threshold, msg, wrap(ctx)),
    info: (msg, ctx) => emit("info", threshold, msg, wrap(ctx)),
    warn: (msg, ctx) => emit("warn", threshold, msg, wrap(ctx)),
    error: (msg, ctx) => emit("error", threshold, msg, wrap(ctx)),
    child: (b) => createLogger(level, wrap(b)),
  };
}
