import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.05,
  // No session replay — it captures user interactions and may record PII
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    // Strip request body and cookies; keep only content-type header
    if (event.request) {
      event.request = {
        ...event.request,
        data: undefined,
        cookies: undefined,
        headers: { "content-type": event.request.headers?.["content-type"] ?? "" },
      };
    }
    // Remove user PII — never log email or IP from the browser
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },
});
