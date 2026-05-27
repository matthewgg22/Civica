// Tests for the CDSS / county-facing baseline mapping module — TODO-4.
//
// Three things to lock in:
//   - The error-category table sums consistently with the pillar shares
//     it derives from (catches drift if PILLAR_SHARES_UNNORMALIZED changes
//     without a matching update to the mapping table).
//   - The BBCE scenario carries its provenance marker so it never silently
//     ships externally without sourcing.
//   - The TAM profile math matches the source income-group breakdown.

import { describe, it, expect } from "vitest";
import {
  CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS,
  CIVICA_ADDRESSABLE_SHARE_PCT,
  BBCE_REMOVAL_SCENARIO,
  CIVICA_TAM_PROFILE,
  pillarReductionAtFullEngagement,
  listMappedFnsElements,
  civicaAddressableCategories,
  residualCategories,
} from "../src/scoring/cdss-mapping";
import {
  CA_BASELINE_PER,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  PILLAR_SHARES_UNNORMALIZED,
  INCOME_GROUP_PER_FY23,
} from "../src/scoring/error-risk";

describe("CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS", () => {
  it("is non-empty and every row carries an FNS element + label + share", () => {
    expect(CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS.length).toBeGreaterThan(0);
    for (const row of CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS) {
      expect(typeof row.fns_element).toBe("number");
      expect(row.label.length).toBeGreaterThan(0);
      expect(row.ca_share_pct).toBeGreaterThan(0);
      expect(row.note.length).toBeGreaterThan(0);
    }
  });

  it("FNS element codes are unique (no duplicate rows for the same element)", () => {
    const ids = listMappedFnsElements();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("residual rows have empty pillars + the no_civica_control marker", () => {
    for (const row of residualCategories()) {
      expect(row.pillars).toEqual([]);
      expect(row.controls).toEqual(["no_civica_control"]);
      expect(row.residual).toBe(true);
    }
  });

  it("Civica-addressable rows have at least one pillar and at least one control", () => {
    for (const row of civicaAddressableCategories()) {
      expect(row.pillars.length).toBeGreaterThan(0);
      expect(row.controls.length).toBeGreaterThan(0);
      expect(row.controls).not.toContain("no_civica_control");
      expect(row.residual).toBe(false);
    }
  });

  it("CIVICA_ADDRESSABLE_SHARE_PCT equals 100 × sum(PILLAR_SHARES_UNNORMALIZED)", () => {
    const shareSum =
      PILLAR_SHARES_UNNORMALIZED.utility_sua +
      PILLAR_SHARES_UNNORMALIZED.gig_income +
      PILLAR_SHARES_UNNORMALIZED.shared_lease +
      PILLAR_SHARES_UNNORMALIZED.assets +
      PILLAR_SHARES_UNNORMALIZED.benefit_impact;
    expect(CIVICA_ADDRESSABLE_SHARE_PCT).toBeCloseTo(shareSum * 100, 10);
  });

  it("addressable + residual rows cover the dominant CA error elements (sum ≥ 95%)", () => {
    // The mapping doesn't enumerate every element <0.5% — only the ones large
    // enough to mention in a county pitch. Check that what IS listed covers
    // the bulk of the error surface so the table can't quietly omit major
    // categories.
    const total = CDSS_ERROR_CATEGORY_TO_CIVICA_CONTROLS.reduce(
      (sum, r) => sum + r.ca_share_pct,
      0,
    );
    expect(total).toBeGreaterThanOrEqual(95);
  });
});

describe("pillarReductionAtFullEngagement", () => {
  it("sums to the published reduction (CA_BASELINE_PER − PROJECTED_PER_AT_FULL_ENGAGEMENT)", () => {
    const r = pillarReductionAtFullEngagement();
    const total =
      r.utility_sua +
      r.gig_income +
      r.shared_lease +
      r.assets +
      r.benefit_impact;
    expect(total).toBeCloseTo(CA_BASELINE_PER - PROJECTED_PER_AT_FULL_ENGAGEMENT, 10);
  });

  it("each pillar's reduction is non-negative", () => {
    const r = pillarReductionAtFullEngagement();
    expect(r.utility_sua).toBeGreaterThanOrEqual(0);
    expect(r.gig_income).toBeGreaterThanOrEqual(0);
    expect(r.shared_lease).toBeGreaterThanOrEqual(0);
    expect(r.assets).toBeGreaterThanOrEqual(0);
    expect(r.benefit_impact).toBeGreaterThanOrEqual(0);
  });

  it("utility_sua is the largest single-pillar contribution (matches shelter dominance)", () => {
    const r = pillarReductionAtFullEngagement();
    expect(r.utility_sua).toBeGreaterThan(r.gig_income);
    expect(r.utility_sua).toBeGreaterThan(r.shared_lease);
    expect(r.utility_sua).toBeGreaterThan(r.benefit_impact);
    expect(r.utility_sua).toBeGreaterThan(r.assets);
  });
});

describe("BBCE_REMOVAL_SCENARIO", () => {
  it("ranges are sane: low ≤ high, both within 0–15pp", () => {
    expect(BBCE_REMOVAL_SCENARIO.structural_per_drop_pct_low).toBeLessThanOrEqual(
      BBCE_REMOVAL_SCENARIO.structural_per_drop_pct_high,
    );
    expect(BBCE_REMOVAL_SCENARIO.structural_per_drop_pct_low).toBeGreaterThan(0);
    expect(BBCE_REMOVAL_SCENARIO.structural_per_drop_pct_high).toBeLessThan(15);
  });

  it("operational gap is a positive USD amount", () => {
    expect(BBCE_REMOVAL_SCENARIO.operational_gap_usd_annual).toBeGreaterThan(0);
  });

  it("carries the explicit provenance marker (catches accidental public use)", () => {
    // If anyone removes the provenance string thinking it's done, the test
    // forces a deliberate replacement with a real citation.
    expect(BBCE_REMOVAL_SCENARIO.provenance).toMatch(/TODO-4-spec/);
    expect(BBCE_REMOVAL_SCENARIO.provenance).toMatch(/citation/i);
  });

  it("counter-argument names BOTH the measurement-frame point and the stacking point", () => {
    const arg = BBCE_REMOVAL_SCENARIO.counter_argument.toLowerCase();
    expect(arg).toMatch(/measurement|frame/);
    expect(arg).toMatch(/stack/);
  });
});

describe("CIVICA_TAM_PROFILE", () => {
  it("national_caseload_share_pct is wage_only + mixed_wage_se + se_only (≈ 27.3%)", () => {
    // Per the comments in error-risk.ts: 22.1 + 0.6 + 4.6 = 27.3.
    expect(CIVICA_TAM_PROFILE.national_caseload_share_pct).toBeCloseTo(27.3, 1);
  });

  it("expected_per_pct matches INCOME_GROUP_PER_FY23.civica_tam (13.95%)", () => {
    expect(CIVICA_TAM_PROFILE.expected_per_pct).toBe(INCOME_GROUP_PER_FY23.civica_tam);
    expect(CIVICA_TAM_PROFILE.expected_per_pct).toBeCloseTo(13.95, 2);
  });

  it("non_earner_per_baseline_pct matches INCOME_GROUP_PER_FY23.no_earned (5.84%)", () => {
    expect(CIVICA_TAM_PROFILE.non_earner_per_baseline_pct).toBe(INCOME_GROUP_PER_FY23.no_earned);
    expect(CIVICA_TAM_PROFILE.non_earner_per_baseline_pct).toBeCloseTo(5.84, 2);
  });

  it("elevation_factor is TAM PER / non-earner PER (≈ 2.4×)", () => {
    expect(CIVICA_TAM_PROFILE.elevation_factor).toBeCloseTo(13.95 / 5.84, 4);
    // Sanity range — must be a meaningful elevation, not noise.
    expect(CIVICA_TAM_PROFILE.elevation_factor).toBeGreaterThan(2);
    expect(CIVICA_TAM_PROFILE.elevation_factor).toBeLessThan(3);
  });

  it("pitch_framing names both PER figures + the elevation claim", () => {
    const framing = CIVICA_TAM_PROFILE.pitch_framing;
    expect(framing).toMatch(/13\.95/);
    expect(framing).toMatch(/5\.84/);
    expect(framing).toMatch(/27/);
  });
});
