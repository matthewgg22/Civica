import { describe, it, expect } from "vitest";
import type { PER, PERTrend, ScenarioRow } from "@civica/analytics-engine";
import {
  transformPerByStateToExposure,
  findScenarioMetric,
  transformPerTrendToView,
  safeAnalyticsCall,
} from "../lib/analytics/transforms";

const perFixture: PER[] = [
  { state_code: "CA", state_name: "California", fiscal_year: 2024, per_total: 10.98 },
  { state_code: "MA", state_name: "Massachusetts", fiscal_year: 2024, per_total: 9.1 },
  { state_code: "TX", state_name: "Texas", fiscal_year: 2024, per_total: 8.0 },
  { state_code: "NY", state_name: "New York", fiscal_year: 2024, per_total: 7.0 },
];

describe("transformPerByStateToExposure", () => {
  it("derives statewide / national-avg / threshold for the target state", () => {
    const view = transformPerByStateToExposure(perFixture, "CA");
    expect(view).not.toBeNull();
    expect(view!.stateCode).toBe("CA");
    expect(view!.statewidePER).toBe(10.98);
    // mean(10.98, 9.1, 8.0, 7.0) = 8.77
    expect(view!.nationalAvgPER).toBeCloseTo(8.77, 2);
    // threshold = 8.77 * 1.05 = 9.2085 → 9.21
    expect(view!.thresholdPER).toBeCloseTo(9.21, 2);
    expect(view!.aboveThreshold).toBe(true);
    // 10.98 - 8.77 = 2.21 → rounded to 2.2
    expect(view!.excessPP).toBeCloseTo(2.2, 1);
  });

  it("is case-insensitive on stateCode lookup", () => {
    const view = transformPerByStateToExposure(perFixture, "ca");
    expect(view).not.toBeNull();
    expect(view!.stateCode).toBe("CA");
  });

  it("returns null when the target state is not in the rowset", () => {
    expect(transformPerByStateToExposure(perFixture, "ZZ")).toBeNull();
  });

  it("returns null on empty input", () => {
    expect(transformPerByStateToExposure([], "CA")).toBeNull();
  });

  it("flags aboveThreshold=false for a state below the cliff", () => {
    const view = transformPerByStateToExposure(perFixture, "NY");
    expect(view!.aboveThreshold).toBe(false);
  });
});

describe("findScenarioMetric", () => {
  const scenarioFixture: ScenarioRow[] = [
    { scenario: "obbba_full", metric: "ca_fy28_state_liability_usd", value: 1_720_000_000 },
    { scenario: "current_law", metric: "ca_fy28_state_liability_usd", value: 0 },
    { scenario: "obbba_full", metric: "ca_fy28_admin_cost_shift_usd", value: 580_000_000 },
  ];

  it("returns the matching (scenario, metric) row", () => {
    const hit = findScenarioMetric(
      scenarioFixture,
      "obbba_full",
      "ca_fy28_state_liability_usd",
    );
    expect(hit).toEqual({
      scenario: "obbba_full",
      metric: "ca_fy28_state_liability_usd",
      value: 1_720_000_000,
    });
  });

  it("returns null when scenario+metric is missing", () => {
    expect(
      findScenarioMetric(scenarioFixture, "obbba_full", "nonexistent_metric"),
    ).toBeNull();
    expect(
      findScenarioMetric(scenarioFixture, "obbba_with_bbce_removal", "ca_fy28_state_liability_usd"),
    ).toBeNull();
  });
});

describe("transformPerTrendToView", () => {
  it("derives latest FY + delta direction", () => {
    const trend: PERTrend[] = [
      { state_code: "CA", state_name: "California", fiscal_year: 2023, per_total: 9.85 },
      {
        state_code: "CA",
        state_name: "California",
        fiscal_year: 2024,
        per_total: 10.98,
        trend_delta: 1.13,
      },
    ];
    const view = transformPerTrendToView(trend);
    expect(view).not.toBeNull();
    expect(view!.latestFY).toBe(2024);
    expect(view!.latestPER).toBe(10.98);
    expect(view!.delta).toBeCloseTo(1.13, 2);
    expect(view!.direction).toBe("up");
  });

  it("returns null on empty trend", () => {
    expect(transformPerTrendToView([])).toBeNull();
  });

  it("marks first-FY-only series as direction=none", () => {
    const trend: PERTrend[] = [
      { state_code: "CA", state_name: "California", fiscal_year: 2024, per_total: 10.98 },
    ];
    const view = transformPerTrendToView(trend);
    expect(view!.direction).toBe("none");
    expect(view!.delta).toBeNull();
  });
});

describe("safeAnalyticsCall", () => {
  it("returns the resolved value on success", async () => {
    const result = await safeAnalyticsCall(async () => 42, "ok");
    expect(result).toBe(42);
  });

  it("swallows thrown errors and returns null", async () => {
    const result = await safeAnalyticsCall(async () => {
      throw new Error("engine offline");
    }, "fail");
    expect(result).toBeNull();
  });
});
