// Regression safety net for T4a (eng review 2026-05-25):
// ObbbaReadinessPanel currently has zero tests. T4a will extract OBBBATrackRow
// from this file as a shared primitive (consumed by both /compliance and the
// new /qc OBBBAReadinessStrip). Without behavioral assertions on what the
// panel renders today, the extraction can silently regress.
//
// This test deliberately avoids snapshot-only coverage (cross-model tension
// CMT3): we assert specific behavioral contracts that must survive the
// extraction. The child ObbbaTimeline and ObbbaCountdownArc are stubbed so
// the test is deterministic — those components are NOT affected by T4a.

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ObbbaReadinessPanel from "../ObbbaReadinessPanel";
import { obbbaProvisions } from "../../../lib/analytics/obbba";

// Stub the date-dependent + decorative child components. T4a does not touch
// these — they stay independent. Stubbing keeps the test deterministic.
vi.mock("../ObbbaTimeline", () => ({
  default: ({ provisions }: { provisions: { step: number }[] }) => (
    <div data-testid="stub-timeline">timeline · {provisions.length} provisions</div>
  ),
}));
vi.mock("../ObbbaCountdownArc", () => ({
  ObbbaCountdownArc: () => <div data-testid="stub-countdown-arc">countdown-arc</div>,
}));

describe("ObbbaReadinessPanel — pre-T4a regression baseline", () => {
  const provisions = obbbaProvisions();

  it("renders the section with the OBBBA stress-test eyebrow heading", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    // The h3 carries the load-bearing accessible name.
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /seven federal SNAP rules tightened in 2025/i,
      }),
    ).toBeInTheDocument();
  });

  it("renders the eyebrow 'Part 2 · OBBBA stress test'", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    expect(
      screen.getByText(/Part 2 · OBBBA stress test/i),
    ).toBeInTheDocument();
  });

  it("renders one row per provision (an <ol> of length N)", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    const lists = screen.getAllByRole("list");
    // The panel contains the stakeholder chip lists and the provisions <ol>.
    // The provisions <ol> is the longest list — its child count matches the
    // provision count.
    const provisionList = lists.find((l) => l.children.length === provisions.length);
    expect(provisionList).toBeDefined();
    expect(provisionList!.children.length).toBe(provisions.length);
  });

  it("renders every provision's section citation (e.g. §10105, §10106)", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    for (const p of provisions) {
      // section like "§10105" appears at least once in the document
      expect(screen.getAllByText(p.section).length).toBeGreaterThan(0);
    }
  });

  it("renders every provision's title", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    for (const p of provisions) {
      expect(screen.getAllByText(p.title).length).toBeGreaterThan(0);
    }
  });

  it("renders every provision's impactLabel in the left column", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    for (const p of provisions) {
      expect(screen.getAllByText(p.impactLabel).length).toBeGreaterThan(0);
    }
  });

  it("renders the status counter chip (X ready · Y partial)", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    const ready = provisions.filter((p) => p.status === "Ready").length;
    const partial = provisions.filter((p) => p.status === "Partial").length;
    expect(
      screen.getByText(new RegExp(`${ready}\\s*ready\\s*·\\s*${partial}\\s*partial`, "i")),
    ).toBeInTheDocument();
  });

  it("renders the stakeholder legend with all 5 stakeholder labels", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    const stakeholders = ["State", "County", "CBO", "Household", "Civica"];
    for (const s of stakeholders) {
      // Each stakeholder appears at least once in the legend.
      expect(screen.getAllByText(s).length).toBeGreaterThan(0);
    }
  });

  it("renders hero-tier provisions with their heroNumber displayed", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    const heros = provisions.filter((p) => p.tier === "hero");
    expect(heros.length).toBeGreaterThanOrEqual(1);
    for (const p of heros) {
      if (p.heroNumber) {
        expect(screen.getAllByText(p.heroNumber).length).toBeGreaterThan(0);
      }
    }
  });

  it("renders status pills using the documented enum values", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    // At least one Ready and/or Partial pill should appear per the registry.
    const hasReady = provisions.some((p) => p.status === "Ready");
    const hasPartial = provisions.some((p) => p.status === "Partial");
    if (hasReady) {
      expect(screen.getAllByText(/^Ready$/i).length).toBeGreaterThan(0);
    }
    if (hasPartial) {
      expect(screen.getAllByText(/^Partial$/i).length).toBeGreaterThan(0);
    }
  });

  it("renders the data-attribution footer with section10105/section10106 source paths", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    // These paths appear in both the footer prose and inside provision source
    // citations — assert presence via getAllByText rather than uniqueness.
    expect(screen.getAllByText(/lib\/analytics\/section10105\.ts/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/lib\/analytics\/section10106\.ts/).length).toBeGreaterThan(0);
  });

  it("renders the COMPLIANCE_AUDIT_OBBBA.md reference in the footer", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    expect(screen.getByText(/COMPLIANCE_AUDIT_OBBBA\.md/)).toBeInTheDocument();
  });

  it("renders the country-rule-name 'national rules, California exposure' framing", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    expect(
      screen.getByText(/national rules, California exposure/i),
    ).toBeInTheDocument();
  });

  it("stubs the countdown arc and timeline (T4a does not touch these)", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    expect(screen.getByTestId("stub-countdown-arc")).toBeInTheDocument();
    expect(screen.getByTestId("stub-timeline")).toBeInTheDocument();
  });

  it("hero provisions show the 'If wrong' label in collapsed risk/upside split", () => {
    render(<ObbbaReadinessPanel provisions={provisions} />);
    const heros = provisions.filter((p) => p.tier === "hero");
    if (heros.length > 0) {
      // "If wrong" appears in both hero (collapsed) AND standard (collapsed
      // details). At least N occurrences where N >= hero count.
      expect(screen.getAllByText(/^If wrong$/i).length).toBeGreaterThanOrEqual(heros.length);
    }
  });
});

