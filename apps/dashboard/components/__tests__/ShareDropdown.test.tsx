/**
 * TT-4 — ShareDropdown unit tests.
 *
 * Validates the contract from /plan-eng-review D8 (server-friendly
 * boundary) + /plan-ceo-review Section 2.3 (hydration-safe).
 *
 * Asserts:
 *   - Initial render: button only; menu closed (server/client match).
 *   - Click trigger: menu opens with both items (Why Civica, Findings).
 *   - Outside-click: menu closes.
 *   - Escape key: menu closes.
 *   - active="compliance": trigger marked aria-current; menu item too.
 *   - Click menu item: menu closes.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ShareDropdown from "../ShareDropdown";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
}));

describe("ShareDropdown", () => {
  it("initially renders only the trigger button (menu closed)", () => {
    render(<ShareDropdown />);
    const trigger = screen.getByRole("button", { name: /Share/ });
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens the menu on trigger click", () => {
    render(<ShareDropdown />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Why Civica" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Findings" })).toBeInTheDocument();
  });

  it("closes the menu on Escape key", () => {
    render(<ShareDropdown />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu on outside click", () => {
    render(
      <div>
        <ShareDropdown />
        <button>Outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes the menu after clicking a menu item", () => {
    render(<ShareDropdown />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Why Civica" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("marks trigger with aria-current when active='compliance'", () => {
    render(<ShareDropdown active="compliance" />);
    const trigger = screen.getByRole("button", { name: /Share/ });
    expect(trigger).toHaveAttribute("aria-current", "true");
  });

  it("marks the active menu item with aria-current='page' inside the menu", () => {
    render(<ShareDropdown active="findings" />);
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    const findingsItem = screen.getByRole("menuitem", { name: "Findings" });
    expect(findingsItem).toHaveAttribute("aria-current", "page");
    const complianceItem = screen.getByRole("menuitem", { name: "Why Civica" });
    expect(complianceItem).not.toHaveAttribute("aria-current");
  });

  it("does NOT mark trigger as active when active is not a Share item", () => {
    render(<ShareDropdown active="dashboard" />);
    expect(screen.getByRole("button", { name: /Share/ })).not.toHaveAttribute("aria-current");
  });

  it("trigger has min-h-[44px] for WCAG touch target", () => {
    render(<ShareDropdown />);
    const trigger = screen.getByRole("button", { name: /Share/ });
    expect(trigger.className).toMatch(/min-h-\[44px\]/);
  });
});
