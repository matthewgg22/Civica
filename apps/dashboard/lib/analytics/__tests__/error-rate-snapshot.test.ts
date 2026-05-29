import { describe, it, expect } from "vitest";
import { mapTruthPointRows } from "../error-rate-snapshot";

// Raw rows as they arrive from v_error_rate_current — NUMERIC columns come over
// the Supabase wire as strings, so the mapper must coerce them.
const RUN = "2026-05-29T04:00:00Z";
const sampleRows = [
  { computed_at: RUN, engine_version: "0.3.0", metric: "baseline_ca", per_pct: "10.980", ci_low: null, ci_high: null, n: null, fiscal_year: 2024, source: "usda_fns_published", meta: { label: "CA total PER (USDA FNS-380)" } },
  { computed_at: RUN, engine_version: "0.3.0", metric: "projected_full_engagement", per_pct: "5.500", ci_low: null, ci_high: null, n: null, fiscal_year: null, source: "engine_projection", meta: {} },
  { computed_at: RUN, engine_version: "0.3.0", metric: "engagement_implied", per_pct: "10.980", ci_low: null, ci_high: null, n: null, fiscal_year: null, source: "engine_engagement_implied", meta: { total_packets: 0 } },
  { computed_at: RUN, engine_version: "0.3.0", metric: "measured_overall", per_pct: null, ci_low: null, ci_high: null, n: 12, fiscal_year: null, source: "measured_qc_sample", meta: { status: "insufficient_sample", errors: 1 } },
];

describe("mapTruthPointRows", () => {
  it("returns an explicit unavailable shape for empty input", () => {
    const tp = mapTruthPointRows([]);
    expect(tp.available).toBe(false);
    expect(tp.baselineCa).toBeNull();
    expect(tp.measured).toBeNull();
  });

  it("maps the four metrics and coerces NUMERIC strings to numbers", () => {
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

  it("keys every metric in byMetric with its fiscal year + source", () => {
    const tp = mapTruthPointRows(sampleRows);
    expect(tp.byMetric.baseline_ca?.fiscalYear).toBe(2024);
    expect(tp.byMetric.baseline_ca?.source).toBe("usda_fns_published");
    expect(Object.keys(tp.byMetric)).toHaveLength(4);
  });
});
