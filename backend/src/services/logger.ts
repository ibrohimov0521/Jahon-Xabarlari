type LogLevel = "info" | "warn" | "error";
type LogMeta = Record<string, unknown>;

function normalize(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, ...(process.env.NODE_ENV !== "production" ? { stack: value.stack } : {}) };
  }
  return value;
}

function write(level: LogLevel, event: string, meta: LogMeta = {}) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, normalize(value)]))
  });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

export const logger = {
  info: (event: string, meta?: LogMeta) => write("info", event, meta),
  warn: (event: string, meta?: LogMeta) => write("warn", event, meta),
  error: (event: string, meta?: LogMeta) => write("error", event, meta)
};
