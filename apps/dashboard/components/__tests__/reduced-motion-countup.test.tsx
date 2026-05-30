/**
 * Regression: count-up components must respect prefers-reduced-motion.
 *
 * /design-review (live render) caught that ImpactCounter (the CIVICA IMPACT
 * band on /dashboard) and ops/CountUp both animated 0 → target via
 * requestAnimationFrame with no reduced-motion guard. Motion-opt-out users got
 * an unwanted animation, and the band opened on a literal "0" for the
 * animation's duration.
 *
 * These tests pin the guard: when (prefers-reduced-motion: reduce) matches, the
 * final value renders immediately, with no animation frame.
 */
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImpactCounter from "../ImpactCounter";
import { CountUp } from "../ops/CountUp";

function setReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("count-up — prefers-reduced-motion", () => {
  it("ImpactCounter shows the final families value immediately (no 0-frame) under reduced motion", () => {
    setReducedMotion(true);
    render(<ImpactCounter enrolledPackets={42982} />);
    // Families Enrolled renders the exact target, not a mid-animation 0.
    expect(screen.getByText("42,982")).toBeInTheDocument();
  });

  it("ops CountUp shows the final formatted value immediately under reduced motion", () => {
    setReducedMotion(true);
    render(<CountUp target={3412} format="count-full" />);
    expect(screen.getByText("3,412")).toBeInTheDocument();
  });
});
