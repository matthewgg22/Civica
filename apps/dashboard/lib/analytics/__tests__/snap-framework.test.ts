import { describe, it, expect } from "vitest";
import {
  eligibilityGates,
  federalCalculationSteps,
  californiaOverlays,
  underEnrolledPopulations,
  frameworkCoverageSummary,
} from "../snap-framework";

describe("snap-framework analytics", () => {
  const allowedStatus = new Set(["Implemented", "Partial", "Discretionary"]);

  it("eligibilityGates returns a non-empty list with valid status", () => {
    const gates = eligibilityGates();
    expect(gates.length).toBeGreaterThan(0);
    for (const g of gates) {
      expect(allowedStatus.has(g.status)).toBe(true);
      expect(g.statement).toBeTruthy();
      expect(g.figures).toBeTruthy();
    }
  });

  it("federalCalculationSteps returns a non-empty list with valid status", () => {
    const steps = federalCalculationSteps();
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) {
      expect(allowedStatus.has(s.status)).toBe(true);
      expect(s.statement).toBeTruthy();
    }
  });

  it("californiaOverlays returns a non-empty list with valid status", () => {
    const overlays = californiaOverlays();
    expect(overlays.length).toBeGreaterThan(0);
    for (const o of overlays) {
      expect(allowedStatus.has(o.status)).toBe(true);
    }
  });

  it("every framework row references a source file path", () => {
    const all = [...eligibilityGates(), ...federalCalculationSteps(), ...californiaOverlays()];
    for (const item of all) {
      expect(item.source).toBeTruthy();
      // Source must look like a file path inside the workspace (no NaN / undefined leak).
      expect(item.source).not.toContain("undefined");
      expect(item.source).not.toContain("NaN");
    }
  });

  it("steps within each section are unique", () => {
    for (const section of [eligibilityGates(), federalCalculationSteps(), californiaOverlays()]) {
      const steps = section.map((s) => s.step);
      expect(new Set(steps).size).toBe(steps.length);
    }
  });

  it("underEnrolledPopulations entries are well-formed", () => {
    const pops = underEnrolledPopulations();
    expect(pops.length).toBeGreaterThan(0);
    for (const p of pops) {
      expect(p.population).toBeTruthy();
      expect(p.step).toBeGreaterThan(0);
    }
  });

  it("frameworkCoverageSummary counts match the section lengths", () => {
    const s = frameworkCoverageSummary();
    expect(s.gates).toBe(eligibilityGates().length);
    expect(s.calcSteps).toBe(federalCalculationSteps().length);
  });
});
