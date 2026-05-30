import { describe, it, expect } from "vitest";
import {
  getPolicyRegressionReport,
  getPolicyRegressionArtifact,
  hypothesizedPositive,
  formatPct,
  formatPctCI,
} from "../policy-regression";

// ---------------------------------------------------------------------------
// Loader shape + provenance.
// ---------------------------------------------------------------------------

describe("policy-regression artifact", () => {
  const a = getPolicyRegressionArtifact();

  it("is real public-panel data, not synthetic/foia", () => {
    expect(a.source_kind).toBe("public_panel");
  });

  it("covers the full national panel", () => {
    expect(a.panel.states).toBe(51);
    expect(a.panel.period).toBe("1996-01..2020-12");
    expect(a.twfe.n).toBeGreaterThan(10000);
  });
});

// ---------------------------------------------------------------------------
// The headline result — this is a regression guard on the finding's central
// claim. If a re-run flips a burden-reducer's sign or significance, this
// fails loudly rather than letting the page quietly contradict the finding.
// ---------------------------------------------------------------------------

describe("burden-reducing levers raise participation", () => {
  const r = getPolicyRegressionReport();

  it("simplified reporting, BBCE, and call centers are all significant and positive", () => {
    for (const key of ["reportsimple", "bbce", "call_any"]) {
      const l = r.levers.find((x) => x.key === key)!;
      expect(l, key).toBeDefined();
      expect(l.estimate_pct, `${key} sign`).toBeGreaterThan(0);
      expect(l.significant, `${key} significance`).toBe(true);
      expect(l.directionMatches, `${key} matches hypothesis`).toBe(true);
    }
  });

  it("at least three burden/eligibility levers are significant positives", () => {
    expect(r.significantPositiveLevers).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Event study — flat pre-trends (parallel-trends check), rising post-path.
// ---------------------------------------------------------------------------

describe("BBCE event study", () => {
  const r = getPolicyRegressionReport();
  const pt = (label: string) =>
    r.eventStudy.points.find((p) => p.year_label === label)!;

  it("the year-before pre-trend is not significant (parallel trends hold)", () => {
    expect(pt("-2").significant).toBe(false);
  });

  it("post-adoption effects are significant and monotonically increasing", () => {
    const p1 = pt("+1");
    const p2 = pt("+2");
    const p3 = pt("+3+");
    expect(p1.significant && p2.significant && p3.significant).toBe(true);
    expect(p2.estimate_pct).toBeGreaterThan(p1.estimate_pct);
    expect(p3.estimate_pct).toBeGreaterThan(p2.estimate_pct);
  });

  it("uses never-adopters as controls", () => {
    expect(r.eventStudy.neverAdopterStates).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Formatters.
// ---------------------------------------------------------------------------

describe("formatters", () => {
  it("formatPct uses a real minus glyph and a percent sign", () => {
    expect(formatPct(8.9)).toBe("+8.9%");
    expect(formatPct(-4.02)).toBe("−4.0%");
  });

  it("formatPctCI brackets both bounds", () => {
    expect(formatPctCI(3.3, 14.5)).toBe("[+3.3%, +14.5%]");
  });

  it("hypothesizedPositive flips only for burden-increasing levers", () => {
    expect(hypothesizedPositive("reduces_burden")).toBe(true);
    expect(hypothesizedPositive("expands_eligibility")).toBe(true);
    expect(hypothesizedPositive("increases_burden")).toBe(false);
  });
});
