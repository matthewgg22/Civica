// Audit log entry types.
//
// Mirrors the regops.source_audit_log table from
// supabase/migrations/20260593_regops_audit_log.sql. Every SourceAdapter.
// fetch() call writes one of these via AuditLogWriter.record(). See
// docs/regops/runbook.md "Source wedged" and docs/regops/source-adapters.md
// "Adapter contract" for how downstream consumers use this.

import type { FetchResult } from "../sources/types.js";

/**
 * The discriminant string that ends up in source_audit_log.result_kind.
 * Constrained to the same set as the SQL check constraint and the
 * FetchResult.kind union. Keep these three definitions in sync — a
 * mismatch is a silent data-shape bug.
 */
export type AuditLogResultKind = FetchResult<unknown>["kind"];

/**
 * One row of the regops.source_audit_log table, as constructed by an
 * adapter writer call. log_id and fetched_at are NOT included here —
 * the database supplies defaults (gen_uuidv7 and clock_timestamp).
 */
export interface AuditLogEntry {
  readonly source_id: string;
  readonly url: string;
  readonly url_hash: string;
  readonly result_kind: AuditLogResultKind;
  readonly http_status?: number;
  readonly response_headers?: Readonly<Record<string, string>>;
  readonly body_ref?: string;
  readonly error?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Result of an AuditLogWriter.record() call. Always returns; never
 * throws on a normal write failure (database down, RLS reject, etc.) so
 * callers in the SourceAdapter base class can continue polling without
 * crashing on a transient audit-side outage. Hard errors that indicate
 * a programmer bug (malformed input) still throw — those should not be
 * swallowed.
 */
export type AuditLogRecordResult =
  | { readonly ok: true; readonly logId?: string }
  | { readonly ok: false; readonly error: string };

/**
 * Build an AuditLogEntry from a FetchResult plus context the adapter
 * supplies (source_id, url, and optional metadata). Encapsulates the
 * variant-by-variant field mapping so adapters never have to write the
 * switch themselves.
 *
 * The fetch() wrapper in SourceAdapterBase will call this immediately
 * after the fetch resolves, then hand the entry to AuditLogWriter.record().
 */
export function entryFromFetchResult<T>(args: {
  readonly sourceId: string;
  readonly url: string;
  readonly result: FetchResult<T>;
  readonly httpStatus?: number;
  readonly responseHeaders?: Readonly<Record<string, string>>;
  readonly bodyRef?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): AuditLogEntry {
  const { sourceId, url, result, httpStatus, responseHeaders, bodyRef, metadata } = args;

  const base = {
    source_id: sourceId,
    url,
    result_kind: result.kind,
    ...(httpStatus !== undefined ? { http_status: httpStatus } : {}),
    ...(responseHeaders !== undefined ? { response_headers: responseHeaders } : {}),
    ...(bodyRef !== undefined ? { body_ref: bodyRef } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };

  switch (result.kind) {
    case "Success":
      return { ...base, url_hash: result.urlHash };
    case "NoChange":
      return { ...base, url_hash: result.urlHash };
    case "TransientFailure":
      return { ...base, url_hash: "", error: result.error };
    case "StructuralFailure":
      // bodyRef from caller wins; fall back to the result's rawDocSampleRef
      // so a structural failure always has something to point at.
      return {
        ...base,
        url_hash: "",
        error: result.error,
        body_ref: bodyRef ?? result.rawDocSampleRef,
      };
    case "SourceWedged":
      return { ...base, url_hash: "", error: result.error };
  }
}
