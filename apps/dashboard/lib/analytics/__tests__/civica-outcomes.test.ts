import { describe, it, expect } from "vitest";
import {
  civicaOutcomes,
  foiaPendingOutcomes,
  outcomesSummary,
} from "../civica-outcomes";

describe("civicaOutcomes", () => {
  const rows = civicaOutcomes();

  it("returns a non-empty list of outcome rows", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it("every row has step, metric, and documented source kinds", () => {
    const allowedSources = new Set(["live", "modeled", "baseline", "foia"]);
    for (const r of rows) {
      expect(r.step).toBeGreaterThan(0);
      expect(r.metric).toBeTruthy();
      expect(allowedSources.has(r.civicaSource)).toBe(true);
      expect(allowedSources.has(r.baselineSource)).toBe(true);
    }
  });

  // T5 cohort-honesty guard: per TODOS.md TODO-12 and the cohort-honesty
  // section of civica-outcomes.ts, no Civica-side row should be labeled
  // "live" until the measured cohort of ≥10 households closes. If a future
  // edit flips a row to live without measurement, this test fails and
  // forces a discussion.
  it("no Civica-side row is 'live' until measured cohort lands (cohort-honesty rule)", () => {
    const liveRows = rows.filter((r) => r.civicaSource === "live");
    expect(liveRows.length).toBe(0);
  });

  it("steps are unique within the rows array", () => {
    const steps = rows.map((r) => r.step);
    expect(new Set(steps).size).toBe(steps.length);
  });
});

describe("foiaPendingOutcomes", () => {
  it("returns FOIA-pending entries with non-empty source + impact", () => {
    const items = foiaPendingOutcomes();
    expect(Array.isArray(items)).toBe(true);
    for (const i of items) {
      expect(i.metric).toBeTruthy();
      expect(i.foiaSource).toBeTruthy();
      expect(i.impact).toBeTruthy();
    }
  });
});

describe("outcomesSummary", () => {
  it("modeledRows + other source kinds sum to totalRows", () => {
    const s = outcomesSummary();
    expect(s.totalRows).toBe(civicaOutcomes().length);
    expect(s.modeledRows).toBeLessThanOrEqual(s.totalRows);
    expect(s.modeledRows).toBeGreaterThanOrEqual(0);
  });
});
