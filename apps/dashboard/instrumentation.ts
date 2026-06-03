export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Sentry's recommended Next 15+ wiring for the per-request error hook.
// Without it the build warns and a class of nested server-component errors
// (errors thrown inside React Server Components downstream of Suspense
// boundaries) goes uncaptured. apps/web's instrumentation already does this.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
