// Next.js instrumentation hook — runs once per server-runtime startup.
// Loads the Sentry server / edge configs based on which runtime fired.
//
// The `onRequestError` export wires Next.js's per-request error hook into
// Sentry.captureRequestError, which is the Sentry-recommended pattern for
// Next.js 15+. Without it Sentry warns at build time and a class of nested
// server-component errors goes uncaptured.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export { captureRequestError as onRequestError } from "@sentry/nextjs";
