import { describe, expect, it } from "vitest";

import { InMemoryAuditLogWriter } from "../audit/writer.js";
import {
  BACKOFF_SCHEDULE_MS,
  DEFAULT_POLL_INTERVAL_MS,
  REGOPS_USER_AGENT,
  SourceAdapterBase,
  type DomainTag,
  type FetchContext,
} from "./base.js";
import { FakeClock } from "./clock.js";
import type { FetchResult } from "./types.js";

interface RawDoc {
  readonly id: string;
}

/**
 * Tiny subclass that returns a queue of canned results. Each call to
 * fetchOnce() pops one. Captures every FetchContext for assertions.
 */
class FakeAdapter extends SourceAdapterBase<RawDoc> {
  readonly id = "fake-source";
  readonly domainTag: DomainTag = "eligibility";
  readonly url = "https://example.test/snap";

  readonly contexts: FetchContext[] = [];

  constructor(
    deps: ConstructorParameters<typeof SourceAdapterBase>[0],
    private readonly queue: FetchResult<RawDoc>[],
    overrides: ConstructorParameters<typeof SourceAdapterBase>[1] = {},
  ) {
    super(deps, overrides);
  }

  protected async performFetch(ctx: FetchContext): Promise<FetchResult<RawDoc>> {
    this.contexts.push(ctx);
    const next = this.queue.shift();
    if (!next) {
      throw new Error("FakeAdapter queue exhausted");
    }
    return next;
  }
}

const mkSuccess = (urlHash = "sha256:abc"): FetchResult<RawDoc> => ({
  kind: "Success",
  data: [{ id: "doc-1" }],
  fetchedAt: new Date("2026-05-27T00:00:00Z"),
  urlHash,
});
const mkNoChange = (urlHash = "sha256:abc"): FetchResult<RawDoc> => ({
  kind: "NoChange",
  fetchedAt: new Date("2026-05-27T00:00:00Z"),
  urlHash,
});
const mkTransient = (): FetchResult<RawDoc> => ({
  kind: "TransientFailure",
  error: "503 Service Unavailable",
});
const mkStructural = (): FetchResult<RawDoc> => ({
  kind: "StructuralFailure",
  error: "schema changed",
  rawDocSampleRef: "r2://sample/path.html",
});

// ---------------------------------------------------------------------------
// Construction-time guards
// ---------------------------------------------------------------------------

