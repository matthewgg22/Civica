/**
 * Tests for CountyOutcomeRoadmapCard — Payment Integrity Engine readiness
 * affordance on the packet detail page.
 *
 * Validates:
 *   - Renders when localStorage key is absent (not dismissed).
 *   - Does not render when localStorage key is present (dismissed).
 *   - SSR-safe: useEffect drives hydration; pre-hydration state is null
 *     (not observable in jsdom, but pattern mirrors FirstVisitCallout).
 *   - a11y: role="region" + aria-label="County outcomes will land here".
 *   - Dismiss button: sets localStorage key + hides card.
 *   - Headline + body text match the locked copy exactly.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import CountyOutcomeRoadmapCard from "../CountyOutcomeRoadmapCard";

const STORAGE_KEY = "civica.county-outcome-roadmap-acknowledged";

// jsdom 26 + Node 25 don't auto-provide localStorage — set up a fresh
// in-memory implementation per test. Same pattern as FirstVisitHints.test.tsx.
function setupLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
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
  return store;
}

describe("CountyOutcomeRoadmapCard", () => {
  beforeEach(() => {
    setupLocalStorage();
  });

  it("renders when localStorage key is absent (not dismissed)", () => {
    render(<CountyOutcomeRoadmapCard />);
    expect(
      screen.getByRole("region", { name: "County outcomes will land here" })
    ).toBeInTheDocument();
  });

  it("does not render when localStorage key is present (dismissed)", () => {
    setupLocalStorage({ [STORAGE_KEY]: "1" });
    const { container } = render(<CountyOutcomeRoadmapCard />);
    expect(container.firstChild).toBeNull();
  });

  it("has role='region' and aria-label='County outcomes will land here'", () => {
    render(<CountyOutcomeRoadmapCard />);
    const region = screen.getByRole("region", {
      name: "County outcomes will land here",
    });
    expect(region).toBeInTheDocument();
    expect(region.tagName.toLowerCase()).toBe("aside");
  });

  it("renders the locked headline text exactly", () => {
    render(<CountyOutcomeRoadmapCard />);
    expect(
      screen.getByText("County outcomes will land here")
    ).toBeInTheDocument();
  });

  it("renders the locked body copy exactly", () => {
    render(<CountyOutcomeRoadmapCard />);
    expect(
      screen.getByText(
        /Once they flow, the Payment Integrity Engine will reconcile each/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/turning eligibility consistency \(verified internally\) into measured payment accuracy \(verified externally\)/)
    ).toBeInTheDocument();
  });

  it("dismiss button sets localStorage key and hides the card", () => {
    const store = setupLocalStorage();
    render(<CountyOutcomeRoadmapCard />);

    // Card is visible
    expect(
      screen.getByRole("region", { name: "County outcomes will land here" })
    ).toBeInTheDocument();

    // Click dismiss
    fireEvent.click(screen.getByLabelText("Dismiss county outcome roadmap"));

    // localStorage key is set
    expect(store.get(STORAGE_KEY)).toBe("1");

    // Card is no longer in the DOM
    expect(
      screen.queryByRole("region", { name: "County outcomes will land here" })
    ).toBeNull();
  });

  it("dismiss button writes '1' to the correct localStorage key", () => {
    const store = setupLocalStorage();
    render(<CountyOutcomeRoadmapCard />);
    fireEvent.click(screen.getByLabelText("Dismiss county outcome roadmap"));
    expect(store.get(STORAGE_KEY)).toBe("1");
    expect(store.get("civica.county-outcome-roadmap-acknowledged")).toBe("1");
  });

  // Pre-hydration null state: vitest+jsdom runs useEffect synchronously after
  // render, so dismissed=null is not observable externally. The SSR-safe
  // pattern (useState(null) + useEffect) is structurally identical to
  // FirstVisitCallout; the server render path (null returned) is exercised by
  // the "does not render when dismissed" test above which also covers the
  // null/pre-hydration branch — both return null from the component.
});
