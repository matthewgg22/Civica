import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The events sink is where the funnel's integrity is enforced. The event/kind
// are typed enums (safe at compile time), but session_id / scope_state / lang
// are client-echoed strings landing in unbounded text columns. These pin that
// the sink validates each to its real domain, so a conversion route that hands
// it a crafted or oversized value cannot pollute demeter_events (launch audit
// 2026-08-28).

const mockInsert = vi.hoisted(() => vi.fn());

vi.mock("../supabase-server", () => ({
  supabaseAdmin: vi.fn(() => ({
    schema: () => ({ from: () => ({ insert: mockInsert }) }),
  })),
}));
// Sentry is only touched on the error path; a no-op keeps the happy path quiet.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { recordDemeterEvent } from "../demeter-events";

/** The row handed to .insert() for the most recent recordDemeterEvent call. */
function insertedRow(): Record<string, unknown> {
  return mockInsert.mock.calls.at(-1)![0] as Record<string, unknown>;
}

beforeEach(() => {
  mockInsert.mockReset().mockResolvedValue({ error: null });
});
afterEach(() => vi.restoreAllMocks());

describe("recordDemeterEvent sanitizes client-echoed fields", () => {
  const UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

  it("keeps a UUID session id and drops anything else", async () => {
    await recordDemeterEvent({ kind: "conversion", event: "saved", sessionId: UUID });
    expect(insertedRow().session_id).toBe(UUID);

    await recordDemeterEvent({ kind: "conversion", event: "saved", sessionId: "not-a-uuid; DROP TABLE" });
    expect(insertedRow().session_id).toBeNull();
  });

  it("drops an oversized session id instead of storing it", async () => {
    await recordDemeterEvent({ kind: "conversion", event: "pdf_downloaded", sessionId: "x".repeat(10_000) });
    expect(insertedRow().session_id).toBeNull();
  });

  it("normalizes a valid state code and rejects a name or unknown code", async () => {
    await recordDemeterEvent({ kind: "conversion", event: "outline_emailed", scopeState: "ca" });
    expect(insertedRow().scope_state).toBe("CA");

    // email-outline used to pass a NAME into this code column.
    await recordDemeterEvent({ kind: "conversion", event: "outline_emailed", scopeState: "California" });
    expect(insertedRow().scope_state).toBeNull();

    await recordDemeterEvent({ kind: "conversion", event: "outline_emailed", scopeState: "ZZ" });
    expect(insertedRow().scope_state).toBeNull();
  });

  it("keeps a known answer language and drops anything else", async () => {
    await recordDemeterEvent({ kind: "conversion", event: "saved", lang: "vi" });
    expect(insertedRow().lang).toBe("vi");

    await recordDemeterEvent({ kind: "conversion", event: "saved", lang: "klingon" });
    expect(insertedRow().lang).toBeNull();
  });

  it("passes a fully clean event through untouched", async () => {
    await recordDemeterEvent({
      kind: "conversion",
      event: "portal_opened",
      status: 200,
      sessionId: UUID,
      turnIndex: 3,
      scopeState: "NY",
      lang: "es",
      detail: { portal: "mybenefits" },
    });
    const row = insertedRow();
    expect(row).toMatchObject({
      kind: "conversion",
      event: "portal_opened",
      status: 200,
      session_id: UUID,
      turn_index: 3,
      scope_state: "NY",
      lang: "es",
      detail: { portal: "mybenefits" },
    });
  });

  it("never throws — recording stays best-effort even when the insert fails", async () => {
    mockInsert.mockResolvedValue({ error: new Error("db down") });
    await expect(
      recordDemeterEvent({ kind: "failure", event: "stream_error", status: 500 }),
    ).resolves.toBeUndefined();
  });
});
