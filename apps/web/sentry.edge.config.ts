import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "./lib/sentry-scrub";

// Edge-runtime Sentry for the marketing site. PII scrubbing lives in
// lib/sentry-scrub, shared with the server + client configs. Was mirrored from
// apps/dashboard; that copy is PARKED, so this intentionally drifts.

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
