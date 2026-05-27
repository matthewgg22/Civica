// Source-adapter result types.
//
// Every SourceAdapter.fetch() returns a FetchResult discriminated union.
// Consumers MUST exhaustively handle every variant — `assertNever` in the
// default branch turns a missed case into a compile error, not a runtime
// surprise. See docs/regops/source-adapters.md for the contract.

/**
 * Fetch succeeded; `data` is the parsed snapshot returned by the adapter.
 * `urlHash` is a content hash of the fetched payload so consumers can
 * deduplicate identical fetches even when the URL is the same. `fetchedAt`
 * is the wall-clock time the fetch completed (UTC).
 */
export interface FetchSuccess<TRaw> {
  readonly kind: "Success";
  readonly data: readonly TRaw[];
  readonly fetchedAt: Date;
  readonly urlHash: string;
}

/**
 * Fetch succeeded and produced the same content as the previous fetch
 * (urlHash matches the last stored snapshot). Allows callers to skip diff
 * work without conflating "no diff" with "fetch failed."
 */
export interface FetchNoChange {
  readonly kind: "NoChange";
  readonly fetchedAt: Date;
  readonly urlHash: string;
}

/**
 * Fetch failed transiently. Worth retrying with backoff. Examples: 5xx,
 * 429, network timeout, DNS hiccup. `retryAfterMs` is optional advice
 * (often derived from a Retry-After header); the base class' backoff
 * still applies if omitted.
 */
export interface FetchTransientFailure {
  readonly kind: "TransientFailure";
  readonly error: string;
  readonly retryAfterMs?: number;
}

/**
 * Fetch returned data but the parser couldn't interpret it. Means the
 * source's schema/layout changed and the adapter needs updating before
 * resuming. `rawDocSampleRef` points to a stored sample of the
 * unparseable payload (e.g., a Supabase storage key or an S3/R2 object
 * id) so a human can inspect what changed.
 */
export interface FetchStructuralFailure {
  readonly kind: "StructuralFailure";
  readonly error: string;
  readonly rawDocSampleRef: string;
}

/**
 * Source has been failing continuously past the wedged threshold (24h
 * by default in SourceAdapterBase). Operator action required:
 * investigate, escalate, or pause the adapter. The base class emits this
 * variant after enough consecutive TransientFailure / StructuralFailure
 * results — adapters do not need to construct it directly in normal code.
 */
export interface FetchSourceWedged {
  readonly kind: "SourceWedged";
  readonly lastSuccessAt: Date;
  readonly error: string;
}

/**
 * The full discriminated union. Always switch on `kind` and exhaustively
 * handle every variant; let the type-checker catch missed cases.
 */
export type FetchResult<TRaw> =
  | FetchSuccess<TRaw>
  | FetchNoChange
  | FetchTransientFailure
  | FetchStructuralFailure
  | FetchSourceWedged;

/**
 * Exhaustiveness helper. Call from the `default` arm of a switch on
 * `FetchResult.kind` (or any other discriminated union). If a future
 * change adds a new variant, the type-checker will reject the call to
 * `assertNever` and force the consumer to handle the new case.
 *
 * Throws at runtime as a defense-in-depth measure if the type-system
 * guarantee is somehow violated (e.g., a `kind` string came from
 * deserialized JSON that bypassed the type system).
 *
 * @example
 *   switch (result.kind) {
 *     case "Success": ...;
 *     case "NoChange": ...;
 *     case "TransientFailure": ...;
 *     case "StructuralFailure": ...;
 *     case "SourceWedged": ...;
 *     default: assertNever(result); // compile error if a case was missed
 *   }
 */
export function assertNever(x: never): never {
  throw new Error(`unhandled FetchResult variant: ${JSON.stringify(x)}`);
}

/**
 * Narrow-type guards. Useful when you only care about one variant and
 * don't want to write a full switch. Prefer the switch + assertNever
 * pattern for code that should react to every variant.
 */
export const isSuccess = <T>(r: FetchResult<T>): r is FetchSuccess<T> =>
  r.kind === "Success";
export const isNoChange = <T>(r: FetchResult<T>): r is FetchNoChange =>
  r.kind === "NoChange";
export const isTransientFailure = <T>(r: FetchResult<T>): r is FetchTransientFailure =>
  r.kind === "TransientFailure";
export const isStructuralFailure = <T>(r: FetchResult<T>): r is FetchStructuralFailure =>
  r.kind === "StructuralFailure";
export const isSourceWedged = <T>(r: FetchResult<T>): r is FetchSourceWedged =>
  r.kind === "SourceWedged";

/**
 * Convenience: did the fetch produce usable new content?
 * Returns true only for `Success`. NoChange and all failure variants
 * return false. Useful for filtering streams of FetchResults to the
 * ones a downstream diff pass should consider.
 */
export const hasNewData = <T>(r: FetchResult<T>): r is FetchSuccess<T> =>
  r.kind === "Success";

/**
 * Convenience: is the result retryable on a short horizon?
 * `TransientFailure` is the only retry-soon variant. `SourceWedged` and
 * `StructuralFailure` need operator attention; `Success` / `NoChange`
 * don't need retry at all.
 */
export const isRetryable = <T>(r: FetchResult<T>): r is FetchTransientFailure =>
  r.kind === "TransientFailure";
