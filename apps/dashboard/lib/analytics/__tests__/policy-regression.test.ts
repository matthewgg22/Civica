import { describe, it, expect } from "vitest";
import {
  getPolicyRegressionReport,
  getPolicyRegressionArtifact,
  hypothesizedPositive,
  formatPct,
  formatPctCI,
} from "../policy-regression";

// ---------------------------------------------------------------------------
// schema 2.1: adds the business-cycle (unemployment) control as Model S1 —
// the first R² rung and a control in the parsimonious + robustness specs.
// ---------------------------------------------------------------------------

describe("policy-regression artifact (schema 2.x)", () => {
  const a = getPolicyRegressionArtifact();
  it("is real public-panel data with the wider lever set", () => {
    expect(a.source_kind).toBe("public_panel");
    expect(a.schema_version.startsWith("2.")).toBe(true);
    expect(a.panel.states).toBe(51);
    expect(a.panel.n_levers).toBeGreaterThanOrEqual(12);
  });
});

// ---------------------------------------------------------------------------
// R² ladder — business cycle first, then each policy family.
// ---------------------------------------------------------------------------

describe("R² ladder (with the cycle rung)", () => {
  const r = getPolicyRegressionReport();
  const byKey = (k: string) => r.r2Ladder.outcomes.find((o) => o.key === k)!;

  it("has four cumulative rungs starting with the business cycle", () => {
    expect(r.r2Ladder.cumulative).toHaveLength(4);
    expect(r.r2Ladder.cumulative[0]).toMatch(/cycle/i);
    expect(byKey("participation").within_r2).toHaveLength(4);
  });

  it("the business cycle alone captures a large share (>0.2)", () => {
    expect(byKey("participation").within_r2[0]).toBeGreaterThan(0.2);
  });

  it("participation within-R² rises monotonically across rungs to >0.5", () => {
    const w = byKey("participation").within_r2;
    expect(w[1]).toBeGreaterThan(w[0]);
    expect(w[2]).toBeGreaterThan(w[1]);
    expect(w[3]).toBeGreaterThan(w[2]);
    expect(w[3]).toBeGreaterThan(0.5);
  });

  it("transaction-cost is the largest POLICY jump (ΔTxn > ΔProc)", () => {
    const w = byKey("participation").within_r2; // [cycle,+elig,+txn,+proc]
    expect(w[2] - w[1]).toBeGreaterThan(w[3] - w[2]);
  });

  it("state policy explains ≈0 of average benefit per person", () => {
    expect(Math.abs(byKey("avg_benefit").within_r2[3])).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// Parsimonious coefficients + the cycle control.
// ---------------------------------------------------------------------------

describe("parsimonious coefficients (cycle-controlled)", () => {
  const r = getPolicyRegressionReport();
  const oc = (k: string) => r.parsimonious.outcomes.find((o) => o.key === k)!;
  const lv = (ok: string, k: string) => oc(ok).levers.find((l) => l.key === k)!;

  it("unemployment is a significant control (counter-cyclical)", () => {
    const u = lv("participation", "unemployment");
    expect(u.kind).toBe("control");
    expect(u.significant).toBe(true);
    expect(u.estimate_pct).toBeGreaterThan(0);
  });

  it("burden-reducers (simplified reporting, call centers) survive the cycle control", () => {
    for (const k of ["reportsimple", "call_any"]) {
      expect(lv("participation", k).estimate_pct, k).toBeGreaterThan(0);
      expect(lv("participation", k).significant, k).toBe(true);
    }
    expect(r.significantPositiveLevers).toBeGreaterThanOrEqual(2);
  });

  it("BBCE (eligibility expansion) attenuates once the cycle is controlled", () => {
    // still positive, but no longer significant for participation —
    // it was partly confounded with the recession it was adopted during.
    const b = lv("participation", "bbce");
    expect(b.estimate_pct).toBeGreaterThan(0);
    expect(b.significant).toBe(false);
  });

  it("no POLICY lever moves average benefit per person", () => {
    for (const l of oc("avg_benefit").levers.filter((x) => x.kind !== "control")) {
      expect(Math.abs(l.estimate_pct), l.key).toBeLessThan(1);
      expect(l.significant, l.key).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Robustness + event study.
// ---------------------------------------------------------------------------

describe("robustness + event study", () => {
  const r = getPolicyRegressionReport();

  it("simplified reporting survives BOTH the cycle control and state trends", () => {
    expect(r.robustness.levers.find((l) => l.key === "reportsimple")!.significant).toBe(true);
  });

  it("BBCE event study: flat pre-trend, rising significant post-path", () => {
    const pt = (label: string) => r.eventStudy.points.find((p) => p.year_label === label)!;
    expect(pt("-2").significant).toBe(false);
    expect(pt("+1").significant && pt("+3+").significant).toBe(true);
    expect(pt("+3+").estimate_pct).toBeGreaterThan(pt("+1").estimate_pct);
  });
});

// ---------------------------------------------------------------------------
// Formatters.
// ---------------------------------------------------------------------------

describe("formatters", () => {
  it("formatPct uses a real minus glyph + percent sign", () => {
    expect(formatPct(8.9)).toBe("+8.9%");
    expect(formatPct(-4.02)).toBe("−4.0%");
  });
  it("formatPctCI brackets both bounds", () => {
    expect(formatPctCI(3.3, 14.5)).toBe("[+3.3%, +14.5%]");
  });
  it("hypothesizedPositive is true for burden/eligibility, false for control", () => {
    expect(hypothesizedPositive("reduces_burden")).toBe(true);
    expect(hypothesizedPositive("expands_eligibility")).toBe(true);
    expect(hypothesizedPositive("increases_burden")).toBe(false);
    expect(hypothesizedPositive("control")).toBe(false);
  });
});
