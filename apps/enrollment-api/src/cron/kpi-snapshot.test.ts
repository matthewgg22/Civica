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

// The cron reads in this order: packet_error_risk (embed), packet_outcomes
// decided + denied, qc_outcomes n + errors, packet_outcomes county n + errors,
// then inserts kpi_snapshot. Provision one query builder per call, in order.
function mockDb(opts: {
  riskRows: RiskRow[];
  decided: number;
  denied: number;
  qcN: number;
  qcErr: number;
  countyN?: number;
  countyErr?: number;
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
        .mockReturnValueOnce(makeQueryBuilder({ data: opts.riskRows, error: null }))             // packet_error_risk
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.decided }))  // packet_outcomes decided
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.denied }))   // packet_outcomes denied
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.qcN }))      // qc_outcomes n
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.qcErr }))    // qc_outcomes errors
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.countyN ?? 0 }))   // packet_outcomes county n
        .mockReturnValueOnce(makeQueryBuilder({ data: null, error: null, count: opts.countyErr ?? 0 })) // packet_outcomes county errors
        .mockReturnValue(insertQb),                                                              // kpi_snapshot insert
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
      qcN: 0, // no completed QC reviews
      qcErr: 0,
      // county defaults to 0 — no authoritative outcomes of any kind yet
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

  it("internal QC review makes measured_per REAL (the Lane-A bridge) without any county feed", async () => {
    const { insertSpy } = mockDb({
      riskRows: [{ packet_id: "A", tier: "low", factors: [], created_at: "2026-05-30T03:00:00Z" }],
      decided: 10,
      denied: 2,
      qcN: 40, // 40 completed internal QC reviews
      qcErr: 4, // 4 found a payment error
      // no county feed (TODO-44 not live) — measured_per is real from QC alone
    });

    const result = await refreshKpiSnapshot(TEST_ENV, noopLog);
    const rows = insertSpy.mock.calls[0]![0] as InsertRow[];

    const per = row(rows, "measured_per");
    expect(per.value_pct).toBe(10); // 4 / 40, from internal QC alone
    expect(per.n).toBe(40);
    expect(per.source_kind).toBe("measured");
    expect(per.meta.status).toBe("measured");
    // Provenance: all of n came from QC, none from county.
    expect(per.meta.by_source).toEqual({ qc_sample: 40, county_authoritative: 0 });
    expect(result.measured_per_n).toBe(40);
    expect(result.qc_n).toBe(40);
    expect(result.county_n).toBe(0);
  });

  it("sums QC + county authoritative feeds into one measured_per", async () => {
    const { insertSpy } = mockDb({
      riskRows: [{ packet_id: "A", tier: "low", factors: [], created_at: "2026-05-30T03:00:00Z" }],
      decided: 0,
      denied: 0,
      qcN: 20,
      qcErr: 2,
      countyN: 20,
      countyErr: 4,
    });

    const result = await refreshKpiSnapshot(TEST_ENV, noopLog);
    const rows = insertSpy.mock.calls[0]![0] as InsertRow[];

    const per = row(rows, "measured_per");
    expect(per.n).toBe(40); // 20 QC + 20 county
    expect(per.value_pct).toBe(15); // (2 + 4) / 40
    expect(per.meta.by_source).toEqual({ qc_sample: 20, county_authoritative: 20 });
    expect(result.qc_n).toBe(20);
    expect(result.county_n).toBe(20);
  });

  it("writes a valid run with no packets / no outcomes (never NaN)", async () => {
    const { insertSpy } = mockDb({ riskRows: [], decided: 0, denied: 0, qcN: 0, qcErr: 0 });

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
