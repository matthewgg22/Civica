import { describe, expect, it } from "vitest";

import type { DomainTag } from "../sources/index.js";
import type { FetchResult } from "../sources/index.js";

import { InMemoryAlertEmitter } from "./alert-emitter.js";
import { pollOnce } from "./orchestrator.js";
import { InMemorySnapshotStore } from "./snapshot-store.js";
import type { PollableAdapter } from "./types.js";

// --- Stub adapter ---------------------------------------------------------

class StubAdapter implements PollableAdapter {
  constructor(
    readonly id: string,
    readonly domainTag: DomainTag,
    private readonly result: FetchResult<unknown> | Error,
  ) {}
  async fetchOnce(): Promise<FetchResult<unknown>> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

const ts = (s: string) => new Date(s);

// --- Tests ---------------------------------------------------------------

describe("pollOnce — variant routing", () => {
  it("Success → snapshot recorded, no alert", async () => {
    const store = new InMemorySnapshotStore();
    const alerts = new InMemoryAlertEmitter();
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "Success",
      data: [{ id: 1 }],
      fetchedAt: ts("2026-05-27T12:00:00Z"),
      urlHash: "abc",
    });

    const tick = await pollOnce({
      adapters: [adapter],
      snapshotStore: store,
      alertEmitter: alerts,
    });

    expect(tick.successes).toBe(1);
    expect(tick.polled).toBe(1);
    expect(store.snapshots).toHaveLength(1);
    expect(store.snapshots[0]?.sourceId).toBe("a");
    expect(store.snapshots[0]?.data).toEqual([{ id: 1 }]);
    expect(alerts.alerts).toHaveLength(0);
  });

  it("NoChange → no snapshot, no alert", async () => {
    const store = new InMemorySnapshotStore();
    const alerts = new InMemoryAlertEmitter();
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "NoChange",
      fetchedAt: ts("2026-05-27T12:00:00Z"),
      urlHash: "abc",
    });

    const tick = await pollOnce({
      adapters: [adapter],
      snapshotStore: store,
      alertEmitter: alerts,
    });

    expect(tick.noChanges).toBe(1);
    expect(store.snapshots).toHaveLength(0);
    expect(alerts.alerts).toHaveLength(0);
  });

  it("TransientFailure → warn alert, no snapshot", async () => {
    const store = new InMemorySnapshotStore();
    const alerts = new InMemoryAlertEmitter();
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "TransientFailure",
      error: "503 Service Unavailable",
      retryAfterMs: 60_000,
    });

    const tick = await pollOnce({
      adapters: [adapter],
      snapshotStore: store,
      alertEmitter: alerts,
    });

    expect(tick.transientFailures).toBe(1);
    expect(alerts.byName("regops.source.fetch_failed")).toHaveLength(1);
    expect(alerts.bySeverity("warn")).toHaveLength(1);
    expect(alerts.alerts[0]?.metadata).toEqual({ retryAfterMs: 60_000 });
    expect(store.snapshots).toHaveLength(0);
  });

  it("StructuralFailure → page alert with rawDocSampleRef", async () => {
    const store = new InMemorySnapshotStore();
    const alerts = new InMemoryAlertEmitter();
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "StructuralFailure",
      error: "schema drift on row 3",
      rawDocSampleRef: "ref-123",
    });

    const tick = await pollOnce({
      adapters: [adapter],
      snapshotStore: store,
      alertEmitter: alerts,
    });

    expect(tick.structuralFailures).toBe(1);
    const emitted = alerts.byName("regops.source.schema_changed");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.severity).toBe("page");
    expect(emitted[0]?.metadata).toEqual({ rawDocSampleRef: "ref-123" });
  });

  it("SourceWedged → page alert with lastSuccessAt", async () => {
    const store = new InMemorySnapshotStore();
    const alerts = new InMemoryAlertEmitter();
    const lastSuccess = ts("2026-05-26T00:00:00Z");
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "SourceWedged",
      lastSuccessAt: lastSuccess,
      error: "30h continuous failure",
    });

    const tick = await pollOnce({
      adapters: [adapter],
      snapshotStore: store,
      alertEmitter: alerts,
    });

    expect(tick.wedged).toBe(1);
    const emitted = alerts.byName("regops.source.wedged");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.metadata).toEqual({
      lastSuccessAt: lastSuccess.toISOString(),
    });
  });
});

