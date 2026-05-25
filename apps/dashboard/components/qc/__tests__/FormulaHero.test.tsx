// T-test-2 (eng review 2026-05-25, plan §11): FormulaHero render + edge states.

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FormulaHero from "../FormulaHero";

describe("FormulaHero — render with realistic fixture", () => {
  it("renders the section title + eyebrow", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /How the projected payment-error rate moves with engagement/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Thesis realization · formula and current data/i),
    ).toBeInTheDocument();
  });

  it("renders both halves of the formula (projected + engagement-implied)", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    expect(
      screen.getByText(/Projected · at full stack engagement/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Engagement-implied · at observed coverage today/i),
    ).toBeInTheDocument();
  });

  it("displays CA FY24 baseline (10.98%) prominently", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    expect(screen.getByText(/10\.98%/)).toBeInTheDocument();
  });

  it("displays projected PER ~5.5% at full required engagement (thesis target)", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    // ~5.5% appears in the PROJECTED PER row
    expect(screen.getByText(/~5\.5\d%/)).toBeInTheDocument();
  });

  it("renders the engagement realization gap row with aria-live", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    expect(screen.getByText(/Engagement realization gap/i)).toBeInTheDocument();
    // The gap row should have aria-live="polite" so screen readers re-announce
    // when period switches or coverage changes.
    const gapHeading = screen.getByText(/Engagement realization gap/i);
    const gapRow = gapHeading.closest("tr");
    expect(gapRow).toHaveAttribute("aria-live", "polite");
  });

  it("renders the four pillar labels in both halves", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    const pillarLabels = [
      /Shelter axis/i,
      /Income axis/i,
      /Shared-lease axis/i,
      /Calc engine/i,
    ];
    for (const label of pillarLabels) {
      // Each pillar appears in both halves (top + bottom).
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("renders the residual floor line as an irreducible-floor constant", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    expect(screen.getAllByText(/Residual/i).length).toBeGreaterThanOrEqual(2);
    // Appears in both the projected and engagement-implied halves' rows.
    expect(screen.getAllByText(/irreducible floor/i).length).toBeGreaterThanOrEqual(1);
  });

  it("includes the honest-framing caveat about projection vs measurement", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    expect(
      screen.getByText(/Engagement-implied, not measured/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/n ≥ 30 QC outcomes/i)).toBeInTheDocument();
  });
});

describe("FormulaHero — empty state (n=0 packets)", () => {
  it("renders without crashing when totalPackets is 0", () => {
    render(
      <FormulaHero
        totalPackets={0}
        argyleConnected={0}
        shelterDocCount={0}
        suaAnswered={0}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /How the projected payment-error rate moves with engagement/i,
      }),
    ).toBeInTheDocument();
  });

  it("at n=0 the engagement-implied PER equals the baseline (10.98%)", () => {
    render(
      <FormulaHero
        totalPackets={0}
        argyleConnected={0}
        shelterDocCount={0}
        suaAnswered={0}
      />,
    );
    // The engagement-implied PER total row should show ~10.98% (or the value
    // reduced only by the deterministic calc engine contribution since
    // benefit_impact stays at 1.0 even at n=0).
    // At n=0, observed coverage of utility_sua/gig/lease = 0, but
    // benefit_impact = 1.0 (deterministic). So engagement-implied PER =
    // baseline - pillarContribution(benefit_impact, 1.0) ≈ 10.98 - 0.39 ≈ 10.59%
    const allPercents = screen.getAllByText(/~10\.\d{2}%/);
    expect(allPercents.length).toBeGreaterThanOrEqual(1);
  });

  it("at n=0 the realization gap is widening (positive) and brick-colored", () => {
    render(
      <FormulaHero
        totalPackets={0}
        argyleConnected={0}
        shelterDocCount={0}
        suaAnswered={0}
      />,
    );
    // Gap = engagement-implied (~10.59%) - projected (~5.5%) ≈ +5.09 pts
    // → widening
    expect(screen.getByText(/▲ widening/i)).toBeInTheDocument();
  });
});

describe("FormulaHero — maximum-achievable coverage today (lease pillar UI pending)", () => {
  it("at max-today coverage (income + shelter + calc all 1.0, lease 0), gap is ~flat", () => {
    // All addressable-today pillars at 100% (argyle + shelter docs +
    // SUA flags all match totalPackets). Shared-lease coverage stays 0
    // because the classifier UI is Phase 2.
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={100}
        shelterDocCount={100}
        suaAnswered={100}
      />,
    );
    // Engagement-implied ≈ 5.91% (only lease pillar contribution missing)
    // Projected ≈ 5.50% (lease pillar fully engaged in projection)
    // Gap ≈ +0.41 pts → within ±0.5 → ≈ flat
    expect(screen.getByText(/≈ flat/i)).toBeInTheDocument();
  });
});

describe("FormulaHero — sparse / partial coverage", () => {
  it("at half coverage, gap is widening (observed < max-today)", () => {
    // 50% engagement on income + shelter
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={50}
        shelterDocCount={50}
        suaAnswered={50}
      />,
    );
    expect(screen.getByText(/▲ widening/i)).toBeInTheDocument();
  });
});

describe("FormulaHero — CQ2 defensive boundaries via engine", () => {
  it("clamps absurd inputs predictably (no NaN render, no crashes)", () => {
    render(
      <FormulaHero
        totalPackets={-100}
        argyleConnected={9999}
        shelterDocCount={-50}
        suaAnswered={Number.NaN as unknown as number}
      />,
    );
    // Page renders; no "NaN%" anywhere.
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /How the projected payment-error rate moves with engagement/i,
      }),
    ).toBeInTheDocument();
  });
});
