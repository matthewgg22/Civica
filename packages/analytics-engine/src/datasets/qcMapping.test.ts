import { describe, expect, it } from "vitest";
import {
  CivicaControlSchema,
  QcCategoryCoverageSchema,
  QcCategoryMappingSchema,
  QcCategoryMappingStatusSchema,
  type QcCategoryMapping,
} from "../schemas.js";

// Pure-schema tests. The dataset reader hits Supabase Storage and is exercised
// by the analytics integration suite (T8 territory); here we just lock the
// public types and the coverage projection.

describe("QC Category Mapping schemas", () => {
  it("accepts a fully-formed documented row", () => {
    const row: QcCategoryMapping = QcCategoryMappingSchema.parse({
      element_code: "363",
      cdss_error_category: "ELEMENT 363 — Shelter deduction",
      weighted_count: 3_522_289,
      share_of_errored_cases_pct: 40.9,
      cfr_basis: "7 CFR 273.9(d)(6)",
      obbba_section: "§10103",
      dollar_attribution_methodology: "40.9% × $10.24B ≈ $4.19B",
      status: "documented",
      civica_controls: [
        {
          control_id: "qc-engine.flows.shared-lease",
          control_description: "Rent + shared-lease evidence packet",
          evidence_link: "packages/snap-qc-engine/src/flows/shared-lease/index.ts",
          defensibility_impact: "strong",
        },
      ],
      case_examples: ["Maria Lopez MA packet (PR #62)"],
      has_civica_control: true,
      control_count: 1,
    });
    expect(row.status).toBe("documented");
    expect(row.civica_controls[0]?.control_id).toBe("qc-engine.flows.shared-lease");
  });

  it("rejects unknown status values", () => {
    expect(() => QcCategoryMappingStatusSchema.parse("speculative")).toThrow();
  });

  it("requires an evidence_link on every control", () => {
    expect(() =>
      CivicaControlSchema.parse({
        control_id: "x",
        control_description: "y",
        defensibility_impact: "z",
      }),
    ).toThrow();
  });

  it("coverage projection drops control bodies but keeps share weight", () => {
    const cov = QcCategoryCoverageSchema.parse({
      element_code: "311",
      cdss_error_category: "ELEMENT 311 — Wages and salaries",
      has_civica_control: false,
      status: "hypothesized",
      share_of_errored_cases_pct: 26.77,
    });
    expect(cov.has_civica_control).toBe(false);
    expect(cov.share_of_errored_cases_pct).toBeCloseTo(26.77);
  });
});
