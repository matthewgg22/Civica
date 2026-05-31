import { describe, it, expect } from "vitest";
import { perGapSummary } from "../per-gap";
import type { KpiView } from "../kpi-snapshot";

const measured = (over: Partial<KpiView>): KpiView =>
  ({
    pillar: "get_in",
    kpiKey: "measured_per",
    element: null,
    valuePct: null,
    ciLow: null,
    ciHigh: null,
    n: 0,
    baselineRef: 10.98,
    sourceKind: "measured",
    meta: {},
    ...over,
  }) as KpiView;

describe("perGapSummary", () => {
  it("is pending when there is no measured cohort PER", () => {
    const g = perGapSummary(null, 10.98, 10.93);
    expect(g.pending).toBe(true);
    expect(g.cohortPct).toBeNull();
    expect(g.gapPp).toBeNull();
    expect(g.caBaselinePct).toBe(10.98);
    expect(g.nationalPct).toBe(10.93);
  });

  it("is pending when the measured row is below the n-gate (insufficient_sample)", () => {
    const g = perGapSummary(
      measured({ valuePct: null, n: 12, meta: { status: "insufficient_sample" } }),
      10.98,
      10.93,
    );
    expect(g.pending).toBe(true);
    expect(g.n).toBe(12);
    expect(g.gapPp).toBeNull();
  });

  it("computes the gap (cohort below the CA bar) when measured", () => {
    const g = perGapSummary(measured({ valuePct: 7.0, n: 40, meta: { status: "measured" } }), 10.98, 10.93);
    expect(g.pending).toBe(false);
    expect(g.cohortPct).toBe(7.0);
    expect(g.gapPp).toBe(4.0); // 10.98 − 7.0 = 3.98 → round1 → 4.0
    expect(g.n).toBe(40);
  });

  it("reports a negative gap when the cohort is above the CA bar", () => {
    const g = perGapSummary(measured({ valuePct: 12.0, n: 50, meta: { status: "measured" } }), 10.98, 10.93);
    expect(g.pending).toBe(false);
    expect(g.gapPp).toBe(-1.0); // 10.98 − 12.0 = −1.02 → round1 → −1.0
  });
});