describe("SourceAdapterBase construction guards", () => {
  it("rejects a sub-hour pollIntervalMs without acknowledgedReason", () => {
    const audit = new InMemoryAuditLogWriter();
    expect(
      () =>
        new FakeAdapter({ auditLog: audit, clock: new FakeClock() }, [mkSuccess()], {
          pollIntervalMs: 60_000, // 1 min
        }),
    ).toThrow(/requires an acknowledgedReason/);
  });

  it("accepts a sub-hour pollIntervalMs WITH acknowledgedReason", () => {
    const audit = new InMemoryAuditLogWriter();
    expect(
      () =>
        new FakeAdapter({ auditLog: audit, clock: new FakeClock() }, [mkSuccess()], {
          pollIntervalMs: 60_000,
          acknowledgedReason: "fy_refresh_active",
        }),
    ).not.toThrow();
  });

  it("accepts the default (no override)", () => {
    const audit = new InMemoryAuditLogWriter();
    expect(() => new FakeAdapter({ auditLog: audit, clock: new FakeClock() }, [mkSuccess()])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("SourceAdapterBase happy path", () => {
  it("returns Success and writes one audit log entry", async () => {
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter({ auditLog: audit, clock: new FakeClock() }, [mkSuccess()]);

    const result = await adapter.fetchOnce();

    expect(result.kind).toBe("Success");
    expect(audit.all()).toHaveLength(1);
    expect(audit.all()[0]?.source_id).toBe("fake-source");
    expect(audit.all()[0]?.result_kind).toBe("Success");
    expect(audit.all()[0]?.metadata?.["consecutive_failures"]).toBe(0);
  });

  it("passes the identifying User-Agent into performFetch", async () => {
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter({ auditLog: audit, clock: new FakeClock() }, [mkSuccess()]);
    await adapter.fetchOnce();
    expect(adapter.contexts[0]?.userAgent).toBe(REGOPS_USER_AGENT);
  });

  it("passes attemptStartedAtMs from the clock into performFetch", async () => {
    const clock = new FakeClock(new Date("2026-08-15T12:00:00Z"));
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter({ auditLog: audit, clock }, [mkSuccess()]);
    await adapter.fetchOnce();
    expect(adapter.contexts[0]?.attemptStartedAtMs).toBe(clock.now());
  });
});

// ---------------------------------------------------------------------------
// Rate limit (defense-in-depth)
// ---------------------------------------------------------------------------

describe("SourceAdapterBase rate-limit cap", () => {
  it("blocks a second fetch within pollIntervalMs and returns TransientFailure", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter({ auditLog: audit, clock }, [mkSuccess()]);

    const first = await adapter.fetchOnce();
    expect(first.kind).toBe("Success");

    // Advance 30 min — still under the 1h floor.
    clock.advance(30 * 60_000);

    const second = await adapter.fetchOnce();
    expect(second.kind).toBe("TransientFailure");
    if (second.kind !== "TransientFailure") return; // narrow for TS
    expect(second.error).toMatch(/Rate-limited/);
    // Remaining time = 60min - 30min = 30min.
    expect(second.retryAfterMs).toBe(30 * 60_000);

    // Audit recorded both attempts, with rateLimited: true on the second.
    expect(audit.all()).toHaveLength(2);
    expect(audit.all()[1]?.metadata?.["rateLimited"]).toBe(true);
  });

  it("allows a second fetch once pollIntervalMs has elapsed", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter({ auditLog: audit, clock }, [
      mkSuccess("hash-1"),
      mkSuccess("hash-2"),
    ]);

    await adapter.fetchOnce();
    clock.advance(DEFAULT_POLL_INTERVAL_MS); // exactly 1h
    const second = await adapter.fetchOnce();
    expect(second.kind).toBe("Success");
    expect(audit.all()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Backoff schedule
// ---------------------------------------------------------------------------

describe("SourceAdapterBase backoff schedule", () => {
  it("enriches TransientFailure with the schedule when subclass didn't supply retryAfterMs", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter({ auditLog: audit, clock }, [
      mkTransient(),
      mkTransient(),
      mkTransient(),
    ]);

    const r1 = await adapter.fetchOnce();
    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    const r2 = await adapter.fetchOnce();
    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    const r3 = await adapter.fetchOnce();

    expect(r1.kind).toBe("TransientFailure");
    expect(r2.kind).toBe("TransientFailure");
    expect(r3.kind).toBe("TransientFailure");
    if (r1.kind === "TransientFailure") expect(r1.retryAfterMs).toBe(BACKOFF_SCHEDULE_MS[0]);
    if (r2.kind === "TransientFailure") expect(r2.retryAfterMs).toBe(BACKOFF_SCHEDULE_MS[1]);
    if (r3.kind === "TransientFailure") expect(r3.retryAfterMs).toBe(BACKOFF_SCHEDULE_MS[2]);
  });

  it("preserves subclass-supplied retryAfterMs (Retry-After header wins)", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    const transientWithHint: FetchResult<RawDoc> = {
      kind: "TransientFailure",
      error: "429",
      retryAfterMs: 7_000,
    };
    const adapter = new FakeAdapter({ auditLog: audit, clock }, [transientWithHint]);
    const r = await adapter.fetchOnce();
    if (r.kind === "TransientFailure") expect(r.retryAfterMs).toBe(7_000);
    else expect.fail("expected TransientFailure");
  });

  it("caps the backoff at the schedule's last entry for n >> schedule.length", () => {
    const lastEntry = BACKOFF_SCHEDULE_MS[BACKOFF_SCHEDULE_MS.length - 1];
    expect(SourceAdapterBase.computeBackoffMs(99)).toBe(lastEntry);
  });

  it("returns 0 for zero or negative failure count", () => {
    expect(SourceAdapterBase.computeBackoffMs(0)).toBe(0);
    expect(SourceAdapterBase.computeBackoffMs(-1)).toBe(0);
  });

  it("Success resets the consecutive-failure count", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter({ auditLog: audit, clock }, [
      mkTransient(),
      mkTransient(),
      mkSuccess(),
      mkTransient(),
    ]);

    await adapter.fetchOnce();
    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    await adapter.fetchOnce();
    expect(adapter.getConsecutiveFailuresForTest()).toBe(2);
    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    await adapter.fetchOnce(); // Success
    expect(adapter.getConsecutiveFailuresForTest()).toBe(0);

    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    const r4 = await adapter.fetchOnce(); // Transient again — n=1
    if (r4.kind === "TransientFailure") expect(r4.retryAfterMs).toBe(BACKOFF_SCHEDULE_MS[0]);
  });

  it("NoChange also resets the consecutive-failure count", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter({ auditLog: audit, clock }, [
      mkTransient(),
      mkNoChange(),
    ]);
    await adapter.fetchOnce();
    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    await adapter.fetchOnce();
    expect(adapter.getConsecutiveFailuresForTest()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Wedged escalation
// ---------------------------------------------------------------------------

describe("SourceAdapterBase wedged escalation", () => {
  it("converts the latest failure into SourceWedged after the threshold elapses", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    // Threshold lowered for test clarity; runtime default is 24h.
    const adapter = new FakeAdapter(
      { auditLog: audit, clock },
      [mkTransient(), mkTransient(), mkTransient()],
      { wedgedThresholdMs: 2 * DEFAULT_POLL_INTERVAL_MS }, // 2h
    );

    const r1 = await adapter.fetchOnce();
    expect(r1.kind).toBe("TransientFailure"); // streak just started

    clock.advance(DEFAULT_POLL_INTERVAL_MS); // +1h
    const r2 = await adapter.fetchOnce();
    expect(r2.kind).toBe("TransientFailure"); // 1h < 2h threshold

    clock.advance(DEFAULT_POLL_INTERVAL_MS); // +1h, total 2h
    const r3 = await adapter.fetchOnce();
    expect(r3.kind).toBe("SourceWedged");
    if (r3.kind !== "SourceWedged") return;
    expect(r3.error).toMatch(/Continuous failure for/);

    expect(audit.all()).toHaveLength(3);
    expect(audit.all()[2]?.result_kind).toBe("SourceWedged");
  });

  it("StructuralFailure also accumulates toward wedged", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter(
      { auditLog: audit, clock },
      [mkStructural(), mkStructural()],
      { wedgedThresholdMs: DEFAULT_POLL_INTERVAL_MS }, // 1h
    );
    await adapter.fetchOnce();
    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    const r2 = await adapter.fetchOnce();
    expect(r2.kind).toBe("SourceWedged");
  });

  it("a Success after wedged recovers and clears the streak", async () => {
    const clock = new FakeClock();
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter(
      { auditLog: audit, clock },
      [mkTransient(), mkTransient(), mkSuccess()],
      { wedgedThresholdMs: DEFAULT_POLL_INTERVAL_MS },
    );
    await adapter.fetchOnce();
    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    const wedged = await adapter.fetchOnce();
    expect(wedged.kind).toBe("SourceWedged");
    clock.advance(DEFAULT_POLL_INTERVAL_MS);
    const recovery = await adapter.fetchOnce();
    expect(recovery.kind).toBe("Success");
    expect(adapter.getConsecutiveFailuresForTest()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// performFetch contract violation
// ---------------------------------------------------------------------------

describe("SourceAdapterBase performFetch contract", () => {
  it("converts a thrown error into StructuralFailure (never throws to caller)", async () => {
    const audit = new InMemoryAuditLogWriter();
    class ThrowingAdapter extends SourceAdapterBase<RawDoc> {
      readonly id = "throwy";
      readonly domainTag: DomainTag = "eligibility";
      readonly url = "https://example.test";
      protected async performFetch(): Promise<FetchResult<RawDoc>> {
        throw new Error("subclass bug");
      }
    }
    const adapter = new ThrowingAdapter({ auditLog: audit, clock: new FakeClock() });
    const result = await adapter.fetchOnce();
    expect(result.kind).toBe("StructuralFailure");
    if (result.kind !== "StructuralFailure") return;
    expect(result.error).toMatch(/performFetch threw/);
    expect(result.error).toMatch(/subclass bug/);
  });
});

// ---------------------------------------------------------------------------
// Audit override metadata
// ---------------------------------------------------------------------------

describe("SourceAdapterBase audit metadata", () => {
  it("includes the override reason in audit metadata when poll interval overridden", async () => {
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter(
      { auditLog: audit, clock: new FakeClock() },
      [mkSuccess()],
      { pollIntervalMs: 60_000, acknowledgedReason: "fy_refresh_active" },
    );
    await adapter.fetchOnce();
    expect(audit.all()[0]?.metadata?.["poll_interval_override_reason"]).toBe(
      "fy_refresh_active",
    );
  });

  it("omits override metadata when running on defaults", async () => {
    const audit = new InMemoryAuditLogWriter();
    const adapter = new FakeAdapter(
      { auditLog: audit, clock: new FakeClock() },
      [mkSuccess()],
    );
    await adapter.fetchOnce();
    expect(audit.all()[0]?.metadata?.["poll_interval_override_reason"]).toBeUndefined();
  });
});
