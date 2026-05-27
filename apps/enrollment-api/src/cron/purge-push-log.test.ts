import { describe, it, expect, vi, beforeEach } from "vitest";
import { purgeOldPushLog } from "./purge-push-log.js";
import { TEST_ENV } from "../test/helpers.js";
import * as supabase from "../lib/supabase.js";

beforeEach(() => {
  vi.restoreAllMocks();
});

function mockDeleteResult(result: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(supabase, "makeServiceClient").mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi.fn(() => ({
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue(result),
          }),
        }),
      })),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe("purgeOldPushLog", () => {
  const noopLog = vi.fn();

  it("returns row count from select-after-delete", async () => {
    mockDeleteResult({
      data: [{ push_id: "p1" }, { push_id: "p2" }, { push_id: "p3" }],
      error: null,
    });
    const result = await purgeOldPushLog(TEST_ENV, noopLog);
    expect(result.rows_purged).toBe(3);
  });

  it("returns 0 when nothing to purge", async () => {
    mockDeleteResult({ data: [], error: null });
    const result = await purgeOldPushLog(TEST_ENV, noopLog);
    expect(result.rows_purged).toBe(0);
  });

  it("returns 0 + logs error on supabase error", async () => {
    mockDeleteResult({ data: null, error: { message: "supabase blip" } });
    const result = await purgeOldPushLog(TEST_ENV, noopLog);
    expect(result.rows_purged).toBe(0);
  });
});
