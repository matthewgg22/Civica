/**
 * Browser runtime adapter — STUB (DEFERRED for MVP per docs/data-architecture.md).
 *
 * Future: DuckDB-WASM + signed URLs from a Supabase Edge Function.
 * Browser never sees service-role credentials. Promote when T5 needs
 * interactive client-side queries.
 */

export const BROWSER_RUNTIME_STATUS = "deferred" as const;

export function notImplemented(): never {
  throw new Error(
    "@civica/analytics-engine: browser runtime is deferred for MVP. " +
      "Render queries in Next.js server components instead.",
  );
}
