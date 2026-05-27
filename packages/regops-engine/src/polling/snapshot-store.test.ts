import { describe, expect, it } from "vitest";

import { InMemorySnapshotStore, JsonlSnapshotStore } from "./snapshot-store.js";
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
