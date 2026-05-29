import { describe, it, expect } from "vitest";
import {
  buildErrorRateSnapshot,
  MEASURED_MIN_N,
  CA_BASELINE_PER,
  CA_BASELINE_FISCAL_YEAR,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  ENGINE_VERSION,
  type PillarCoverage,
  type ErrorRateSnapshotInputs,
} from "../src/index";

const ZERO_COVERAGE: PillarCoverage = {
  utility_sua: 0,
  gig_income: 0,
  shared_lease: 0,
  assets: 0,
  benefit_impact: 0,
};

const FULL_COVERAGE: PillarCoverage = {
  utility_sua: 1,
  gig_income: 1,
  shared_lease: 1,
  assets: 1,
  benefit_impact: 1,
};

function inputs(over: Partial<ErrorRateSnapshotInputs> = {}): ErrorRateSnapshotInputs {
  return {
    coverage: ZERO_COVERAGE,
    totalPackets: 0,
    measured: { n: 0, errors: 0 },
    ...over,
  };
}

describe("buildErrorRateSnapshot — shape", () => {
  it("returns the four top-line metrics (slice_dim null), in order", () => {
    const rows = buildErrorRateSnapshot(inputs());
    const topline = rows.filter((r) => r.slice_dim === null);
    expect(topline.map((r) => r.metric)).toEqual([
      "baseline_ca",
      "projected_full_engagement",
      "engagement_implied",
      "measured_overall",
    ]);
  });

  it("stamps engine_version on every row (provenance)", () => {
    const rows = buildErrorRateSnapshot(inputs());
    for (const r of rows) expect(r.engine_version).toBe(ENGINE_VERSION);
  });
});

describe("buildErrorRateSnapshot — fixed metrics from the engine", () => {
  it("baseline_ca mirrors the engine constant + carries the fiscal year + published source", () => {
    const baseline = buildErrorRateSnapshot(inputs()).find((r) => r.metric === "baseline_ca")!;
    expect(baseline.per_pct).toBe(CA_BASELINE_PER);
    expect(baseline.fiscal_year).toBe(CA_BASELINE_FISCAL_YEAR);
    expect(baseline.source).toBe("usda_fns_published");
  });

  it("projected_full_engagement mirrors the engine projection", () => {
    const projected = buildErrorRateSnapshot(inputs()).find(
      (r) => r.metric === "projected_full_engagement",
    )!;
    expect(projected.per_pct).toBe(PROJECTED_PER_AT_FULL_ENGAGEMENT);
    expect(projected.source).toBe("engine_projection");
  });
});

describe("buildErrorRateSnapshot — engagement-implied tracks coverage", () => {
  it("equals the baseline at zero coverage (no reduction earned)", () => {
    const row = buildErrorRateSnapshot(inputs({ coverage: ZERO_COVERAGE })).find(
      (r) => r.metric === "engagement_implied",
    )!;
    expect(row.per_pct).toBeCloseTo(CA_BASELINE_PER, 2);
    expect(row.source).toBe("engine_engagement_implied");
  });

  it("equals the full-engagement projection at full coverage", () => {
    const row = buildErrorRateSnapshot(inputs({ coverage: FULL_COVERAGE })).find(
      (r) => r.metric === "engagement_implied",
    )!;
    expect(row.per_pct).toBeCloseTo(PROJECTED_PER_AT_FULL_ENGAGEMENT, 2);
  });

  it("lands strictly between projection and baseline at partial coverage", () => {
    const partial: PillarCoverage = { ...ZERO_COVERAGE, gig_income: 0.5, utility_sua: 0.5 };
    const row = buildErrorRateSnapshot(inputs({ coverage: partial })).find(
      (r) => r.metric === "engagement_implied",
    )!;
    expect(row.per_pct!).toBeGreaterThan(PROJECTED_PER_AT_FULL_ENGAGEMENT);
    expect(row.per_pct!).toBeLessThan(CA_BASELINE_PER);
  });

  it("carries the coverage + total packets in meta (provenance)", () => {
    const row = buildErrorRateSnapshot(inputs({ coverage: FULL_COVERAGE, totalPackets: 42 })).find(
      (r) => r.metric === "engagement_implied",
    )!;
    expect(row.meta.total_packets).toBe(42);
    expect(row.meta.coverage).toEqual(FULL_COVERAGE);
  });
});

