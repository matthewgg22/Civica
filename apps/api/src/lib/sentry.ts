import * as Sentry from "@sentry/node";
import { REDACT_PATHS } from "./logger.js";

const PII_KEY_SET = new Set(
  REDACT_PATHS.map((p) => p.replace(/^\*\./, "")),
);

function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => redactObject(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = PII_KEY_SET.has(k) ? "[Redacted]" : redactObject(v, depth + 1);
  }
  return out;
}

function scrubEvent(event: Sentry.Event): Sentry.Event | null {
  if (event.request) {
    event.request = {
      ...event.request,
      data: undefined,
      cookies: undefined,
      headers: {
        "content-type": event.request.headers?.["content-type"] ?? "",
      },
    };
  }
  if (event.user) {
    // Keep only a non-identifying correlation handle — never email or IP.
    event.user = { id: event.user.id };
  }
  if (event.extra) event.extra = redactObject(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = redactObject(event.contexts) as typeof event.contexts;
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (redactObject(b.data) as typeof b.data) : undefined,
    }));
  }
  return event;
}

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // not configured — silently skip (dev/test)

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0.05,
    beforeSend: scrubEvent,
    // Never capture PII in default integrations
    defaultIntegrations: false,
    integrations: [
      Sentry.httpIntegration({ breadcrumbs: false }),
      Sentry.nodeContextIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
  });
}
