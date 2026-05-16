import * as Sentry from "@sentry/nextjs";

// PII fields that must never appear in Sentry payloads
const PII_KEYS = new Set([
  "email",
  "phone",
  "ssn",
  "social_security",
  "date_of_birth",
  "dob",
  "address",
  "street",
  "signature",
  "name",
  "full_name",
  "password",
  "access_token",
  "refresh_token",
]);

function scrubPii(obj: unknown, depth = 0): unknown {
  if (depth > 6 || obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map((v) => scrubPii(v, depth + 1));
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = PII_KEYS.has(key.toLowerCase()) ? "[Filtered]" : scrubPii(val, depth + 1);
    }
    return result;
  }
  return obj;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",

  // Only sample a fraction of transactions in production to control volume
  tracesSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,

  // Capture replays only on errors in production
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 1.0 : 0,

  integrations: [
    Sentry.replayIntegration({
      // Block all text and mask all inputs in session replays
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  beforeSend(event) {
    // Strip PII from request bodies, breadcrumb data, and extra context
    if (event.request?.data) {
      event.request.data = scrubPii(event.request.data);
    }
    if (event.extra) {
      event.extra = scrubPii(event.extra) as typeof event.extra;
    }
    // Never send user identity fields
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
