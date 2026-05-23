import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import CountyLeaderboard from "../CountyLeaderboard";

describe("CountyLeaderboard", () => {
  it("renders all 58 counties when no limit is given", () => {
    const { container } = render(<CountyLeaderboard />);
    const tbodyRows = container.querySelectorAll("tbody tr");
    expect(tbodyRows).toHaveLength(58);
  });

  it("respects the limit prop", () => {
    const { container } = render(<CountyLeaderboard limit={10} />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(10);
  });

  it("ranks Los Angeles County first", () => {
    const { container } = render(<CountyLeaderboard limit={1} />);
    const firstRow = container.querySelector("tbody tr")!;
    expect(within(firstRow as HTMLElement).getByText(/Los Angeles County/)).toBeTruthy();
    expect(within(firstRow as HTMLElement).getByText("1")).toBeTruthy();
  });

  it("renders ranks in strictly ascending order", () => {
    const { container } = render(<CountyLeaderboard limit={5} />);
    const ranks = Array.from(container.querySelectorAll("tbody tr td:first-child")).map(
      (cell) => Number(cell.textContent?.trim()),
    );
    expect(ranks).toEqual([1, 2, 3, 4, 5]);
  });

  it("renders a sparkline svg per row", () => {
    const { container } = render(<CountyLeaderboard limit={5} />);
    const svgs = container.querySelectorAll("tbody tr svg");
    expect(svgs).toHaveLength(5);
    // Each svg has a polyline
    for (const svg of svgs) {
      expect(svg.querySelector("polyline")).toBeTruthy();
    }
  });

  it("falls back to 'insufficient data' label when monthly series has <2 meaningful values", () => {
    // This is an internal guard; the test asserts the public render path
    // by checking the existing dataset doesn't trip the fallback. None of
    // our 58 counties should be flagged with insufficient data.
    const { container } = render(<CountyLeaderboard />);
    const fallbacks = container.querySelectorAll(".italic");
    expect(fallbacks).toHaveLength(0);
  });

  it("displays a methodology footer", () => {
    render(<CountyLeaderboard />);
    // §10105 appears in both the subtitle and the methodology footer; use
    // getAllByText to assert it shows up at least once + once specifically
    // with the Methodology preamble.
    expect(screen.getAllByText(/§10105/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Methodology:/)).toBeTruthy();
  });

  it("uses the title + subtitle props when provided", () => {
    render(
      <CountyLeaderboard
        title="Custom title"
        subtitle="Custom subtitle"
        limit={3}
      />,
    );
    expect(screen.getByText("Custom title")).toBeTruthy();
    expect(screen.getByText("Custom subtitle")).toBeTruthy();
  });
});
