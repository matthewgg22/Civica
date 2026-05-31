import { describe, it, expect } from "vitest";
import { getCaChurnReport } from "../ca-churn";

// Locks the real ICPSR-39331 result (anti-drift) — including the HONEST shape:
// the operational/time variance split is co-equal (NOT "operational dominates"),
// and the EA-cliff effect is a null. Values from the committed artifact.

const r = getCaChurnReport();

describe("getCaChurnReport", () => {
  it("loads the real CA county-month panel (not synthetic)", () => {
    expect(r.sourceKind).toBe("icpsr_39331_panel");
    expect(r.scope).toBe("CA");
    expect(r.panel.nCounties).toBe(58);
    expect(r.panel.nObs).toBeGreaterThan(4000);
  });

  it("headline: ~1 in 4 CA applications is procedurally denied", () => {
    expect(r.weightedMeanProcRatePct).toBeGreaterThan(20);
    expect(r.weightedMeanProcRatePct).toBeLessThan(28); // ~23.9%
  });

  it("operational variation is meaningful but NOT dominant (co-equal with time)", () => {
    expect(r.operational.betweenCountyR2).toBeGreaterThan(0.2); // ~0.31
    // The honest finding: county and time explain comparable shares — operational
    // is a real component, not the majority. Lock that they're within ~10pp.
    expect(Math.abs(r.operational.betweenCountyR2 - r.operational.timeR2)).toBeLessThan(0.1);
    // Persistent spread across adequate-volume counties under identical rules.
    expect(r.operational.p90Pct).toBeGreaterThan(r.operational.p10Pct);
    expect(r.operational.nCountiesAdequate).toBeGreaterThan(40);
    expect(r.operational.interpretation.toLowerCase()).toContain("not the majority");
  });

  it("EA-cliff is an honest NULL (no detectable change in procedural denials)", () => {
    expect(r.eaCliff.significant).toBe(false);
    expect(r.eaCliff.pValue).toBeGreaterThan(0.05);
    // CI crosses zero
    expect(r.eaCliff.ciLowPp).toBeLessThan(0);
    expect(r.eaCliff.ciHighPp).toBeGreaterThan(0);
    expect(r.eaCliff.design.toLowerCase()).toContain("interrupted time series");
  });
});