describe("pollOnce — robustness", () => {
  it("an adapter that throws is captured as skipped-error, others still run", async () => {
    const store = new InMemorySnapshotStore();
    const alerts = new InMemoryAlertEmitter();
    const bad = new StubAdapter("bad", "eligibility", new Error("unexpected boom"));
    const good = new StubAdapter("good", "eligibility", {
      kind: "Success",
      data: [{ id: 1 }],
      fetchedAt: ts("2026-05-27T12:00:00Z"),
      urlHash: "h",
    });

    const tick = await pollOnce({
      adapters: [bad, good],
      snapshotStore: store,
      alertEmitter: alerts,
    });

    expect(tick.skipped).toBe(1);
    expect(tick.successes).toBe(1);
    expect(tick.polled).toBe(1);
    expect(store.snapshots).toHaveLength(1);
    expect(alerts.byName("regops.adapter.unexpected_throw")).toHaveLength(1);
    expect(alerts.byName("regops.adapter.unexpected_throw")[0]?.severity).toBe("page");
    const badResult = tick.perSource.find((r) => r.sourceId === "bad");
    expect(badResult?.status).toBe("skipped-error");
    expect(badResult?.error).toMatch(/unexpected boom/);
  });

  it("snapshot-store write failure becomes an alert, doesn't crash the loop", async () => {
    class FailingStore {
      async record(): Promise<void> {
        throw new Error("DB down");
      }
    }
    const alerts = new InMemoryAlertEmitter();
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "Success",
      data: [{ id: 1 }],
      fetchedAt: ts("2026-05-27T12:00:00Z"),
      urlHash: "h",
    });

    const tick = await pollOnce({
      adapters: [adapter],
      snapshotStore: new FailingStore(),
      alertEmitter: alerts,
    });

    // Success is counted because the adapter succeeded — the store
    // outage is a separate concern surfaced as an alert.
    expect(tick.successes).toBe(1);
    expect(alerts.byName("regops.snapshot.write_failed")).toHaveLength(1);
    expect(alerts.byName("regops.snapshot.write_failed")[0]?.severity).toBe("page");
  });

  it("alert-emitter throw doesn't kill the loop (emit is best-effort)", async () => {
    class ThrowingEmitter {
      async emit(): Promise<void> {
        throw new Error("Sentry network error");
      }
    }
    const store = new InMemorySnapshotStore();
    const adapter = new StubAdapter("a", "eligibility", {
      kind: "TransientFailure",
      error: "503",
    });

    // Should resolve normally; the throw inside emit gets logged and swallowed.
    const tick = await pollOnce({
      adapters: [adapter],
      snapshotStore: store,
      alertEmitter: new ThrowingEmitter(),
    });
    expect(tick.transientFailures).toBe(1);
  });
});

describe("pollOnce — summary shape", () => {
  it("startedAt / finishedAt come from the injected clock", async () => {
    const store = new InMemorySnapshotStore();
    const alerts = new InMemoryAlertEmitter();
    const stamps = [
      ts("2026-05-27T12:00:00Z"),
      ts("2026-05-27T12:00:05Z"),
    ];
    let i = 0;
    const tick = await pollOnce({
      adapters: [],
      snapshotStore: store,
      alertEmitter: alerts,
      now: () => stamps[i++]!,
    });
    expect(tick.startedAt.toISOString()).toBe("2026-05-27T12:00:00.000Z");
    expect(tick.finishedAt.toISOString()).toBe("2026-05-27T12:00:05.000Z");
  });

  it("empty adapter list is a no-op tick", async () => {
    const tick = await pollOnce({
      adapters: [],
      snapshotStore: new InMemorySnapshotStore(),
      alertEmitter: new InMemoryAlertEmitter(),
    });
    expect(tick.polled).toBe(0);
    expect(tick.skipped).toBe(0);
    expect(tick.perSource).toEqual([]);
  });
});
