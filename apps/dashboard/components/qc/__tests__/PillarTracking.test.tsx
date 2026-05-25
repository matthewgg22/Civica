// T-test-3 (eng review 2026-05-25): PillarTracking render + edge states.

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PillarTracking from "../PillarTracking";

describe("PillarTracking — render with realistic fixture", () => {
  const props = {
    totalPackets: 100,
    argyleConnected: 40,
    shelterDocCount: 30,
    suaAnswered: 50,
  };

  it("renders the section title + eyebrow", () => {
    render(<PillarTracking {...props} />);
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /Where each pillar sits today vs full engagement/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pillar tracking · per-axis adoption against thesis target/i),
    ).toBeInTheDocument();
  });

  it("renders all four pillars: Shelter, Income, Shared-lease, Calc", () => {
    render(<PillarTracking {...props} />);
    expect(screen.getByText(/^Shelter axis$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Income axis$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Shared-lease axis$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Calc engine$/i)).toBeInTheDocument();
  });

  it("renders the tool name for each pillar", () => {
    render(<PillarTracking {...props} />);
    expect(screen.getByText(/SUA engine \+ lease OCR/i)).toBeInTheDocument();
    expect(screen.getByText(/Argyle payroll wire/i)).toBeInTheDocument();
    expect(screen.getByText(/Sublease classifier \(UI pending\)/i)).toBeInTheDocument();
    expect(screen.getByText(/CDSS deterministic rules/i)).toBeInTheDocument();
  });

  it("renders PER contribution at full engagement for each pillar", () => {
    render(<PillarTracking {...props} />);
    // "PER contribution at full engagement" appears at least 4 times (once
    // per pillar) plus possibly section-level prose.
    expect(
      screen.getAllByText(/PER contribution at full engagement/i).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("renders shared-lease as Phase 2 dormant (no observed bar, badge instead)", () => {
    render(<PillarTracking {...props} />);
    expect(screen.getByText(/^Phase 2$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Pillar dormant in current build/i),
    ).toBeInTheDocument();
  });

  it("renders bottleneck + lever for shipped pillars (not for calc which has —)", () => {
    render(<PillarTracking {...props} />);
    // Bottleneck appears for 3 pillars (shelter, income, shared-lease); calc has —
    const bottleneckLabels = screen.getAllByText(/^Bottleneck$/);
    expect(bottleneckLabels.length).toBe(3);
    const leverLabels = screen.getAllByText(/^Lever$/);
    expect(leverLabels.length).toBe(3);
  });

  it("renders the residual footer with irreducible floor framing", () => {
    render(<PillarTracking {...props} />);
    // "Residual" appears as a label/eyebrow at minimum.
    expect(screen.getAllByText(/Residual/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/irreducible floor/i)).toBeInTheDocument();
    expect(screen.getByText(/structurally outside Civica/i)).toBeInTheDocument();
  });

  it("renders USDA weight + max shift footnote for each non-dormant pillar", () => {
    render(<PillarTracking {...props} />);
    // 3 shipped + non-zero-shift pillars (shelter, income, calc) — shared_lease
    // is dormant so doesn't render the realization row.
    const footnotes = screen.getAllByText(/USDA weight.*max shift/);
    expect(footnotes.length).toBe(3);
  });
});

describe("PillarTracking — n=0 empty state", () => {
  it("renders without crashing when totalPackets is 0", () => {
    render(
      <PillarTracking
        totalPackets={0}
        argyleConnected={0}
        shelterDocCount={0}
        suaAnswered={0}
      />,
    );
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /Where each pillar sits today vs full engagement/i,
      }),
    ).toBeInTheDocument();
  });

  it("observed engagement is 0% for shipped pillars at n=0", () => {
    render(
      <PillarTracking
        totalPackets={0}
        argyleConnected={0}
        shelterDocCount={0}
        suaAnswered={0}
      />,
    );
    // At n=0, observed = 0 for shelter + income. Calc engine is always 100%.
    // The 0% appears multiple times for both observed-engagement labels.
    expect(screen.getAllByText(/^0%$/).length).toBeGreaterThanOrEqual(2);
  });
});

describe("PillarTracking — accessibility contract", () => {
  it("each observed-engagement bar has role=img with descriptive aria-label", () => {
    const { container } = render(
      <PillarTracking
        totalPackets={100}
        argyleConnected={42}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    const bars = container.querySelectorAll('[role="img"]');
    // 3 shipped non-zero-shift pillars × 2 bars each (target + observed)
    // = 6 bars total.
    expect(bars.length).toBe(6);
    // At least one bar should reference "Observed engagement" in its label.
    const labels = Array.from(bars).map((b) => b.getAttribute("aria-label"));
    expect(labels.some((l) => l && /Observed engagement/i.test(l))).toBe(true);
    expect(labels.some((l) => l && /Target engagement/i.test(l))).toBe(true);
  });
});

describe("PillarTracking — color-coding by realization tier", () => {
  it("at very low observed engagement, color is brick (large gap)", () => {
    const { container } = render(
      <PillarTracking
        totalPackets={100}
        argyleConnected={5}
        shelterDocCount={5}
        suaAnswered={5}
      />,
    );
    // Brick color = #9C3A24 should appear in the rendered output.
    expect(container.innerHTML).toMatch(/#9C3A24|rgb\(156,\s*58,\s*36\)/i);
  });

  it("at high observed engagement, color is teal (at target)", () => {
    const { container } = render(
      <PillarTracking
        totalPackets={100}
        argyleConnected={95}
        shelterDocCount={95}
        suaAnswered={95}
      />,
    );
    // Teal color = #2A6F66 for shelter + income pillars at >=90% realization.
    expect(container.innerHTML).toMatch(/#2A6F66|rgb\(42,\s*111,\s*102\)/i);
  });
});
