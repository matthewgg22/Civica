import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/supabase.js", () => ({
  makeServiceClient: vi.fn(),
}));

import { makeServiceClient } from "../lib/supabase.js";
import { cleanupBuddyAppMetadata } from "./buddy-app-metadata-cleanup.js";
import { TEST_ENV, makeQueryBuilder } from "../test/helpers.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// One mock client for both select and update — the SUT calls schema().from() twice
// per row (once to select, once to update). A single shared `from` mock returning
// the same query builder lets the builder accumulate select/update method calls
// across both invocations.
function mockDb(selectResult: { data: unknown; error: unknown }, updateOk = true) {
  const selectQb = makeQueryBuilder(selectResult);
  const updateQb = makeQueryBuilder({
    data: null,
    error: updateOk ? null : { message: "update failed" },
  });
  vi.mocked(makeServiceClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(selectQb) // first call: SELECT candidates
        // every subsequent call (one per row) is an UPDATE
        .mockReturnValue(updateQb),
    }),
  } as never);
}

describe("cleanupBuddyAppMetadata", () => {
  it("returns zero counts when there are no candidates", async () => {
    mockDb({ data: [], error: null });
    const result = await cleanupBuddyAppMetadata(TEST_ENV);
    expect(result).toEqual({ candidates: 0, cleared: 0, failed: 0 });
  });

  it("calls Admin API and counts cleared rows on success", async () => {
    mockDb({
      data: [
        { id: "rel-1", buddy_user_id: "user-1" },
        { id: "rel-2", buddy_user_id: "user-2" },
      ],
      error: null,
    });

    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const result = await cleanupBuddyAppMetadata(TEST_ENV);

    expect(result.candidates).toBe(2);
    expect(result.cleared).toBe(2);
    expect(result.failed).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Verify the Admin API was called with role: null
    const firstCall = fetchMock.mock.calls[0];
    if (!firstCall) throw new Error("expected at least one fetch call");
    const [, init] = firstCall;
    const body = JSON.parse(init.body);
    expect(body).toEqual({ app_metadata: { role: null } });
    expect(init.method).toBe("PUT");
  });

  it("counts failed rows when Admin API returns non-2xx", async () => {
    mockDb({
      data: [{ id: "rel-1", buddy_user_id: "user-1" }],
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 500 }),
    ) as unknown as typeof globalThis.fetch;

    const result = await cleanupBuddyAppMetadata(TEST_ENV);

    expect(result.candidates).toBe(1);
    expect(result.cleared).toBe(0);
    expect(result.failed).toBe(1);
  });

  it("throws when the candidate query itself fails", async () => {
    mockDb({ data: null, error: { message: "permission denied" } });
    await expect(cleanupBuddyAppMetadata(TEST_ENV)).rejects.toThrow(
      /buddy_relationship select failed/,
    );
  });

  it("counts UPDATE failure as failed even when Admin API succeeds", async () => {
    // Admin API succeeds but the bookkeeping UPDATE returns an error → count
    // the row as failed so it gets retried on the next sweep (idempotent).
    mockDb(
      { data: [{ id: "rel-1", buddy_user_id: "user-1" }], error: null },
      /* updateOk */ false,
    );

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 200 }),
    ) as unknown as typeof globalThis.fetch;

    const result = await cleanupBuddyAppMetadata(TEST_ENV);
    expect(result.cleared).toBe(0);
    expect(result.failed).toBe(1);
  });
});
