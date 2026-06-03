import * as Sentry from "@sentry/nextjs";

// Edge-runtime Sentry for the marketing site. Mirrors
// apps/dashboard/sentry.edge.config.ts.

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.05,
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