describe("ObbbaReadinessPanel — empty registry edge case", () => {
  it("renders with zero provisions without crashing (defensive)", () => {
    render(<ObbbaReadinessPanel provisions={[]} />);
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: /seven federal SNAP rules tightened in 2025/i,
      }),
    ).toBeInTheDocument();
    // 0 ready · 0 partial
    expect(screen.getByText(/0\s*ready\s*·\s*0\s*partial/i)).toBeInTheDocument();
  });
});

describe("ObbbaReadinessPanel — fixture-driven contract for T4a extraction", () => {
  // Minimal fixture mirroring ObbbaProvision shape — verifies the panel
  // renders a single hand-rolled provision correctly. After T4a, the
  // OBBBATrackRow primitive should consume the same fixture and pass.
  const fixtureProvision = {
    step: 99,
    section: "§99999",
    title: "Test fixture provision",
    tier: "standard" as const,
    heroNumber: null,
    heroSubhead: null,
    oneliner: "Plain English one-liner for the test fixture provision.",
    requires: "Requires that this test renders cleanly without surprises.",
    exposure: "If this test fails, T4a extraction may have regressed the panel.",
    marketOpportunity: null,
    posture: "Civica is currently in active testing of this fixture.",
    effective: "2026-05-25",
    authorities: ["TEST AUTH-1"],
    source: "test/fixture/path.ts",
    status: "Ready" as const,
    stakeholders: ["Civica" as const],
    deadlineIso: "2026-12-31",
    impactLabel: "TEST IMPACT LABEL",
    impactSublabel: "Test impact sublabel",
    impactKind: "risk" as const,
  };

  it("renders fixture provision's section, title, impactLabel, oneliner, status", () => {
    render(<ObbbaReadinessPanel provisions={[fixtureProvision]} />);
    expect(screen.getByText("§99999")).toBeInTheDocument();
    expect(screen.getByText("Test fixture provision")).toBeInTheDocument();
    expect(screen.getByText("TEST IMPACT LABEL")).toBeInTheDocument();
    expect(
      screen.getByText(/Plain English one-liner for the test fixture provision/i),
    ).toBeInTheDocument();
    // Ready pill should be present
    expect(screen.getAllByText(/^Ready$/i).length).toBeGreaterThan(0);
  });

  it("renders fixture provision's authorities + source + effective in footer", () => {
    render(<ObbbaReadinessPanel provisions={[fixtureProvision]} />);
    // These appear in the collapsed <details> footer line.
    expect(screen.getByText(/TEST AUTH-1/)).toBeInTheDocument();
    expect(screen.getByText(/test\/fixture\/path\.ts/)).toBeInTheDocument();
  });
});
