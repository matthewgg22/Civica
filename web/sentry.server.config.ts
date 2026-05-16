import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.1 : 1.0,

  beforeSend(event) {
    // Never forward user identity beyond an opaque ID
    if (event.user) {
      event.user = { id: event.user.id };
    }
    // Strip any server-side request bodies that may contain PII
    if (event.request?.data) {
      event.request.data = "[Filtered]";
    }
    return event;
  },
});
