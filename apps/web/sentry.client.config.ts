import * as Sentry from "@sentry/nextjs";

// Browser-side Sentry for the Civica marketing site.
// Mirrors apps/dashboard/sentry.client.config.ts so the PII discipline is
// identical across the two Next surfaces. No session replay — replay
// captures user interactions and can record PII on a SNAP intake page.

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    if (event.request) {
      event.request = {
        ...event.request,
        data: undefined,
        cookies: undefined,
        headers: { "content-type": event.request.headers?.["content-type"] ?? "" },
      };
    }
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
