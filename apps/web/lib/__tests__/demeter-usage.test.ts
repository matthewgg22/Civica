import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
// MAE_GENERATION, not the bare MAE_MODEL constant: this is the object the
// request is actually built from, so the assertion is against what production
// sends rather than a constant that merely ought to feed it.
import { MAE_GENERATION } from "@civica/demeter-engine";

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
    // Sonnet 5 list: $3 / $15 per Mtok. List, not the introductory $2/$10 —
    // under-counting spend is what lets real cost run past the ceiling, and an
    // intro rate becomes an under-count the moment it lapses.
    expect(costUsd(1_000_000, 0)).toBeCloseTo(3);
    expect(costUsd(0, 1_000_000)).toBeCloseTo(15);
    expect(estimateTokensFromChars(400)).toBe(100);
  });

  it("prices the model that is actually pinned, at its real rate", () => {
    // The bug this catches, which shipped and went unnoticed: these constants
    // said $15/$75 while the pin was Opus 4.8, whose real rate is $5/$25. Every
    // answer settled at 3x cost, so the ceiling would trip after a third of the
    // spend it was meant to allow. It failed toward cutting the service off
    // early, which is why no alarm ever went off.
    //
    // A price table keyed by model id is the only assertion that couples the
    // two: change the pin without changing the rate and this fails.
    const RATES_USD_PER_MTOK: Record<string, { in: number; out: number }> = {
      "claude-sonnet-5": { in: 3, out: 15 },
      "claude-opus-4-8": { in: 5, out: 25 },
      "claude-haiku-4-5": { in: 1, out: 5 },
    };
    const expected = RATES_USD_PER_MTOK[MAE_GENERATION.model];
    expect(expected, `no published rate recorded for pinned model ${MAE_GENERATION.model}`).toBeDefined();
    expect(costUsd(1_000_000, 0)).toBeCloseTo(expected!.in);
    expect(costUsd(0, 1_000_000)).toBeCloseTo(expected!.out);
  });
});
