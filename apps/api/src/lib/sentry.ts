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

export function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  // Strip request body, cookies, and most headers — keep only content-type
  if (event.request) {
    const { data: _d, cookies: _c, ...rest } = event.request;
    event.request = {
      ...rest,
      headers: { "content-type": event.request.headers?.["content-type"] ?? "" },
    };
  }
  // Keep only a non-identifying id for incident correlation; strip email, IP, username
  if (event.user) {
    const rawId = event.user.id;
    event.user = rawId !== undefined ? { id: String(rawId) } : {};
  }
  if (event.extra) event.extra = redactObject(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = redactObject(event.contexts) as typeof event.contexts;
  // Redact breadcrumb data — avoid setting data to undefined (exactOptionalPropertyTypes)
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b): typeof b => {
      const { data: origData, ...rest } = b;
      if (origData !== undefined) {
        return { ...rest, data: redactObject(origData) as typeof origData };
      }
      return rest as typeof b;
    });
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
    defaultIntegrations: false,
    integrations: [
      Sentry.httpIntegration({ breadcrumbs: false }),
      Sentry.nodeContextIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
  });
}
