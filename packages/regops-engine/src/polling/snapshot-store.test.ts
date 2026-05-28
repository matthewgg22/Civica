import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  InMemorySnapshotStore,
  JsonlSnapshotStore,
  SupabaseSnapshotStore,
} from "./snapshot-store.js";
import type { SnapshotRecord } from "./types.js";

const sample = (overrides: Partial<SnapshotRecord> = {}): SnapshotRecord => ({
  sourceId: "federal-register-snap",
  domainTag: "eligibility",
  fetchedAt: new Date("2026-05-27T12:00:00Z"),
  urlHash: "abc123",
  data: [{ document_number: "2026-1" }],
  ...overrides,
});

describe("InMemorySnapshotStore", () => {
  it("appends in order", async () => {
    const s = new InMemorySnapshotStore();
    await s.record(sample({ urlHash: "1" }));
    await s.record(sample({ urlHash: "2" }));
    expect(s.snapshots.map((x) => x.urlHash)).toEqual(["1", "2"]);
  });

  it("filters by source", async () => {
    const s = new InMemorySnapshotStore();
    await s.record(sample({ sourceId: "a" }));
    await s.record(sample({ sourceId: "b" }));
    expect(s.forSource("a")).toHaveLength(1);
    expect(s.forSource("b")).toHaveLength(1);
    expect(s.forSource("c")).toHaveLength(0);
  });
});

describe("JsonlSnapshotStore", () => {
  it("writes one JSON line per snapshot with ISO timestamps", async () => {
    const lines: string[] = [];
    const s = new JsonlSnapshotStore((l) => lines.push(l));
    await s.record(sample());
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.source_id).toBe("federal-register-snap");
    expect(parsed.fetched_at).toBe("2026-05-27T12:00:00.000Z");
    expect(parsed.url_hash).toBe("abc123");
    expect(parsed.data).toEqual([{ document_number: "2026-1" }]);
  });

  it("each record is independent JSON (parseable line-by-line)", async () => {
    const lines: string[] = [];
    const s = new JsonlSnapshotStore((l) => lines.push(l));
    await s.record(sample({ urlHash: "1" }));
    await s.record(sample({ urlHash: "2" }));
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).url_hash).toBe("1");
    expect(JSON.parse(lines[1]!).url_hash).toBe("2");
  });
});

// ---------------------------------------------------------------------------
// SupabaseSnapshotStore
// ---------------------------------------------------------------------------
//
// We mock the SupabaseClient surface manually rather than importing the real
// SDK. The real client wants a URL + key and tries to validate them at
// construction time. The mock captures the chain
// `.schema("regops").from("snapshots").insert(row)` and returns whatever
// `{ error }` the test seeded.

interface CapturedInsert {
  readonly schema: string;
  readonly table: string;
  readonly row: Record<string, unknown>;
}

function makeMockSupabase(opts: {
  readonly error?: { message: string };
} = {}): { client: SupabaseClient; captures: CapturedInsert[] } {
  const captures: CapturedInsert[] = [];

  const mock = {
    schema(schemaName: string) {
      return {
        from(tableName: string) {
          return {
            async insert(row: Record<string, unknown>) {
              captures.push({ schema: schemaName, table: tableName, row });
              return { data: null, error: opts.error ?? null };
            },
          };
        },
      };
    },
  };

  // Cast through unknown because we deliberately implement only the slice
  // of the SupabaseClient surface SupabaseSnapshotStore actually touches.
  return { client: mock as unknown as SupabaseClient, captures };
}

describe("SupabaseSnapshotStore", () => {
  it("inserts into regops.snapshots with the correct row shape", async () => {
    const { client, captures } = makeMockSupabase();
    const store = new SupabaseSnapshotStore(client);

    await store.record(
      sample({
        sourceId: "federal-register-snap",
        domainTag: "eligibility",
        fetchedAt: new Date("2026-05-28T19:28:13.198Z"),
        urlHash: "3ae09aecc51a2b4a93fd8a7145221f78",
        data: [{ document_number: "2026-10468" }],
      }),
    );

    expect(captures).toHaveLength(1);
    expect(captures[0]).toEqual({
      schema: "regops",
      table: "snapshots",
      row: {
        source_id: "federal-register-snap",
        domain_tag: "eligibility",
        fetched_at: "2026-05-28T19:28:13.198Z",
        url_hash: "3ae09aecc51a2b4a93fd8a7145221f78",
        data: [{ document_number: "2026-10468" }],
        topic_tags: [],
      },
    });
  });

  it("passes through topic_tags when SnapshotRecord includes them", async () => {
    const { client, captures } = makeMockSupabase();
    const store = new SupabaseSnapshotStore(client);

    await store.record({
      ...sample(),
      topicTags: ["obbba", "abawd"],
    });

    expect(captures[0]!.row.topic_tags).toEqual(["obbba", "abawd"]);
  });

  it("defaults topic_tags to empty array when omitted (matches NOT NULL DEFAULT)", async () => {
    const { client, captures } = makeMockSupabase();
    const store = new SupabaseSnapshotStore(client);

    await store.record(sample()); // no topicTags
    expect(captures[0]!.row.topic_tags).toEqual([]);
  });

  it("serializes fetchedAt as ISO (matches db's timestamptz expectation)", async () => {
    const { client, captures } = makeMockSupabase();
    const store = new SupabaseSnapshotStore(client);

    await store.record(sample({ fetchedAt: new Date("2026-05-27T12:00:00Z") }));

    expect(captures[0]!.row.fetched_at).toBe("2026-05-27T12:00:00.000Z");
  });

  it("throws with a contextual message when the insert fails", async () => {
    const { client } = makeMockSupabase({
      error: { message: "permission denied for table snapshots" },
    });
    const store = new SupabaseSnapshotStore(client);

    await expect(store.record(sample())).rejects.toThrow(
      /regops\.snapshots insert failed/,
    );
    await expect(store.record(sample())).rejects.toThrow(
      /source=federal-register-snap/,
    );
    await expect(store.record(sample())).rejects.toThrow(
      /permission denied for table snapshots/,
    );
  });

  it("error surface preserves the source + urlHash for triage", async () => {
    const { client } = makeMockSupabase({
      error: { message: "duplicate key value violates unique constraint" },
    });
    const store = new SupabaseSnapshotStore(client);

    try {
      await store.record(
        sample({ sourceId: "ca-cdss-acl", urlHash: "deadbeef" }),
      );
      throw new Error("expected throw");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      expect(msg).toContain("ca-cdss-acl");
      expect(msg).toContain("deadbeef");
    }
  });
});
