import * as Sentry from "@sentry/nextjs";
import { scrubEvent, scrubBreadcrumb } from "./lib/sentry-scrub";

// Browser-side Sentry for the Civica marketing site. PII scrubbing lives in
// lib/sentry-scrub, shared with the server + edge configs. No session replay —
// replay records user interactions and can capture PII on a SNAP intake page.
// Was mirrored from apps/dashboard; that copy is PARKED, so this drifts.

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
