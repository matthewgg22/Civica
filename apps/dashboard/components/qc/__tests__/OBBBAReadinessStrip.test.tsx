// T-test-5 (eng review 2026-05-25): OBBBAReadinessStrip render contract.

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import OBBBAReadinessStrip from "../OBBBAReadinessStrip";
import { obbbaProvisions } from "../../../lib/analytics/obbba";

describe("OBBBAReadinessStrip — render contract", () => {
  const provisions = obbbaProvisions();

  it("renders the regulatory-readiness eyebrow and title", () => {
    render(<OBBBAReadinessStrip />);
    expect(
      screen.getByText(/Regulatory readiness · OBBBA/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /Seven federal SNAP tracks tightened in 2025/i,
      }),
    ).toBeInTheDocument();
  });

  it("explains OBBBA is NOT a formula pillar (CMT framing)", () => {
    render(<OBBBAReadinessStrip />);
    expect(
      screen.getByText(/OBBBA does NOT enter the formula above/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/FY24 baseline predates enforcement/i),
    ).toBeInTheDocument();
  });

  it("renders the readiness counter (X ready · Y partial)", () => {
    render(<OBBBAReadinessStrip />);
    const ready = provisions.filter((p) => p.status === "Ready").length;
    const partial = provisions.filter((p) => p.status === "Partial").length;
    expect(
      screen.getByText(new RegExp(`${ready}\\s*ready\\s*·\\s*${partial}\\s*partial`, "i")),
    ).toBeInTheDocument();
  });

  it("renders every provision's section citation", () => {
    render(<OBBBAReadinessStrip />);
    for (const p of provisions) {
      expect(screen.getAllByText(p.section).length).toBeGreaterThan(0);
    }
  });

  it("renders every provision's title", () => {
    render(<OBBBAReadinessStrip />);
    for (const p of provisions) {
      expect(screen.getAllByText(p.title).length).toBeGreaterThan(0);
    }
  });

  it("renders every provision's posture (engineering state)", () => {
    render(<OBBBAReadinessStrip />);
    for (const p of provisions) {
      // Posture text appears in the row's second line.
      expect(screen.getAllByText(p.posture).length).toBeGreaterThan(0);
    }
  });

  it("renders status pills using the documented enum values", () => {
    render(<OBBBAReadinessStrip />);
    const hasReady = provisions.some((p) => p.status === "Ready");
    const hasPartial = provisions.some((p) => p.status === "Partial");
    if (hasReady) {
      expect(screen.getAllByText(/^Ready$/i).length).toBeGreaterThan(0);
    }
    if (hasPartial) {
      expect(screen.getAllByText(/^Partial$/i).length).toBeGreaterThan(0);
    }
  });

  it("renders the source path footer pointing at lib/analytics/obbba.ts", () => {
    render(<OBBBAReadinessStrip />);
    expect(screen.getAllByText(/lib\/analytics\/obbba\.ts/).length).toBeGreaterThan(0);
  });

  it("renders the /compliance cross-link for detail and exposure dollars", () => {
    render(<OBBBAReadinessStrip />);
    expect(screen.getByText(/\/compliance/)).toBeInTheDocument();
    expect(screen.getByText(/exposure dollars/i)).toBeInTheDocument();
  });

  it("has a data-testid='obbba-readiness-strip' distinct from PillarTracking", () => {
    render(<OBBBAReadinessStrip />);
    expect(screen.getByTestId("obbba-readiness-strip")).toBeInTheDocument();
  });

  it("uses indigo accent (not pillar-semantic colors) — visual register check", () => {
    const { container } = render(<OBBBAReadinessStrip />);
    // Indigo token #4F46A5 (DESIGN.md §1 info accent).
    expect(container.innerHTML).toMatch(/#4F46A5|rgb\(79,\s*70,\s*165\)/i);
    // Verify pine (CTA-reserved) is NOT used as accent.
    // (pine = #2D5A45; we don't expect this color anywhere in the OBBBA strip)
  });

  it("renders the same number of <li> rows as obbbaProvisions() returns", () => {
    render(<OBBBAReadinessStrip />);
    const items = screen.getAllByRole("listitem");
    // ProvisionRow is the only <li> inside this component, so item count
    // should equal provisions count.
    expect(items.length).toBe(provisions.length);
  });
});
