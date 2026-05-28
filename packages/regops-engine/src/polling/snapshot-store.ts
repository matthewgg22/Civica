// SnapshotStore implementations.
//
// Three implementations ship today:
//   - InMemorySnapshotStore   — tests + dry-run modes.
//   - JsonlSnapshotStore      — local dev / unconfigured-secrets fallback.
//     Writes one JSON-per-line record to stdout. Captured by the
//     GH Actions run log; not queryable after the run's retention
//     window expires (90 days default).
//   - SupabaseSnapshotStore   — production. Inserts into regops.snapshots
//     (migration 20260595). Append-only — every record is a new historical
//     state we may need to demonstrate to a regulator later. The
//     orchestrator catches insert errors and emits a regops.snapshot.write_failed
//     alert; this class deliberately throws on failure so that path fires.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SnapshotRecord, SnapshotStore } from "./types.js";

export class InMemorySnapshotStore implements SnapshotStore {
  readonly snapshots: SnapshotRecord[] = [];

  async record(snapshot: SnapshotRecord): Promise<void> {
    this.snapshots.push(snapshot);
  }

  /** Convenience: filter by source. */
  forSource(sourceId: string): readonly SnapshotRecord[] {
    return this.snapshots.filter((s) => s.sourceId === sourceId);
  }
}

/**
 * Append-only line-delimited JSON writer. Default writer = process.stdout
 * so the GH Actions log captures every snapshot; tests inject a buffer.
 */
export type LineWriter = (line: string) => void;

export class JsonlSnapshotStore implements SnapshotStore {
  private readonly writer: LineWriter;

  constructor(writer?: LineWriter) {
    this.writer =
      writer ??
      ((line: string) => {
        process.stdout.write(`${line}\n`);
      });
  }

  async record(snapshot: SnapshotRecord): Promise<void> {
    // Serialize fetchedAt as ISO so the line is plain-JSON parseable.
    const payload = {
      source_id: snapshot.sourceId,
      domain_tag: snapshot.domainTag,
      fetched_at: snapshot.fetchedAt.toISOString(),
      url_hash: snapshot.urlHash,
      data: snapshot.data,
    };
    this.writer(JSON.stringify(payload));
  }
}

/**
 * Insert a snapshot row into regops.snapshots via a Supabase client.
 *
 * Schema lives in supabase/migrations/20260595_regops_snapshots.sql.
 * The caller is responsible for providing a service-role-keyed client
 * (RLS for INSERT is service_role only; counsel get domain-scoped SELECT
 * via the policy in the same migration).
 *
 * Throws on insert failure. The orchestrator catches this and emits
 * `regops.snapshot.write_failed` at page severity (see orchestrator.ts).
 * That contract is what lets a one-shot snapshot-write outage become a
 * pageable alert rather than a silent data drop.
 *
 * The client is typed as untyped `SupabaseClient` on purpose, mirroring
 * SupabaseAuditLogWriter — the @civica/db-types regeneration that exposes
 * the regops schema is a follow-up task. Once db-types covers regops,
 * swap to `SupabaseClient<Database>` here and drop the unknown cast.
 */
export class SupabaseSnapshotStore implements SnapshotStore {
  constructor(private readonly client: SupabaseClient) {}

  async record(snapshot: SnapshotRecord): Promise<void> {
    const insertRow = {
      source_id: snapshot.sourceId,
      domain_tag: snapshot.domainTag,
      fetched_at: snapshot.fetchedAt.toISOString(),
      url_hash: snapshot.urlHash,
      // data is jsonb on the db side; the cast through unknown lets us
      // pass the readonly TRaw[] without the SupabaseClient<any>
      // signature complaining about variance.
      data: snapshot.data as unknown as Record<string, unknown>,
    };

    const { error } = await this.client
      .schema("regops")
      .from("snapshots")
      .insert(insertRow);

    if (error) {
      // The orchestrator's safeEmit path turns this into a page-severity
      // regops.snapshot.write_failed alert. Throwing here (rather than
      // returning a Result) preserves the same contract InMemory + Jsonl
      // implement implicitly via "void return = always succeeds."
      throw new Error(
        `regops.snapshots insert failed for source=${snapshot.sourceId} ` +
          `urlHash=${snapshot.urlHash}: ${error.message}`,
      );
    }
  }
}
