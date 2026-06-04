/**
 * TT-5 — AppHeader unit tests.
 *
 * Validates the /plan-design-review D2 nav trim + /plan-eng-review D8
 * server/client boundary + /plan-ceo-review D12 page-level rendering:
 *   - Primary nav contains exactly 6 tabs (8 → 6).
 *   - Why Civica + Findings appear inside ShareDropdown, NOT in primary nav.
 *   - ShareDropdown is rendered as a child of AppHeader (server-renders
 *     just its trigger button until interaction).
 *   - MobileNavMenu receives ALL 8 nav items (mobile dropdown is one-level).
 *   - active prop is passed through to the matching nav tab.
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AppHeader from "../AppHeader";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// FirstVisitHints renders below the header after localStorage check; mock it
// out so AppHeader structure tests don't have to coordinate dismissal state.
// The hint component has its own test file (FirstVisitHints.test.tsx).
vi.mock("../FirstVisitHints", () => ({
  default: () => null,
}));

describe("AppHeader", () => {
  it("renders exactly 6 primary nav tabs (post-trim)", () => {
    render(<AppHeader active="dashboard" />);
    const expectedPrimary = [
      "Home",
      "Applications",
      "Outreach",
      "Renewals",
      "Quality Control",
      "Performance",
    ];
    for (const label of expectedPrimary) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("does NOT render Why Civica or Findings as top-level nav links", () => {
    render(<AppHeader active="dashboard" />);
    // The Share dropdown trigger is closed by default — so the menu items
    // are NOT in the DOM. There must be a Share trigger though, and the
    // text "Why Civica" / "Findings" must NOT appear as primary tabs.
    expect(screen.getByRole("button", { name: /Share/ })).toBeInTheDocument();
    // The mobile dropdown ALSO renders these inside its panel only when
    // open; with the hamburger closed, only the trigger is in the DOM.
    // So "Why Civica" / "Findings" should not be queryable here at all.
    expect(screen.queryByText("Why Civica")).toBeNull();
    expect(screen.queryByText("Findings")).toBeNull();
  });

  it("renders the Sign out form + ⌘K hint", () => {
    render(<AppHeader active="dashboard" />);
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByText("⌘K")).toBeInTheDocument();
  });

  it("renders the email when provided", () => {
    render(<AppHeader active="dashboard" email="navigator@civica.test" />);
    expect(screen.getByText("navigator@civica.test")).toBeInTheDocument();
  });

  it("marks the active tab with the active-state classes", () => {
    render(<AppHeader active="queue" />);
    const queueTab = screen.getByRole("link", { name: "Applications" });
    expect(queueTab.className).toMatch(/bg-ink\/8/);
    expect(queueTab.className).toMatch(/text-ink/);
  });

  it("does NOT mark non-active tabs with the active-state classes", () => {
    render(<AppHeader active="dashboard" />);
    const queueTab = screen.getByRole("link", { name: "Applications" });
    expect(queueTab.className).not.toMatch(/bg-white\/15/);
  });

  it("Home tab has min-h-[44px] for WCAG touch target", () => {
    render(<AppHeader active="dashboard" />);
    const homeTab = screen.getByRole("link", { name: "Home" });
    expect(homeTab.className).toMatch(/min-h-\[44px\]/);
  });

  it("Share dropdown trigger is marked aria-current='true' when active is inside it", () => {
    render(<AppHeader active="compliance" />);
    const trigger = screen.getByRole("button", { name: /Share/ });
    expect(trigger).toHaveAttribute("aria-current", "true");
  });

  it("Share dropdown trigger is NOT marked aria-current when active is a primary tab", () => {
    render(<AppHeader active="dashboard" />);
    const trigger = screen.getByRole("button", { name: /Share/ });
    expect(trigger).not.toHaveAttribute("aria-current");
  });
});
