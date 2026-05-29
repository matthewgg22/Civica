import { describe, it, expect } from "vitest";
import { mapTruthPointRows } from "../error-rate-snapshot";

// Raw rows as they arrive from v_error_rate_current — NUMERIC columns come over
// the Supabase wire as strings, so the mapper must coerce them. Four top-line
// rows (slice_dim null) + three sliced rows (one per breakdown family).
const RUN = "2026-05-29T04:00:00Z";
const sampleRows = [
  { computed_at: RUN, engine_version: "0.3.0", metric: "baseline_ca", slice_dim: null, slice_value: null, per_pct: "10.980", ci_low: null, ci_high: null, n: null, fiscal_year: 2024, source: "usda_fns_published", meta: { label: "CA total PER (USDA FNS-380)" } },
  { computed_at: RUN, engine_version: "0.3.0", metric: "projected_full_engagement", slice_dim: null, slice_value: null, per_pct: "5.500", ci_low: null, ci_high: null, n: null, fiscal_year: null, source: "engine_projection", meta: {} },
  { computed_at: RUN, engine_version: "0.3.0", metric: "engagement_implied", slice_dim: null, slice_value: null, per_pct: "10.980", ci_low: null, ci_high: null, n: null, fiscal_year: null, source: "engine_engagement_implied", meta: { total_packets: 0 } },
  { computed_at: RUN, engine_version: "0.3.0", metric: "measured_overall", slice_dim: null, slice_value: null, per_pct: null, ci_low: null, ci_high: null, n: 12, fiscal_year: null, source: "measured_qc_sample", meta: { status: "insufficient_sample", errors: 1 } },
  { computed_at: RUN, engine_version: "0.3.0", metric: "pillar_contribution", slice_dim: "pillar", slice_value: "gig_income", per_pct: "1.453", ci_low: null, ci_high: null, n: null, fiscal_year: null, source: "engine_pillar_attribution", meta: { unit: "reduction_pp" } },
  { computed_at: RUN, engine_version: "0.3.0", metric: "income_group_per", slice_dim: "income_group", slice_value: "civica_tam", per_pct: "13.950", ci_low: null, ci_high: null, n: null, fiscal_year: 2023, source: "usda_income_group", meta: { scope: "national" } },
  { computed_at: RUN, engine_version: "0.3.0", metric: "element_attribution", slice_dim: "element", slice_value: "363", per_pct: "39.940", ci_low: null, ci_high: null, n: null, fiscal_year: 2023, source: "usda_element_share", meta: { label: "Shelter deduction", unit: "share_of_errored_cases_pct" } },
];

describe("mapTruthPointRows", () => {
  it("returns an explicit unavailable shape for empty input", () => {
    const tp = mapTruthPointRows([]);
    expect(tp.available).toBe(false);
    expect(tp.baselineCa).toBeNull();
    expect(tp.measured).toBeNull();
    expect(tp.pillarContributions).toEqual([]);
  });

  it("maps the top-line metrics and coerces NUMERIC strings to numbers", () => {
    const tp = mapTruthPointRows(sampleRows);
    expect(tp.available).toBe(true);
    expect(tp.baselineCa).toBe(10.98);
    expect(tp.projected).toBe(5.5);
    expect(tp.engagementImplied).toBe(10.98);
  });

  it("exposes run-level provenance from the first row", () => {
    const tp = mapTruthPointRows(sampleRows);
    expect(tp.computedAt).toBe(RUN);
    expect(tp.engineVersion).toBe("0.3.0");
  });

  it("preserves the measured row n + null rate below the gate", () => {
    const tp = mapTruthPointRows(sampleRows);
    expect(tp.measured?.n).toBe(12);
    expect(tp.measured?.perPct).toBeNull();
    expect(tp.measured?.meta.status).toBe("insufficient_sample");
  });

  it("byMetric holds ONLY the four top-line metrics (sliced rows excluded)", () => {
    const tp = mapTruthPointRows(sampleRows);
    expect(tp.byMetric.baseline_ca?.fiscalYear).toBe(2024);
    expect(tp.byMetric.baseline_ca?.source).toBe("usda_fns_published");
    expect(Object.keys(tp.byMetric)).toHaveLength(4);
    // sliced metrics must NOT collapse into byMetric
    expect(tp.byMetric.pillar_contribution).toBeUndefined();
  });

  it("groups sliced rows into slices + convenience accessors", () => {
    const tp = mapTruthPointRows(sampleRows);

    expect(tp.pillarContributions).toHaveLength(1);
    expect(tp.pillarContributions[0].sliceDim).toBe("pillar");
    expect(tp.pillarContributions[0].sliceValue).toBe("gig_income");
    expect(tp.pillarContributions[0].perPct).toBe(1.453); // string → number

    expect(tp.incomeGroups[0].sliceValue).toBe("civica_tam");
    expect(tp.incomeGroups[0].perPct).toBe(13.95);

    expect(tp.elements[0].sliceValue).toBe("363");
    expect(tp.elements[0].perPct).toBe(39.94);
    expect(tp.elements[0].meta.unit).toBe("share_of_errored_cases_pct");

    // slices map keyed by metric mirrors the accessors
    expect(tp.slices.element_attribution).toHaveLength(1);
  });
});
