import { describe, it, expect } from "vitest";
import {
  CliffEntrySchema,
  LiabilityScenarioSchema,
  ProvenanceSchema,
  PERSchema,
} from "./schemas";

describe("analytics-engine schemas", () => {
  it("parses a valid provenance sidecar", () => {
    const parsed = ProvenanceSchema.parse({
      source_url: "data-ops/raw/section-10105/civica_state_liability_fy24.csv",
      source_kind: "section_10105_cliff",
      publication_date: "2026-05-12",
      fiscal_year: 2024,
      pulled_at: "2026-05-18T22:30:00Z",
      sha256_of_source: "abc123",
      parser_path: "data-ops/parsers/section_10105_to_parquet.ts",
      parser_version: "0.1.0",
      row_count: 51,
    });
    expect(parsed.source_kind).toBe("section_10105_cliff");
  });

  it("rejects unknown source_kind values", () => {
    expect(() =>
      ProvenanceSchema.parse({
        source_url: "x",
        source_kind: "made_up",
        publication_date: "2026-05-18",
        pulled_at: "2026-05-18T00:00:00Z",
        sha256_of_source: "x",
        parser_path: "x",
        parser_version: "0.1.0",
        row_count: 0,
      }),
    ).toThrow();
  });

  it("parses a §10105 cliff entry", () => {
    const entry = CliffEntrySchema.parse({
      state: "New York",
      fy24_per_pct: 14.09,
      fy24_benefits_millions: 7354,
      tier: "Tier 3: ≥10%",
      delayed_to_fy29: true,
      annualized_liability_at_tier_millions: 1103.1,
    });
    expect(entry.delayed_to_fy29).toBe(true);
  });

  it("parses a full multi-scenario liability row", () => {
    const row = LiabilityScenarioSchema.parse({
      state: "California",
      fy24_per_pct: 10.98,
      fy24_benefits_millions: 12377,
      tier: "Tier 3: ≥10%",
      state_share_pct: 15,
      delayed_to_fy29: false,
      fy28_state_liability_millions: 1856.5,
      annualized_liability_at_tier_millions: 1856.5,
      fy28_benefits_conservative_millions: 12541.9,
      fy28_liability_conservative_millions: 1881.3,
      fy29_annualized_conservative_millions: 1881.3,
      fy28_benefits_mid_millions: 11695,
      fy28_liability_mid_millions: 1754.2,
      fy29_annualized_mid_millions: 1754.2,
      fy28_benefits_aggressive_millions: 10794,
      fy28_liability_aggressive_millions: 1619.1,
      fy29_annualized_aggressive_millions: 1619.1,
    });
    expect(row.state).toBe("California");
  });

  it("PERSchema enforces two-letter state codes", () => {
    expect(() =>
      PERSchema.parse({ state_code: "CALIFORNIA", state_name: "California", fiscal_year: 2024, per_total: 10.98 }),
    ).toThrow();
    expect(
      PERSchema.parse({ state_code: "CA", state_name: "California", fiscal_year: 2024, per_total: 10.98 }),
    ).toBeTruthy();
  });
});
