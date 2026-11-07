import "server-only";

/**
 * Structured JSON logger for CloudWatch. Customer personal data (names,
 * phones, addresses, emails) and secrets must never be logged; the redact
 * list below is a safety net, not a licence to pass such data in.
 */
const REDACT = /^(password|passwordHash|token|cookie|authorization|phone|phoneNational|name|address|email|notes|customer)$/i;

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = REDACT.test(k) ? "[redacted]" : scrub(v, depth + 1);
    return out;
  }
  return value;
}

function write(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test" && level === "info") return;
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...(data ? (scrub(data) as object) : {}) });
  if (level === "error") console.error(line);
  else console.warn(line);
}

export const log = {
  info: (msg: string, data?: Record<string, unknown>) => write("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => write("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};
