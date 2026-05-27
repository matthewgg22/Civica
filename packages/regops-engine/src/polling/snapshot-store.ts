// SnapshotStore implementations.
//
// Two v1 implementations:
//   - InMemorySnapshotStore  — tests + dry-run modes.
//   - JsonlSnapshotStore     — what the GitHub Actions cron uses today.
//     Writes one JSON-per-line record to stdout (or an injected writer).
//     GH Actions captures stdout; the operator pipes it into Supabase
//     out-of-band in v1. Real SupabaseSnapshotStore lands when the
//     `regops_snapshots` migration is applied to staging.

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
