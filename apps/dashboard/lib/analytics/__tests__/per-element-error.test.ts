import { describe, it, expect } from "vitest";
import { getPerElementErrorReport, isSignificant } from "../per-element-error";

// Locks the REAL FY2024-QC result (anti-drift) + the loader's reliable-filter
// logic. Values come from the committed artifact (vendored, stable).

const report = getPerElementErrorReport();
const model = (k: string) => report.models.find((m) => m.dvKey === k)!;

describe("getPerElementErrorReport", () => {
  it("loads the real QC-microdata artifact (not synthetic)", () => {
    expect(report.sourceKind).toBe("qc_microdata");
    expect(report.scope).toBe("CA");
    expect(report.nCases).toBeGreaterThan(800); // ~867 CA cases
    expect(report.predictors).toContain("has_elderly");
    // DV basis is honestly NOT the dollar PER.
    expect(report.dvBasis.toLowerCase()).toContain("not the dollar per");
  });

  it("emits one model per major element + an overall any-error model", () => {
    expect(model("any_error")).toBeDefined();
    expect(model("element_363").label).toBe("Shelter deduction");
    expect(report.models.length).toBeGreaterThanOrEqual(8);
  });

  it("finds the headline signal: elderly households predict errors overall + on shelter", () => {
    const any = model("any_error");
    const elderlyAny = any.terms.find((t) => t.name === "has_elderly")!;
    expect(elderlyAny.odds_ratio).toBeGreaterThan(2); // ~3.27
    expect(isSignificant(elderlyAny)).toBe(true);

    const shelter = model("element_363");
    const elderlyShelter = shelter.terms.find((t) => t.name === "has_elderly")!;
    expect(elderlyShelter.odds_ratio).toBeGreaterThan(2); // ~3.64
    expect(isSignificant(elderlyShelter)).toBe(true);
    // earned income does NOT drive shelter errors (distinct from wage errors)
    const earnShelter = shelter.terms.find((t) => t.name === "has_earned_income")!;
    expect(isSignificant(earnShelter)).toBe(false);
  });

  it("flags the wage model as quasi-separated (mechanically tied to having wages)", () => {
    const wages = model("element_311");
    expect(wages.quasiSeparation).toBe(true);
  });

  it("reliable = converged, powered, non-separated only (excludes wage + underpowered + non-converged)", () => {
    const keys = report.reliable.map((m) => m.dvKey);
    expect(keys).toContain("any_error");
    expect(keys).toContain("element_363"); // shelter — the clean powered model
    expect(keys).not.toContain("element_311"); // quasi-separated
    // every reliable model must actually be converged, powered, non-separated
    for (const m of report.reliable) {
      expect(m.converged).toBe(true);
      expect(m.underpowered).toBe(false);
      expect(m.quasiSeparation).toBe(false);
    }
  });

  it("isSignificant requires p<0.05 AND a CI that excludes OR=1", () => {
    expect(isSignificant({ name: "x", coef: 0.5, odds_ratio: 1.6, or_ci_low: 1.1, or_ci_high: 2.4, p_value: 0.01 })).toBe(true);
    expect(isSignificant({ name: "x", coef: 0.1, odds_ratio: 1.1, or_ci_low: 0.8, or_ci_high: 1.5, p_value: 0.3 })).toBe(false);
  });
});
