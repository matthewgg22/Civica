import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("../supabase-server", () => ({
  supabaseAdmin: vi.fn(() => ({ schema: () => ({ rpc: mockRpc }) })),
}));

import { checkUsageGate, settleSpend, IP_DAILY_SPEND_USD } from "../demeter-usage";

// Per-IP daily spend cap.
//
// The monthly ceiling is GLOBAL and the rate limit counts REQUESTS, so neither
// stops one visitor consuming everyone else's budget: max-size requests at the
// rate limit run ~$0.30/min, exhausting a $15 month in under an hour. The harm
// isn't the bill — it's the service reading "at capacity" to every real
// applicant for the rest of the month.
describe("per-IP daily spend cap", () => {
  beforeEach(() => mockRpc.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("cuts off the heavy IP only — not the whole service", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null }) // rate window: fine
      .mockResolvedValueOnce({ data: 0.5, error: null }) // global spend: nowhere near
      .mockResolvedValueOnce({ data: IP_DAILY_SPEND_USD, error: null }); // this IP: at cap
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: false, reason: "ip_daily_cap" });
  });

  it("reports at_capacity ahead of the IP cap when the service really is full", async () => {
    // Order matters for what the user is TOLD. Blaming the visitor when the
    // service is genuinely exhausted would send a real applicant away for a
    // reason that isn't true.
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null })
      .mockResolvedValueOnce({ data: 1_000_000, error: null }); // global: exhausted
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: false, reason: "at_capacity" });
  });

  it("lets an ordinary session through", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: 0.2, error: null })
      .mockResolvedValueOnce({ data: 0.05, error: null });
    expect(await checkUsageGate("1.2.3.4")).toEqual({ allowed: true });
  });

  it("settles into BOTH buckets, or the cap never accumulates", async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    await settleSpend(0.02, new Date(), "1.2.3.4");
    const buckets = mockRpc.mock.calls.map((c) => c[1].p_bucket as string);
    expect(buckets.some((b) => b.startsWith("spend:"))).toBe(true);
    expect(buckets.some((b) => b.startsWith("ipspend:"))).toBe(true);
    // Same hashing discipline as the rate window — no raw IP is ever stored.
    expect(buckets.find((b) => b.startsWith("ipspend:"))).toMatch(
      /^ipspend:[0-9a-f]{16}:\d{4}-\d{2}-\d{2}$/,
    );
    expect(buckets.join(" ")).not.toContain("1.2.3.4");
  });

  it("a failed per-IP settle never loses the GLOBAL settle", async () => {
    // The global ceiling is what protects the budget; per-IP attribution is
    // secondary and must not be able to take it down with it.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null }) // global: recorded
      .mockRejectedValueOnce(new Error("per-ip down"));
    await expect(settleSpend(0.02, new Date(), "1.2.3.4")).resolves.toBeUndefined();
    expect(mockRpc.mock.calls[0][1].p_bucket).toMatch(/^spend:/);
    expect(warn).toHaveBeenCalled();
  });

  it("settles global-only when no ip is supplied (staff/eval callers)", async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null });
    await settleSpend(0.02);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls[0][1].p_bucket).toMatch(/^spend:/);
  });
});