describe("buildErrorRateSnapshot — measured is n-gated", () => {
  it("below the min-N gate: no rate, carries n + insufficient_sample status", () => {
    const row = buildErrorRateSnapshot(
      inputs({ measured: { n: MEASURED_MIN_N - 1, errors: 3 } }),
    ).find((r) => r.metric === "measured_overall")!;
    expect(row.per_pct).toBeNull();
    expect(row.ci_low).toBeNull();
    expect(row.ci_high).toBeNull();
    expect(row.n).toBe(MEASURED_MIN_N - 1);
    expect(row.meta.status).toBe("insufficient_sample");
    expect(row.meta.errors).toBe(3);
  });

  it("at/above the gate: point estimate + Wilson band in percentage points", () => {
    const row = buildErrorRateSnapshot(
      inputs({ measured: { n: 50, errors: 5 } }),
    ).find((r) => r.metric === "measured_overall")!;
    expect(row.per_pct).toBeCloseTo(10, 3); // 5/50 = 10%
    expect(row.n).toBe(50);
    expect(row.meta.status).toBe("measured");
    // Wilson band brackets the point estimate and stays within [0, 100].
    expect(row.ci_low!).toBeGreaterThanOrEqual(0);
    expect(row.ci_high!).toBeLessThanOrEqual(100);
    expect(row.ci_low!).toBeLessThan(row.per_pct!);
    expect(row.ci_high!).toBeGreaterThan(row.per_pct!);
  });

  it("honors a custom measuredMinN override", () => {
    const row = buildErrorRateSnapshot(
      inputs({ measured: { n: 10, errors: 1 }, measuredMinN: 5 }),
    ).find((r) => r.metric === "measured_overall")!;
    expect(row.per_pct).toBeCloseTo(10, 3);
    expect(row.meta.min_n).toBe(5);
  });
});

describe("buildErrorRateSnapshot — sliced depth", () => {
  it("emits one pillar_contribution row per pillar (slice_dim 'pillar')", () => {
    const pillars = buildErrorRateSnapshot(inputs()).filter((r) => r.metric === "pillar_contribution");
    expect(pillars).toHaveLength(5);
    for (const r of pillars) {
      expect(r.slice_dim).toBe("pillar");
      expect(r.source).toBe("engine_pillar_attribution");
      expect(r.slice_value).toBeTruthy();
    }
    expect(pillars.map((r) => r.slice_value)).toContain("utility_sua");
  });

  it("pillar contributions are 0 at zero coverage and sum to ~(baseline−projected) at full", () => {
    const zero = buildErrorRateSnapshot(inputs({ coverage: ZERO_COVERAGE })).filter(
      (r) => r.metric === "pillar_contribution",
    );
    for (const r of zero) expect(r.per_pct).toBe(0);

    const full = buildErrorRateSnapshot(inputs({ coverage: FULL_COVERAGE })).filter(
      (r) => r.metric === "pillar_contribution",
    );
    const sum = full.reduce((a, r) => a + (r.per_pct ?? 0), 0);
    expect(sum).toBeCloseTo(CA_BASELINE_PER - PROJECTED_PER_AT_FULL_ENGAGEMENT, 1);
  });

  it("emits income-group PER cohorts incl. the earned-income TAM figure", () => {
    const groups = buildErrorRateSnapshot(inputs()).filter((r) => r.metric === "income_group_per");
    expect(groups.length).toBeGreaterThanOrEqual(4);
    const tam = groups.find((r) => r.slice_value === "civica_tam");
    expect(tam?.per_pct).toBe(13.95);
    for (const r of groups) {
      expect(r.slice_dim).toBe("income_group");
      expect(r.source).toBe("usda_income_group");
    }
  });

  it("emits USDA element attribution incl. shelter as the top share", () => {
    const elements = buildErrorRateSnapshot(inputs()).filter((r) => r.metric === "element_attribution");
    expect(elements.length).toBeGreaterThanOrEqual(10);
    const shelter = elements.find((r) => r.slice_value === "363");
    expect(shelter?.per_pct).toBe(39.94);
    expect(shelter?.meta.label).toBe("Shelter deduction");
    for (const r of elements) {
      expect(r.slice_dim).toBe("element");
      expect(r.source).toBe("usda_element_share");
      expect(r.meta.unit).toBe("share_of_errored_cases_pct");
    }
  });

  it("every sliced row keeps n/ci null (aggregate, not measured)", () => {
    const sliced = buildErrorRateSnapshot(inputs()).filter((r) => r.slice_dim !== null);
    expect(sliced.length).toBeGreaterThan(0);
    for (const r of sliced) {
      expect(r.n).toBeNull();
      expect(r.ci_low).toBeNull();
      expect(r.ci_high).toBeNull();
    }
  });
});

describe("buildErrorRateSnapshot — determinism (the anti-drift guarantee)", () => {
  it("two runs over identical inputs return identical rows", () => {
    const args = inputs({ coverage: FULL_COVERAGE, totalPackets: 100, measured: { n: 40, errors: 4 } });
    expect(buildErrorRateSnapshot(args)).toEqual(buildErrorRateSnapshot(args));
  });
});
