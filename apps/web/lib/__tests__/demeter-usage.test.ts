import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("../supabase-server", () => ({
  supabaseAdmin: vi.fn(() => ({
    schema: () => ({ rpc: mockRpc }),
  })),
}));

import {
  checkUsageGate,
  settleSpend,
  costUsd,
  estimateTokensFromChars,
  SPEND_CEILING_USD,
  RATE_LIMIT_PER_MINUTE,
} from "../demeter-usage";

describe("demeter usage gate (durable counters, eng review 2A/T-B)", () => {
  beforeEach(() => mockRpc.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("allows under both limits", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null }) // ip window
      .mockResolvedValueOnce({ data: 12.5, error: null }); // spend
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: true });
  });

  it("rate-limits the request AFTER the per-minute cap", async () => {
    mockRpc.mockResolvedValueOnce({ data: RATE_LIMIT_PER_MINUTE + 1, error: null });
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: false, reason: "rate_limited" });
    expect(mockRpc).toHaveBeenCalledTimes(1); // spend never consulted
  });

  it("still allows AT exactly the per-minute cap (boundary)", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: RATE_LIMIT_PER_MINUTE, error: null })
      .mockResolvedValueOnce({ data: 0, error: null });
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: true });
  });

  it("declares capacity AT exactly the spend ceiling (boundary: >= trips)", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: SPEND_CEILING_USD, error: null });
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: false, reason: "at_capacity" });
  });

  it("allows one cent under the ceiling", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: SPEND_CEILING_USD - 0.01, error: null });
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: true });
  });

  it("fails OPEN when the counter store is down (T-B: Console cap backstops)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error("supabase down") });
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: true });
    expect(warn).toHaveBeenCalled();
  });

  it("hashes the IP into the bucket — raw IPs never reach the store", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 0, error: null });
    await checkUsageGate("203.0.113.77");
    const bucket = mockRpc.mock.calls[0][1].p_bucket as string;
    expect(bucket).toMatch(/^ip:[0-9a-f]{16}:\d+$/);
    expect(bucket).not.toContain("203.0.113.77");
  });

  it("settleSpend increments the month bucket and never throws on failure", async () => {
    mockRpc.mockResolvedValueOnce({ data: 5, error: null });
    await settleSpend(0.1234);
    expect(mockRpc.mock.calls[0][1].p_bucket).toMatch(/^spend:\d{4}-\d{2}$/);
    expect(mockRpc.mock.calls[0][1].p_amount).toBeCloseTo(0.1234, 4);

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc.mockRejectedValueOnce(new Error("down"));
    await expect(settleSpend(0.5)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("prices the pinned model and estimates abort-path tokens", () => {
    expect(costUsd(1_000_000, 0)).toBeCloseTo(15);
    expect(costUsd(0, 1_000_000)).toBeCloseTo(75);
    expect(estimateTokensFromChars(400)).toBe(100);
  });
});
