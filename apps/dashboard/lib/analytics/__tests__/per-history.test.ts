import { describe, it, expect } from "vitest";
import {
  caStatePerSeries,
  earliestFiscalYear,
  latestFiscalYear,
  nationalAvgSeries,
  perHistory,
} from "../per-history";

describe("per-history", () => {
  it("returns at least one point", () => {
    expect(perHistory().length).toBeGreaterThanOrEqual(1);
  });

  it("entries are in chronological order (FY ascending)", () => {
    const points = perHistory();
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.fy).toBeGreaterThan(points[i - 1]!.fy);
    }
  });

  it("threshold equals 105% of national avg (pre-computed)", () => {
    for (const p of perHistory()) {
      const expected = +(p.nationalTotalPER * 1.05).toFixed(2);
      expect(p.thresholdPER).toBeCloseTo(expected, 2);
    }
  });

  it("earliest + latest match the bounds of perHistory()", () => {
    const points = perHistory();
    expect(earliestFiscalYear()).toBe(points[0]!.fy);
    expect(latestFiscalYear()).toBe(points[points.length - 1]!.fy);
  });

  it("caStatePerSeries matches perHistory length and fy alignment", () => {
    const series = caStatePerSeries();
    const history = perHistory();
    expect(series).toHaveLength(history.length);
    for (let i = 0; i < series.length; i++) {
      expect(series[i]!.fy).toBe(history[i]!.fy);
      expect(series[i]!.per).toBe(history[i]!.caTotalPER);
    }
  });

  it("nationalAvgSeries matches perHistory length and fy alignment", () => {
    const series = nationalAvgSeries();
    const history = perHistory();
    expect(series).toHaveLength(history.length);
    for (let i = 0; i < series.length; i++) {
      expect(series[i]!.fy).toBe(history[i]!.fy);
      expect(series[i]!.per).toBe(history[i]!.nationalTotalPER);
    }
  });

  it("FY2024 captures the verified FNS publication (June 2025)", () => {
    const fy24 = perHistory().find((p) => p.fy === 2024);
    expect(fy24).toBeDefined();
    expect(fy24!.caTotalPER).toBe(10.98);
    expect(fy24!.nationalTotalPER).toBe(10.93);
  });
});
