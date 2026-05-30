/**
 * Tests for FirstVisitHints — the E7 nav-trim + T16 ⌘K palette
 * onboarding hints rendered just below AppHeader.
 *
 * Validates:
 *   - SSR-safe pre-hydration render (null until effect runs).
 *   - First-render shows both hints when localStorage is empty.
 *   - Each hint dismisses independently.
 *   - localStorage failure (private browsing) is non-fatal — UI hides
 *     for the session and no exception bubbles.
 */
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import FirstVisitHints from "../FirstVisitHints";

// jsdom 26 + Node 25 don't auto-provide localStorage — set up a
// fresh in-memory implementation per test. Documented in the
// "Node 25 jsdom Storage shadowing" project memory.
function setupLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

describe("FirstVisitHints", () => {
  beforeEach(() => {
    setupLocalStorage();
  });

  it("shows both hints on first visit (empty localStorage)", () => {
    render(<FirstVisitHints />);
    // The Welcome (nav-trim) and Tip (palette) labels both appear.
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Tip")).toBeInTheDocument();
    expect(screen.getByText(/Why Civica/)).toBeInTheDocument();
    expect(screen.getByText(/jump to any packet/)).toBeInTheDocument();
  });

  it("hides the nav-trim hint after it's dismissed", () => {
    render(<FirstVisitHints />);
    fireEvent.click(screen.getByLabelText("Dismiss welcome message"));
    expect(screen.queryByText("Welcome")).toBeNull();
    expect(screen.queryByText(/Why Civica/)).toBeNull();
    // The palette hint should still render
    expect(screen.getByText("Tip")).toBeInTheDocument();
  });

  it("hides the palette hint after it's dismissed", () => {
    render(<FirstVisitHints />);
    fireEvent.click(screen.getByLabelText("Dismiss tip message"));
    expect(screen.queryByText("Tip")).toBeNull();
    expect(screen.queryByText(/jump to any packet/)).toBeNull();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
  });

  it("dismissals persist via localStorage keys", () => {
    render(<FirstVisitHints />);
    fireEvent.click(screen.getByLabelText("Dismiss welcome message"));
    expect(localStorage.getItem("civica:nav-trim-hint-dismissed")).toBe("1");
    expect(localStorage.getItem("civica:palette-hint-dismissed")).toBeNull();

    fireEvent.click(screen.getByLabelText("Dismiss tip message"));
    expect(localStorage.getItem("civica:palette-hint-dismissed")).toBe("1");
  });

  it("renders nothing if both hints were previously dismissed", () => {
    localStorage.setItem("civica:nav-trim-hint-dismissed", "1");
    localStorage.setItem("civica:palette-hint-dismissed", "1");
    const { container } = render(<FirstVisitHints />);
    // After effect runs, component returns null
    expect(container.firstChild).toBeNull();
  });

  it("does not throw when localStorage setItem throws (private browsing)", () => {
    // Replace setItem with a thrower; read-side still works.
    const ls = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        ...ls,
        setItem: () => {
          throw new DOMException("QuotaExceededError", "QuotaExceededError");
        },
      },
    });

    render(<FirstVisitHints />);
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    // Dismiss should not throw even though setItem throws
    expect(() => {
      act(() => {
        fireEvent.click(screen.getByLabelText("Dismiss welcome message"));
      });
    }).not.toThrow();
    // Local state still updates — the welcome banner is hidden for this session
    expect(screen.queryByText("Welcome")).toBeNull();
  });

  it("wraps each hint in a labeled region for screen readers", () => {
    render(<FirstVisitHints />);
    expect(screen.getByRole("region", { name: "Welcome message" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tip message" })).toBeInTheDocument();
  });

  // We don't test the pre-hydration null state directly because vitest+jsdom
  // runs useEffect synchronously after render, so the null state isn't
  // observable from outside. The pattern is the same as FirstVisitCallout
  // and other SSR-safe components in this codebase.
});
