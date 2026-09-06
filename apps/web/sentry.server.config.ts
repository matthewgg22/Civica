import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "./lib/sentry-scrub";

// Node-runtime Sentry for the marketing site server. PII scrubbing lives in
// lib/sentry-scrub, shared with the edge + client configs — a SNAP intake
// surface leaks via query strings, breadcrumbs and transactions, not just the
// request body. Was mirrored from apps/dashboard; that copy is PARKED, so this
// intentionally drifts (re-sync when it unparks).

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
