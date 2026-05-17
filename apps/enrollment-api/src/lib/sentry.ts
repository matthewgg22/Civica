import type { Event } from "@sentry/cloudflare";
import { PII_KEYS } from "./logger.js";

// Hash applicant_id for correlation without exposing the raw UUID.
async function hashId(id: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => redactObject(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = PII_KEYS.has(k) ? "[Redacted]" : redactObject(v, depth + 1);
  }
  return out;
}

export async function scrubEvent(event: Event): Promise<Event | null> {
  // Strip request body and sensitive headers entirely
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

  // Strip user PII; preserve hashed id for incident correlation
  if (event.user) {
    const rawId = event.user.id;
    event.user = {
      id: rawId ? await hashId(rawId) : undefined,
    };
  }

  // Redact extra / contexts
  if (event.extra) event.extra = redactObject(event.extra) as typeof event.extra;
  if (event.contexts) event.contexts = redactObject(event.contexts) as typeof event.contexts;

  // Redact breadcrumb data (SDK v8+ uses Breadcrumb[] directly)
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b) => ({
      ...b,
      data: b.data ? (redactObject(b.data) as typeof b.data) : undefined,
    }));
  }

  return event;
}
