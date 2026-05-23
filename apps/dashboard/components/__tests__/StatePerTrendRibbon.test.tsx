import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatePerTrendRibbon from "../StatePerTrendRibbon";
import { perHistory } from "../../lib/analytics/per-history";

describe("StatePerTrendRibbon", () => {
  const points = perHistory();
  const latest = points[points.length - 1]!;
  const earliest = points[0]!;

  it("renders without crashing", () => {
    const { container } = render(<StatePerTrendRibbon />);
    expect(container.firstChild).toBeTruthy();
  });

  it("shows the eyebrow with the earliest FY framing", () => {
    render(<StatePerTrendRibbon />);
    expect(
      screen.getByText(new RegExp(`Statewide PER trend.*FY${earliest.fy}`, "i")),
    ).toBeTruthy();
  });

  it("shows the latest-FY CA value", () => {
    const { container } = render(<StatePerTrendRibbon />);
    // The CA value renders as a big tabular-nums number in the CA column.
    // It will also appear in the §10105 threshold callout sentence — so we
    // assert at least one match rather than uniqueness.
    const caValueMatches = screen.getAllByText(
      new RegExp(`${latest.caTotalPER}%`),
    );
    expect(caValueMatches.length).toBeGreaterThanOrEqual(1);
    // And we can locate the California column by its label.
    expect(within(container).getByText("California")).toBeTruthy();
  });

  it("shows the latest-FY national value", () => {
    render(<StatePerTrendRibbon />);
    expect(screen.getByText("National average")).toBeTruthy();
    const natValueMatches = screen.getAllByText(
      new RegExp(`${latest.nationalTotalPER}%`),
    );
    expect(natValueMatches.length).toBeGreaterThanOrEqual(1);
  });

  it("shows the §10105 threshold (105% × latest national)", () => {
    render(<StatePerTrendRibbon />);
    const expected = +(latest.nationalTotalPER * 1.05).toFixed(2);
    // Threshold appears in the callout: "= {thresholdPER}%"
    expect(
      screen.getByText(
        new RegExp(`§10105 threshold.*${expected}%`),
      ),
    ).toBeTruthy();
  });

  it("renders two SVG elements (one per series)", () => {
    const { container } = render(<StatePerTrendRibbon />);
    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    // Each svg has a polyline (the series) + a dashed line (the threshold)
    for (const svg of svgs) {
      expect(svg.querySelector("polyline")).toBeTruthy();
      expect(svg.querySelector("line")).toBeTruthy();
    }
  });

  it("renders the methodology footnote", () => {
    render(<StatePerTrendRibbon />);
    expect(
      screen.getByText(
        /USDA FNS official QC payment error rate publications/i,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/FY2020.*FY2021 excluded.*COVID-19/i),
    ).toBeTruthy();
  });

  it("attaches aria-label to each SVG with slope direction", () => {
    const { container } = render(<StatePerTrendRibbon />);
    const svgs = container.querySelectorAll("svg[role='img']");
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      const label = svg.getAttribute("aria-label") ?? "";
      expect(label).toMatch(/total Payment Error Rate/);
      expect(label).toMatch(/(increasing|decreasing|flat)/);
      expect(label).toMatch(/FY\d{4}/);
    }
  });
});
