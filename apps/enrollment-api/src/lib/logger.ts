// CF Workers-compatible structured JSON logger with PII redaction.
// No pino/Node.js dependencies — output goes to `wrangler tail` / Cloudflare Logs.

export const PII_KEYS = new Set([
  // Auth
  "authorization", "cookie", "password", "token",
  // Names / contact
  "applicant_name", "full_name", "first_name", "last_name", "name",
  "email", "phone", "phone_number",
  // Identity
  "dob", "ssn", "ssn_last4",
  // DB columns marked COMMENT 'PII' in supabase migrations
  "body_ciphertext",
  "ip_address",
  "original_filename",
  "raw_ocr_ciphertext",
  "applicant_answer",
  "original_ocr_value",
  "old_values",
  "new_values",
  // Fernet ciphertext columns — should never appear in logs
  "content_ciphertext",
  "snapshot_ciphertext",
  "extracted_payload_ciphertext",
  "user_corrections_ciphertext",
  "household_snapshot_ciphertext",
  "result_ciphertext",
  "full_name_ciphertext",
]);

function redact(val: unknown, depth = 0): unknown {
  if (depth > 8 || val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = PII_KEYS.has(k) ? "[Redacted]" : redact(v, depth + 1);
  }
  return out;
}

type Level = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
}

function emit(level: Level, requestId: string, msg: string, ctx?: Record<string, unknown>) {
  const entry: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    request_id: requestId,
    msg,
  };
  if (ctx) Object.assign(entry, redact(ctx));
  console.log(JSON.stringify(entry));
}

export function createLogger(requestId: string): Logger {
  return {
    debug: (msg, ctx) => emit("debug", requestId, msg, ctx),
    info:  (msg, ctx) => emit("info",  requestId, msg, ctx),
    warn:  (msg, ctx) => emit("warn",  requestId, msg, ctx),
    error: (msg, ctx) => emit("error", requestId, msg, ctx),
  };
}

import type { Context, Next } from "hono";

/** Hono middleware: generate request_id, attach logger, emit access log. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requestLogger(c: Context<any>, next: Next): Promise<void> {
  const requestId = crypto.randomUUID();
  const log = createLogger(requestId);
  c.set("log", log);
  c.set("requestId", requestId);
  const start = Date.now();
  await next();
  log.info("request", {
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
}
