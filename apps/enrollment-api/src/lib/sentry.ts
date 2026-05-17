import type { ErrorEvent } from "@sentry/cloudflare";
import { PII_KEYS } from "./logger.js";

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

export async function scrubEvent(event: ErrorEvent): Promise<ErrorEvent | null> {
  // Strip request body, cookies, and most headers — keep only content-type
  if (event.request) {
    const { data: _d, cookies: _c, ...rest } = event.request;
    event.request = {
      ...rest,
      headers: { "content-type": event.request.headers?.["content-type"] ?? "" },
    };
  }

  // Preserve a hashed user id for incident correlation; strip all other user fields
  if (event.user) {
    const rawId = event.user.id;
    event.user = rawId !== undefined
      ? { id: await hashId(String(rawId)) }
      : {};
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
