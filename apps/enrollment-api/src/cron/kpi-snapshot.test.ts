// T6 — integration test for the kpi-snapshot cron (the outcome→builder→snapshot path).
//
// Locks the load-bearing invariant: a self-reported outcome moves denial_rate
// but NEVER measured_per (which reads authoritative sources only — premise P2).
// Also exercises the cron's real query→dedup→insert wiring (the PostgREST chain
// shapes the engine unit test couldn't cover) and the never-NaN n=0 path.
//
// Mock pattern follows internal-qc-sampler.test.ts: makeQueryBuilder per call,
// sequential from() in the cron's read order.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase.js", () => ({ makeServiceClient: vi.fn() }));

import { makeServiceClient } from "../lib/supabase.js";
import { refreshKpiSnapshot } from "./kpi-snapshot.js";
import { TEST_ENV, makeQueryBuilder } from "../test/helpers.js";

const noopLog = () => {};

beforeEach(() => vi.resetAllMocks());

type RiskRow = { packet_id: string; tier: string; factors: unknown; created_at: string };
type InsertRow = {
  computed_at: string;
  kpi_key: string;
  element: string | null;
  value_pct: number | null;
  n: number | null;
  source_kind: string;
  meta: Record<string, unknown>;
};

// The cron reads in this order: packet_error_risk (embed), then packet_outcomes
// ×4 (decided / denied / authoritative-n / authoritative-errors), then inserts
// kpi_snapshot. Provision one query builder per call, in order.
function mockDb(opts: {
  riskRows: RiskRow[];
  decided: number;
  denied: number;
  authN: number;
  authErr: number;
}) {
  const insertSpy = vi.fn();
  const insertQb = makeQueryBuilder({ data: [{ snapshot_id: "s1" }], error: null });
  insertQb.insert = vi.fn((rows: unknown) => {
    insertSpy(rows);
    return insertQb;
  });

  vi.mocked(makeServiceClient).mockReturnValue({
    schema: vi.fn().mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce(makeQueryBuilder({ data: opts.riskRows, error: null }))
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.decided }))
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.denied }))
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.authN }))
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.authErr }))
        .mockReturnValue(insertQb),
    }),
  } as never);

  return { insertSpy };
}

const row = (rows: InsertRow[], kpi: string, element: string | null = null) =>
  rows.find((r) => r.kpi_key === kpi && r.element === element)!;

describe("refreshKpiSnapshot", () => {
  it("self-report denials move denial_rate; measured_per (authoritative) stays untouched", async () => {
    const { insertSpy } = mockDb({
      // packet A appears twice (history) — DESC order, latest is 'low' (clean).
      // The stale 'high'+factor A row must be ignored by the dedup.
      riskRows: [
        { packet_id: "A", tier: "low", factors: [], created_at: "2026-05-30T03:00:00Z" },
        { packet_id: "A", tier: "high", factors: ["earned_income_unverified"], created_at: "2026-05-29T03:00:00Z" },
        { packet_id: "B", tier: "low", factors: [], created_at: "2026-05-30T02:00:00Z" },
        { packet_id: "C", tier: "high", factors: ["earned_income_unverified"], created_at: "2026-05-30T01:00:00Z" },
      ],
      decided: 40,
      denied: 8,
      authN: 0, // no authoritative outcomes yet (pre-TODO-44)
      authErr: 0,
    });

    const result = await refreshKpiSnapshot(TEST_ENV, noopLog);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    const rows = insertSpy.mock.calls[0]![0] as InsertRow[];

    // CPR: A deduped to its latest (low) → 2 clean of 3 distinct submitted packets.
    const cpr = row(rows, "clean_packet_rate");
    expect(cpr.value_pct).toBeCloseTo(66.667, 3);
    expect(cpr.n).toBe(3);
    expect(cpr.source_kind).toBe("leading");

    // Element-clean dedup: A's stale 'high'+factor row is ignored; only C triggers.
    const el = row(rows, "element_clean_rate", "earned_income_unverified");
    expect(el.value_pct).toBeCloseTo(66.667, 3); // (3 - 1) / 3
    expect(el.n).toBe(3);

    // denial_rate: self-reports above the gate → a real measured rate.
    const dr = row(rows, "denial_rate");
    expect(dr.value_pct).toBe(20); // 8 / 40
    expect(dr.n).toBe(40);
    expect(dr.source_kind).toBe("measured");
    expect(dr.meta.status).toBe("measured");

    // FIDELITY (the load-bearing assertion): no authoritative outcomes → PER
    // untouched even though 40 self-reported decisions exist.
    const per = row(rows, "measured_per");
    expect(per.value_pct).toBeNull();
    expect(per.n).toBe(0);
    expect(per.meta.status).toBe("insufficient_sample");

    // One run key across every row.
    expect(new Set(rows.map((r) => r.computed_at)).size).toBe(1);

    // Result summary echoes the snapshot.
    expect(result.total_scored).toBe(3);
    expect(result.measured_per_n).toBe(0);
    expect(result.clean_packet_rate).toBeCloseTo(66.667, 3);
  });

  it("writes a valid run with no packets / no outcomes (never NaN)", async () => {
    const { insertSpy } = mockDb({ riskRows: [], decided: 0, denied: 0, authN: 0, authErr: 0 });

    const result = await refreshKpiSnapshot(TEST_ENV, noopLog);

    const rows = insertSpy.mock.calls[0]![0] as InsertRow[];
    const cpr = row(rows, "clean_packet_rate");
    expect(cpr.value_pct).toBeNull();
    expect(cpr.n).toBe(0);
    expect(cpr.meta.status).toBe("no_packets");
    // Both measured rows are honest insufficient_sample at n=0 (no NaN).
    expect(row(rows, "denial_rate").value_pct).toBeNull();
    expect(row(rows, "measured_per").value_pct).toBeNull();
    expect(result.total_scored).toBe(0);
  });

  it("propagates a read failure (error surfaces, no partial run)", async () => {
    vi.mocked(makeServiceClient).mockReturnValue({
      schema: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValueOnce(makeQueryBuilder({ data: null, error: { message: "boom" } })),
      }),
    } as never);

    await expect(refreshKpiSnapshot(TEST_ENV, noopLog)).rejects.toThrow(/packet_error_risk read failed/);
  });
});
