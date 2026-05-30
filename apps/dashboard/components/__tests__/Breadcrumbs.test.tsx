/**
 * TT-2 — Breadcrumbs unit tests.
 *
 * Validates the contract from /plan-eng-review D4 + /plan-ceo-review
 * Section 4 Finding 4.1:
 *   - Empty items array renders nothing (not an empty <nav>).
 *   - Last item is unlinked even when href is provided.
 *   - ARIA nav landmark present + aria-current="page" on last item.
 *   - Long labels truncate (max-w + truncate utility).
 *   - Separators (›) are aria-hidden so screen readers don't read them.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Breadcrumbs from "../Breadcrumbs";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { vi } from "vitest";

describe("Breadcrumbs", () => {
  it("renders nothing when items is empty", () => {
    const { container } = render(<Breadcrumbs items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders an ARIA nav landmark", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Applications", href: "/packets" },
          { label: "#ABC123" },
        ]}
      />
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("links non-last items, leaves last item unlinked", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Applications", href: "/packets" },
          { label: "#ABC123", href: "/packets/abc123" },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Applications" })).toHaveAttribute("href", "/packets");
    // Last item: must NOT render as a link even though href was provided
    expect(screen.queryByRole("link", { name: "#ABC123" })).toBeNull();
  });

  it("marks last item with aria-current='page'", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Findings", href: "/findings" },
          { label: "Error-rate evidence" },
        ]}
      />
    );
    expect(screen.getByText("Error-rate evidence")).toHaveAttribute("aria-current", "page");
  });

  it("does NOT mark non-last items with aria-current", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Applications", href: "/packets" },
          { label: "#ABC123" },
        ]}
      />
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Applications" })).not.toHaveAttribute("aria-current");
  });

  it("hides separator chevrons from screen readers", () => {
    const { container } = render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "#ABC123" },
        ]}
      />
    );
    // The separator span is aria-hidden; there's one between every consecutive pair.
    const separators = container.querySelectorAll('[aria-hidden="true"]');
    expect(separators.length).toBeGreaterThan(0);
  });

  it("truncates long labels (truncate utility + max-w)", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "An extremely long applicant name that exceeds forty characters in length" },
        ]}
      />
    );
    const longLabel = screen.getByText(
      "An extremely long applicant name that exceeds forty characters in length"
    );
    expect(longLabel.className).toMatch(/truncate/);
    expect(longLabel.className).toMatch(/max-w-/);
  });
});
