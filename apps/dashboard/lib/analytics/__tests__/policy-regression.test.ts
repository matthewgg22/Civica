import { describe, it, expect } from "vitest";
import {
  getPolicyRegressionReport,
  getPolicyRegressionArtifact,
  hypothesizedPositive,
  formatPct,
  formatPctCI,
} from "../policy-regression";

// ---------------------------------------------------------------------------
// Loader shape + panel coverage.
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
// The R² ladder — what each policy family captures. Regression guard on the
// finding's central decomposition.
// ---------------------------------------------------------------------------

describe("R² ladder", () => {
  const r = getPolicyRegressionReport();
  const byKey = (k: string) => r.r2Ladder.outcomes.find((o) => o.key === k)!;

  it("has three cumulative steps across the policy families", () => {
    expect(r.r2Ladder.cumulative).toHaveLength(3);
    expect(byKey("participation").within_r2).toHaveLength(3);
  });

  it("participation within-R² rises as families are added", () => {
    const w = byKey("participation").within_r2;
    expect(w[1]).toBeGreaterThan(w[0]);
    expect(w[2]).toBeGreaterThan(w[1]);
    expect(w[2]).toBeGreaterThan(0.4);
  });

  it("transaction-cost adds the largest jump for participation", () => {
    const w = byKey("participation").within_r2;
    expect(w[1] - w[0]).toBeGreaterThan(w[2] - w[1]); // ΔTxn > ΔProc
  });

  it("state policy explains ≈0 of average benefit per person (federally set)", () => {
    expect(Math.abs(byKey("avg_benefit").within_r2[2])).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// Parsimonious coefficients — the headline, guarded across outcomes.
// ---------------------------------------------------------------------------

describe("parsimonious coefficients", () => {
  const r = getPolicyRegressionReport();
  const oc = (k: string) => r.parsimonious.outcomes.find((o) => o.key === k)!;

  it("BBCE, simplified reporting, call centers raise participation (sig, +)", () => {
    const lv = (k: string) => oc("participation").levers.find((l) => l.key === k)!;
    for (const k of ["bbce", "reportsimple", "call_any"]) {
      expect(lv(k).estimate_pct, k).toBeGreaterThan(0);
      expect(lv(k).significant, k).toBe(true);
    }
    expect(r.significantPositiveLevers).toBeGreaterThanOrEqual(3);
  });

  it("caseload (households) responds like participation", () => {
    const bbce = oc("households").levers.find((l) => l.key === "bbce")!;
    expect(bbce.estimate_pct).toBeGreaterThan(0);
    expect(bbce.significant).toBe(true);
  });

  it("no lever moves average benefit per person", () => {
    for (const l of oc("avg_benefit").levers) {
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

  it("BBCE and simplified reporting survive state-specific trends", () => {
    const lv = (k: string) => r.robustness.levers.find((l) => l.key === k)!;
    expect(lv("bbce").significant).toBe(true);
    expect(lv("reportsimple").significant).toBe(true);
  });

  it("BBCE event study: flat pre-trend, rising significant post-path", () => {
    const pt = (label: string) =>
      r.eventStudy.points.find((p) => p.year_label === label)!;
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
  it("hypothesizedPositive flips only for burden-increasing levers", () => {
    expect(hypothesizedPositive("reduces_burden")).toBe(true);
    expect(hypothesizedPositive("increases_burden")).toBe(false);
  });
});
