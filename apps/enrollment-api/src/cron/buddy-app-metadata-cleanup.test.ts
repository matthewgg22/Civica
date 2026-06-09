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

// fetch mock for clearAppMetadataRole: a GET reads the user's current role, a
// PUT clears it. Branch on method (the GET has no method; the PUT sets "PUT").
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function roleFetchMock(role: string | null, putStatus = 200): any {
  return vi.fn().mockImplementation((_url: string, init?: { method?: string }) => {
    if (init?.method === "PUT") {
      return Promise.resolve(new Response(null, { status: putStatus }));
    }
    return Promise.resolve(
      new Response(JSON.stringify({ app_metadata: { role } }), { status: 200 }),
    );
  });
}

describe("cleanupBuddyAppMetadata", () => {
  it("returns zero counts when there are no candidates", async () => {
    mockDb({ data: [], error: null });
    const result = await cleanupBuddyAppMetadata(TEST_ENV);
    expect(result).toEqual({ candidates: 0, cleared: 0, failed: 0, skipped_still_active: 0 });
  });

  it("calls Admin API and counts cleared rows on success", async () => {
    mockDb({
      data: [
        { id: "rel-1", buddy_user_id: "user-1" },
        { id: "rel-2", buddy_user_id: "user-2" },
      ],
      error: null,
    });

    const fetchMock = roleFetchMock("buddy");
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const result = await cleanupBuddyAppMetadata(TEST_ENV);

    expect(result.candidates).toBe(2);
    expect(result.cleared).toBe(2);
    expect(result.failed).toBe(0);
    // Each cleared row is a GET (read role) + PUT (clear) = 4 calls for 2 rows.
    expect(fetchMock).toHaveBeenCalledTimes(4);

    // The PUT must clear the role to null.
    const putCall = fetchMock.mock.calls.find(
      (c: unknown[]) => (c[1] as { method?: string } | undefined)?.method === "PUT",
    );
    if (!putCall) throw new Error("expected a PUT call clearing the role");
    expect(JSON.parse((putCall[1] as { body: string }).body)).toEqual({
      app_metadata: { role: null },
    });
  });

  it("counts failed rows when Admin API returns non-2xx", async () => {
    mockDb({
      data: [{ id: "rel-1", buddy_user_id: "user-1" }],
      error: null,
    });

    globalThis.fetch = roleFetchMock("buddy", 500) as unknown as typeof globalThis.fetch;

    const result = await cleanupBuddyAppMetadata(TEST_ENV);

    expect(result.candidates).toBe(1);
    expect(result.cleared).toBe(0);
    expect(result.failed).toBe(1);
  });

  // A caseworker can hold a buddy_relationship row via the shared invite link
  // ("extension of friend"). When that row completes/revokes, the cron must
  // NEVER null their navigator role — that would destroy their staff access.
  it("leaves a non-buddy (caseworker) role untouched", async () => {
    mockDb({
      data: [{ id: "rel-staff", buddy_user_id: "navigator-1" }],
      error: null,
    });

    const fetchMock = roleFetchMock("navigator");
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const result = await cleanupBuddyAppMetadata(TEST_ENV);

    expect(result.candidates).toBe(1);
    expect(result.failed).toBe(0);
    // The role was read (GET) but never nulled (no PUT).
    const putCall = fetchMock.mock.calls.find(
      (c: unknown[]) => (c[1] as { method?: string } | undefined)?.method === "PUT",
    );
    expect(putCall).toBeUndefined();
  });

  it("throws when the candidate query itself fails", async () => {
    mockDb({ data: null, error: { message: "permission denied" } });
    await expect(cleanupBuddyAppMetadata(TEST_ENV)).rejects.toThrow(
      /buddy_relationship select failed/,
    );
  });

  // Regression for the multi-applicant buddy bug caught in the pre-merge
  // review: app_metadata.role is per-auth-user, not per-relationship. If the
  // buddy still helps another applicant (active row), clearing their global
  // role would silently break that link. The activity check must come BEFORE
  // the Admin API call.
  it("skips Admin API when the buddy still has another active relationship", async () => {
    const selectQb = makeQueryBuilder({
      data: [{ id: "rel-completed", buddy_user_id: "buddy-multi" }],
      error: null,
    });
    // 2nd from() call: activity check returns one active row → still-active path
    const activeQb = makeQueryBuilder({
      data: [{ id: "rel-still-active" }],
      error: null,
    });
    const updateQb = makeQueryBuilder({ data: null, error: null });

    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi
          .fn()
          .mockReturnValueOnce(selectQb) // initial candidate SELECT
          .mockReturnValueOnce(activeQb) // per-row active-check SELECT
          .mockReturnValue(updateQb),     // per-row bookkeeping UPDATE
      }),
    } as never);

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const result = await cleanupBuddyAppMetadata(TEST_ENV);

    expect(result.candidates).toBe(1);
    expect(result.cleared).toBe(0);
    expect(result.skipped_still_active).toBe(1);
    expect(result.failed).toBe(0);
    // The Admin API must NOT be called for a buddy who still has an active
    // relationship — clearing the role globally would break that link.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts UPDATE failure as failed even when Admin API succeeds", async () => {
    // Admin API succeeds but the bookkeeping UPDATE returns an error → count
    // the row as failed so it gets retried on the next sweep (idempotent).
    mockDb(
      { data: [{ id: "rel-1", buddy_user_id: "user-1" }], error: null },
      /* updateOk */ false,
    );

    globalThis.fetch = roleFetchMock("buddy") as unknown as typeof globalThis.fetch;

    const result = await cleanupBuddyAppMetadata(TEST_ENV);
    expect(result.cleared).toBe(0);
    expect(result.failed).toBe(1);
  });
});
