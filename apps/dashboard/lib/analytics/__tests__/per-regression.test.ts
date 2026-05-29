import { describe, it, expect } from "vitest";
import {
  PREREGISTERED_SPEC,
  PREREG_LOCKED_AT,
  getRegressionReport,
  getRegressionArtifact,
  formatPValue,
  significanceStars,
  isSignificant,
  formatSigned,
  formatCI,
  signMatchesHypothesis,
  recoversTruth,
  type TreatmentEstimate,
} from "../per-regression";

// ---------------------------------------------------------------------------
// Parity: the TS pre-registered spec must match the harness artifact exactly.
// This is the contract that lets the Python harness and the dashboard evolve
// independently without silently drifting. If the harness adds/renames/retypes
// a DV without the TS spec following, this fails the build.
// ---------------------------------------------------------------------------

describe("spec ⨝ artifact parity", () => {
  const artifact = getRegressionArtifact();

  it("every pre-registered DV has exactly one matching result model", () => {
    for (const spec of PREREGISTERED_SPEC) {
      const matches = artifact.models.filter((m) => m.dv_key === spec.dvKey);
      expect(matches, `result for ${spec.dvKey}`).toHaveLength(1);
    }
  });

  it("no orphan result models (every JSON model is pre-registered)", () => {
    const specKeys = new Set(PREREGISTERED_SPEC.map((s) => s.dvKey));
    for (const m of artifact.models) {
      expect(specKeys.has(m.dv_key), `orphan result ${m.dv_key}`).toBe(true);
    }
  });

  it("model_family, frame, hypothesized_sign, unit, label all agree", () => {
    for (const spec of PREREGISTERED_SPEC) {
      const m = artifact.models.find((x) => x.dv_key === spec.dvKey)!;
      expect(m.model_family).toBe(spec.modelFamily);
      expect(m.frame).toBe(spec.frame);
      expect(m.hypothesized_sign).toBe(spec.hypothesizedSign);
      expect(m.unit).toBe(spec.unit);
      expect(m.dv_label).toBe(spec.dvLabel);
    }
  });

  it("the prereg lock date matches between TS and the artifact provenance", () => {
    expect(artifact.provenance.prereg_locked_at).toBe(PREREG_LOCKED_AT);
  });
});

// ---------------------------------------------------------------------------
// getRegressionReport — the joined, render-ready view.
// ---------------------------------------------------------------------------

describe("getRegressionReport", () => {
  const report = getRegressionReport();

  it("returns one rendered model per spec entry, in spec order", () => {
    expect(report.models).toHaveLength(PREREGISTERED_SPEC.length);
    report.models.forEach((m, i) => {
      expect(m.spec.dvKey).toBe(PREREGISTERED_SPEC[i].dvKey);
    });
  });

  it("exposes the treatment key and a non-empty control set", () => {
    expect(report.treatmentKey).toBe("civica_assisted");
    expect(report.controls.length).toBeGreaterThan(0);
  });

  it("each rendered model carries derived display fields", () => {
    for (const m of report.models) {
      expect(m.estimateFormatted).toMatch(/^[+−]\d/);
      expect(m.ciFormatted).toMatch(/^\[.*,.*\]$/);
      expect(typeof m.pFormatted).toBe("string");
      expect(["***", "**", "*", "ns"]).toContain(m.stars);
    }
  });

  // The committed synthetic artifact should be internally sane: every planted
  // effect points the pre-registered direction, and the estimator recovers it.
  it("all estimates point the hypothesized direction (directional hits)", () => {
    expect(report.directionalHits).toBe(report.models.length);
  });

  it("the synthetic self-test recovers the planted effect (≥ n-1 of n)", () => {
    const checked = report.models.filter((m) => m.recoversTruth !== null);
    const recovered = checked.filter((m) => m.recoversTruth === true);
    // 5/5 in the committed artifact; allow one borderline miss on reseed.
    expect(checked.length).toBe(report.models.length);
    expect(recovered.length).toBeGreaterThanOrEqual(report.models.length - 1);
  });

  it("synthetic source carries a loud watermark; provenance names statsmodels", () => {
    expect(report.isSynthetic).toBe(true);
    expect(report.sourceKind).toBe("synthetic");
    expect(report.watermark).toBeTruthy();
    expect(report.provenance.environment.statsmodels).toBeTruthy();
    expect(report.provenance.environment.python).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Pure formatting helpers.
// ---------------------------------------------------------------------------

describe("formatPValue", () => {
  it("collapses tiny p-values to < 0.001", () => {
    expect(formatPValue(1e-16)).toBe("< 0.001");
    expect(formatPValue(0.0009)).toBe("< 0.001");
  });
  it("shows 3 decimals for ordinary p-values", () => {
    expect(formatPValue(0.024)).toBe("0.024");
    expect(formatPValue(0.5)).toBe("0.500");
  });
  it("guards non-finite input", () => {
    expect(formatPValue(NaN)).toBe("—");
  });
});

describe("significanceStars", () => {
  it("maps thresholds to stars", () => {
    expect(significanceStars(0.0001)).toBe("***");
    expect(significanceStars(0.005)).toBe("**");
    expect(significanceStars(0.03)).toBe("*");
    expect(significanceStars(0.2)).toBe("ns");
  });
});

describe("isSignificant", () => {
  it("uses alpha = 0.05 by default", () => {
    expect(isSignificant(0.049)).toBe(true);
    expect(isSignificant(0.05)).toBe(false);
    expect(isSignificant(0.2)).toBe(false);
  });
});

describe("formatSigned", () => {
  it("uses a real minus glyph for negatives and + for positives", () => {
    expect(formatSigned(-2.9285, 2)).toBe("−2.93"); // U+2212
    expect(formatSigned(0.888, 2)).toBe("+0.89");
    expect(formatSigned(0, 2)).toBe("+0.00");
  });
  it("guards non-finite input", () => {
    expect(formatSigned(Infinity)).toBe("—");
  });
});

describe("formatCI", () => {
  it("formats a bracketed interval with a real minus glyph", () => {
    expect(formatCI(-3.62, -2.24, 2)).toBe("[−3.62, −2.24]");
    expect(formatCI(0.54, 1.23, 2)).toBe("[0.54, 1.23]");
  });
});

describe("signMatchesHypothesis", () => {
  it("checks negative hypotheses", () => {
    expect(signMatchesHypothesis(-3, "negative")).toBe(true);
    expect(signMatchesHypothesis(3, "negative")).toBe(false);
  });
  it("checks positive hypotheses", () => {
    expect(signMatchesHypothesis(0.8, "positive")).toBe(true);
    expect(signMatchesHypothesis(-0.8, "positive")).toBe(false);
  });
});

describe("recoversTruth", () => {
  const base: TreatmentEstimate = {
    estimate: -2.9,
    std_error: 0.35,
    statistic: -8.3,
    p_value: 1e-16,
    ci_low: -3.62,
    ci_high: -2.24,
    n: 800,
    r2: 0.15,
    pseudo_r2: null,
    true_effect: -3.0,
  };

  it("returns null when there is no planted effect (real data)", () => {
    expect(recoversTruth({ ...base, true_effect: null })).toBeNull();
  });
  it("is true when the CI covers the planted effect", () => {
    expect(recoversTruth(base)).toBe(true);
  });
  it("is false when the CI misses the planted effect", () => {
    expect(recoversTruth({ ...base, true_effect: -5.0 })).toBe(false);
  });
});
