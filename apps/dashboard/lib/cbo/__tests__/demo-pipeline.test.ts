import { describe, it, expect } from "vitest";
import { buildPipeline } from "../demo-pipeline";

// Runs the REAL engine (assessPacket + computeBenefit) over the synthetic
// caseload, so it guards the three-engine wiring end to end.
describe("buildPipeline", () => {
  it("returns empty phases when the synthetic trigger is off", () => {
    const groups = buildPipeline("CA", new Date(), false);
    expect(groups.every((g) => g.cases.length === 0)).toBe(true);
  });

  it("enriches synthetic cases with benefit, deduction trace, and recommendations", () => {
    const cases = buildPipeline("CA", new Date(), true).flatMap((g) => g.cases);
    expect(cases.length).toBeGreaterThan(0);

    const c = cases.find((x) => x.estimatedBenefitUsd !== null);
    expect(c, "expected at least one case with a benefit estimate").toBeTruthy();
    expect(c!.deduction).not.toBeNull();
    expect(c!.deduction!.monthly_benefit).toBe(c!.estimatedBenefitUsd);
    expect(Array.isArray(c!.recommendations)).toBe(true);
    // verification needs (still-needed-to-determine) remain populated
    expect(Array.isArray(c!.verificationNeeds)).toBe(true);
  });
});
