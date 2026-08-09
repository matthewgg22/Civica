import { describe, it, expect, vi, beforeEach } from "vitest";

// The whole value of this readout is that the number is measured. These tests
// mostly guard the ways it could quietly stop being true — an empty window
// rendering as 0%, or an outage falling back to a flattering constant.

const mockRpc = vi.hoisted(() => vi.fn());
const mockAdmin = vi.hoisted(() => vi.fn());
vi.mock("../supabase-server", () => ({ supabaseAdmin: mockAdmin }));

import { certaintyStats } from "../certainty-stats";

const row = (over: Partial<Record<string, unknown>> = {}) => ({
  window_days: 30,
  total_answers: 200,
  certain_answers: 194,
  grounded_rate: 97.0,
  degraded: 3,
  recomposed: 11,
  top_reason: "state_not_verified",
  first_answer_at: "2026-07-10T00:00:00Z",
  last_answer_at: "2026-08-09T00:00:00Z",
  ...over,
});

beforeEach(() => {
  mockRpc.mockReset();
  mockAdmin.mockReset().mockReturnValue({ schema: () => ({ rpc: mockRpc }) });
});

describe("certaintyStats", () => {
  it("reports a real measurement when the window has answers", async () => {
    mockRpc.mockResolvedValue({ data: [row()], error: null });
    const s = await certaintyStats(30);
    expect(s.measured).toBe(true);
    expect(s.groundedRate).toBe(97);
    expect(s.totalAnswers).toBe(200);
    expect(s.degraded).toBe(3);
    expect(s.topReason).toBe("state_not_verified");
  });

  it("reports NOT MEASURED for an empty window — never 0%", async () => {
    // 0% would read as "Demeter is wrong all the time" when the truth is
    // "nobody has asked it anything yet".
    mockRpc.mockResolvedValue({ data: [row({ total_answers: 0, grounded_rate: null })], error: null });
    const s = await certaintyStats(30);
    expect(s.measured).toBe(false);
    expect(s.groundedRate).toBeNull();
  });

  it("reports NOT MEASURED when the store errors — no fallback figure", async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error("db down") });
    const s = await certaintyStats(30);
    expect(s.measured).toBe(false);
    expect(s.groundedRate).toBeNull();
    expect(s.totalAnswers).toBe(0);
  });

  it("reports NOT MEASURED when Supabase isn't configured at all", async () => {
    // The real unconfigured path: supabaseAdmin() itself throws.
    mockAdmin.mockImplementation(() => {
      throw new Error("Missing Supabase admin config");
    });
    const s = await certaintyStats(30);
    expect(s.measured).toBe(false);
    expect(s.groundedRate).toBeNull();
  });

  it("handles a bare object instead of an array", async () => {
    mockRpc.mockResolvedValue({ data: row(), error: null });
    expect((await certaintyStats(30)).measured).toBe(true);
  });

  it("coerces Postgres bigint/numeric strings to numbers", async () => {
    // node-postgres returns bigint and numeric as strings; untreated they'd
    // render as "194" vs 194 and break arithmetic downstream.
    mockRpc.mockResolvedValue({
      data: [row({ total_answers: "200", certain_answers: "194", grounded_rate: "97.0", degraded: "3" })],
      error: null,
    });
    const s = await certaintyStats(30);
    expect(s.totalAnswers).toBe(200);
    expect(s.groundedRate).toBe(97);
    expect(typeof s.degraded).toBe("number");
  });

  it("passes the requested window through to the RPC", async () => {
    mockRpc.mockResolvedValue({ data: [row({ window_days: 7 })], error: null });
    await certaintyStats(7);
    expect(mockRpc).toHaveBeenCalledWith("demeter_certainty_stats", { p_days: 7 });
  });
});
