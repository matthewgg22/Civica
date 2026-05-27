// AuditLogWriter — the interface and implementations the SourceAdapter
// base class uses to record every fetch() call.
//
// Two implementations ship in v1:
//   1. SupabaseAuditLogWriter — production. Writes to regops.source_audit_log.
//   2. InMemoryAuditLogWriter — tests + dry-run modes. Pushes to an array.
//
// A third one (NullAuditLogWriter) is provided as a deliberate escape
// hatch for one-off local scripts that genuinely have no place to write
// audit (e.g., adapter development against a fixture). DO NOT use in
// production polling — the audit log is load-bearing for Liability
// Posture #2 (citation chain-of-custody).

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AuditLogEntry,
  AuditLogRecordResult,
} from "./types.js";

/**
 * Contract every audit-log writer implements. record() must NOT throw
 * on transient backend failures; it should return `{ ok: false, error }`
 * so the caller (typically SourceAdapterBase) can alert without crashing
 * the polling loop. Hard programmer errors (malformed input) may throw.
 */
export interface AuditLogWriter {
  record(entry: AuditLogEntry): Promise<AuditLogRecordResult>;
}

// ---------------------------------------------------------------------------
// SupabaseAuditLogWriter
// ---------------------------------------------------------------------------

/**
 * Insert one row into regops.source_audit_log via a Supabase client.
 *
 * The caller is responsible for providing a client created with the
 * service-role key (since RLS in v1 only allows service_role to insert).
 * Counsel/admin read paths land in E4; until then the writer side is
 * service-role-only.
 *
 * The client is typed as `SupabaseClient` (untyped Database) on purpose
 * — the @civica/db-types regeneration that exposes the regops schema is
 * a follow-up task. Once db-types covers regops, swap to
 * `SupabaseClient<Database>` here.
 */
export class SupabaseAuditLogWriter implements AuditLogWriter {
  constructor(private readonly client: SupabaseClient) {}

  async record(entry: AuditLogEntry): Promise<AuditLogRecordResult> {
    // AuditLogEntry is a fully-typed shape; the cast through `unknown`
    // is needed because we accept an untyped SupabaseClient — once
    // @civica/db-types is regenerated to include the regops schema we
    // can swap to SupabaseClient<Database> and drop the cast.
    const insertRow = entry as unknown as Record<string, unknown>;
    const { error, data } = await this.client
      .schema("regops")
      .from("source_audit_log")
      .insert(insertRow)
      .select("log_id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    // data is typed `any` because the client is untyped; we know the
    // shape because we selected log_id explicitly.
    const logId = (data as { log_id?: string } | null)?.log_id;
    return logId !== undefined ? { ok: true, logId } : { ok: true };
  }
}

// ---------------------------------------------------------------------------
// InMemoryAuditLogWriter
// ---------------------------------------------------------------------------

/**
 * Stores entries in an in-memory array. For unit tests of the
 * SourceAdapter base class and any adapter-specific tests that want to
 * assert on audit-log emissions without standing up a database.
 *
 * Generates a synthetic logId per entry so the result shape matches
 * SupabaseAuditLogWriter's contract.
 */
export class InMemoryAuditLogWriter implements AuditLogWriter {
  readonly entries: { entry: AuditLogEntry; logId: string }[] = [];

  async record(entry: AuditLogEntry): Promise<AuditLogRecordResult> {
    const logId = `mem-${this.entries.length + 1}`;
    this.entries.push({ entry, logId });
    return { ok: true, logId };
  }

  /** Convenience: return the inserted entries in insertion order. */
  all(): readonly AuditLogEntry[] {
    return this.entries.map((e) => e.entry);
  }

  /** Convenience: filter by source_id + optionally result_kind. */
  filter(predicate: {
    readonly sourceId?: string;
    readonly resultKind?: AuditLogEntry["result_kind"];
  }): readonly AuditLogEntry[] {
    return this.entries
      .map((e) => e.entry)
      .filter(
        (e) =>
          (predicate.sourceId === undefined || e.source_id === predicate.sourceId) &&
          (predicate.resultKind === undefined || e.result_kind === predicate.resultKind),
      );
  }

  /** Reset for a fresh test. */
  clear(): void {
    this.entries.length = 0;
  }
}

// ---------------------------------------------------------------------------
// NullAuditLogWriter
// ---------------------------------------------------------------------------

/**
 * Discards all entries. DO NOT use in production. Acceptable only for
 * local adapter development against fixtures, or for the war-room manual
 * trigger CLI when intentionally bypassing the audit log is documented.
 *
 * The name is deliberately ugly so it shows up in code review.
 */
export class NullAuditLogWriter implements AuditLogWriter {
  async record(_entry: AuditLogEntry): Promise<AuditLogRecordResult> {
    return { ok: true };
  }
}
