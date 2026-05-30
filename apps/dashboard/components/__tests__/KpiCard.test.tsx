/**
 * TT-3 — KpiCard unit tests.
 *
 * Validates the unified shared component extracted from three inlined
 * copies (cbo-preview, compliance/county/[slug], cdss) per
 * /plan-design-review T10 + /plan-eng-review note (dead variant cleanup).
 *
 * The pre-extraction copies had dead variants ("positive" + "success")
 * that both rendered identically to "neutral" — these tests pin the
 * narrowed variant union and lock in the warning visual semantics.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import KpiCard from "../KpiCard";

describe("KpiCard", () => {
  it("renders label, value, and subtext", () => {
    render(
      <KpiCard
        label="Active applications"
        value="23"
        subtext="Across 4 navigators"
      />
    );
    expect(screen.getByText("Active applications")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("Across 4 navigators")).toBeInTheDocument();
  });

  it("defaults to neutral variant (ink-colored value, hairline border)", () => {
    render(<KpiCard label="Label" value="42" subtext="Subtext" />);
    const valueEl = screen.getByText("42");
    expect(valueEl).toHaveStyle({ color: "var(--color-ink)" });
  });

  it("uses warning color when variant='warning'", () => {
    render(
      <KpiCard label="Errors" value="12%" subtext="Above threshold" variant="warning" />
    );
    const valueEl = screen.getByText("12%");
    expect(valueEl).toHaveStyle({ color: "var(--color-warning)" });
  });

  it("explicit neutral variant matches default", () => {
    render(<KpiCard label="Total" value="1,240" subtext="this month" variant="neutral" />);
    const valueEl = screen.getByText("1,240");
    expect(valueEl).toHaveStyle({ color: "var(--color-ink)" });
  });

  it("applies warning-tinted border when variant='warning'", () => {
    const { container } = render(
      <KpiCard label="Errors" value="12%" subtext="Above threshold" variant="warning" />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.style.borderColor).toContain("var(--color-warning)");
  });

  it("does NOT apply warning border for neutral variant", () => {
    const { container } = render(
      <KpiCard label="Total" value="42" subtext="ok" variant="neutral" />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.style.borderColor).toBe("");
  });

  it("uses semantic uppercase label styling with AA-safe text-graphite", () => {
    render(<KpiCard label="Label" value="42" subtext="Subtext" />);
    const labelEl = screen.getByText("Label");
    expect(labelEl.className).toMatch(/uppercase/);
    // text-graphite, not text-muted: the label is 11px and text-muted fails
    // WCAG AA at footnote sizes (DESIGN.md §6.6). Swept in the T11 contrast
    // pass (PR6).
    expect(labelEl.className).toMatch(/text-graphite/);
    expect(labelEl.className).not.toMatch(/text-muted/);
    expect(labelEl.className).toMatch(/tracking-wider/);
  });

  it("uses tabular-nums on the numeric value (no width jump on update)", () => {
    render(<KpiCard label="Cohort" value="91.5%" subtext="ok" />);
    const valueEl = screen.getByText("91.5%");
    expect(valueEl.className).toMatch(/tabular-nums/);
  });
});
