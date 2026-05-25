// T10 — formal accessibility contract for /qc components.
//
// Locks specific a11y contracts so they can't regress silently:
//   - FormulaHero: aria-live on gap row, aria-label on the 32px number
//   - PillarTracking: role=img + descriptive aria-label on every bar
//   - OBBBAReadinessStrip: role=status on shipping-status pills, <li>
//     aria-label summarizes each track for screen reader scanning
//   - IncomingDataFeed: role=radiogroup with aria-label, role=radio chips
//
// These contracts are also asserted by per-component tests; this file is
// a cross-cutting smoke check that targets the contracts directly.

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import FormulaHero from "../FormulaHero";
import PillarTracking from "../PillarTracking";
import OBBBAReadinessStrip from "../OBBBAReadinessStrip";
import IncomingDataFeed, { type FeedPacket } from "../IncomingDataFeed";

const SAMPLE_PACKETS: FeedPacket[] = [
  {
    packetId: "abc12345",
    applicantInitials: "AB",
    daysPending: 5,
    engagement: {
      income: true,
      shelter: false,
      suaFlags: true,
      obbbaImpactTagged: true,
    },
  },
];

describe("FormulaHero — a11y contract", () => {
  it("section is labelled by its <h3> title", () => {
    const { container } = render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    const section = container.querySelector(
      "section[aria-labelledby='formula-hero-title']",
    );
    expect(section).not.toBeNull();
    expect(document.getElementById("formula-hero-title")).not.toBeNull();
  });

  it("table carries an aria-label + visually-hidden caption", () => {
    const { container } = render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    const table = container.querySelector("table");
    expect(table).toHaveAttribute("aria-label");
    expect(
      container.querySelector("caption.sr-only"),
    ).not.toBeNull();
  });

  it("gap row is aria-live polite + aria-atomic for change announcements", () => {
    render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    const gapHeading = screen.getByText(/Engagement realization gap/i);
    const gapRow = gapHeading.closest("tr");
    expect(gapRow).toHaveAttribute("aria-live", "polite");
    expect(gapRow).toHaveAttribute("aria-atomic", "true");
  });

  it("gap value cell has descriptive aria-label (not raw '+0.41 pts')", () => {
    const { container } = render(
      <FormulaHero
        totalPackets={100}
        argyleConnected={100}
        shelterDocCount={100}
        suaAnswered={100}
      />,
    );
    const gapCell = container.querySelector(
      "td[aria-label*='Engagement realization gap']",
    );
    expect(gapCell).not.toBeNull();
    expect(gapCell?.getAttribute("aria-label")).toMatch(/percentage points/i);
  });

  it("trend arrow glyph is aria-hidden (the aria-label conveys the trend)", () => {
    const { container } = render(
      <FormulaHero
        totalPackets={0}
        argyleConnected={0}
        shelterDocCount={0}
        suaAnswered={0}
      />,
    );
    // The "▲ widening" cell is aria-hidden because the gap-cell aria-label
    // already announces "widening" — avoids duplicate readout.
    const arrowCell = container.querySelector("td[aria-hidden='true']");
    expect(arrowCell).not.toBeNull();
    expect(arrowCell?.textContent).toMatch(/widening|narrowing|flat/i);
  });
});

describe("PillarTracking — a11y contract", () => {
  it("section is labelled by its <h3> title", () => {
    const { container } = render(
      <PillarTracking
        totalPackets={100}
        argyleConnected={40}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    const section = container.querySelector(
      "section[aria-labelledby='pillar-tracking-title']",
    );
    expect(section).not.toBeNull();
  });

  it("every progress bar has role=img + descriptive aria-label with percent", () => {
    const { container } = render(
      <PillarTracking
        totalPackets={100}
        argyleConnected={42}
        shelterDocCount={30}
        suaAnswered={50}
      />,
    );
    const bars = container.querySelectorAll('[role="img"]');
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of Array.from(bars)) {
      const label = bar.getAttribute("aria-label");
      expect(label).toMatch(/percent/i);
    }
  });
});

describe("OBBBAReadinessStrip — a11y contract", () => {
  it("section is labelled by its <h3> title", () => {
    const { container } = render(<OBBBAReadinessStrip />);
    const section = container.querySelector(
      "section[aria-labelledby='obbba-strip-title']",
    );
    expect(section).not.toBeNull();
  });

  it("status pills carry role=status with descriptive aria-label", () => {
    const { container } = render(<OBBBAReadinessStrip />);
    const statusPills = container.querySelectorAll('[role="status"]');
    expect(statusPills.length).toBeGreaterThan(0);
    for (const pill of Array.from(statusPills)) {
      const label = pill.getAttribute("aria-label");
      expect(label).toMatch(/Shipping status:/i);
    }
  });

  it("each track <li> has summary aria-label for sr-line-scan", () => {
    const { container } = render(<OBBBAReadinessStrip />);
    const items = container.querySelectorAll("li[aria-label]");
    expect(items.length).toBeGreaterThan(0);
    for (const li of Array.from(items)) {
      const label = li.getAttribute("aria-label");
      expect(label).toMatch(/OBBBA track/i);
      expect(label).toMatch(/Status/i);
    }
  });
});

describe("IncomingDataFeed — a11y contract", () => {
  it("filter chips form a role=radiogroup with aria-label", () => {
    render(<IncomingDataFeed packets={SAMPLE_PACKETS} />);
    const group = screen.getByRole("radiogroup", {
      name: /Filter packets by engagement/i,
    });
    expect(group).toBeInTheDocument();
  });

  it("engagement pills carry aria-labels distinguishing engaged vs missing", () => {
    const { container } = render(
      <IncomingDataFeed packets={SAMPLE_PACKETS} />,
    );
    const inc = container.querySelector('[aria-label="Inc: engaged"]');
    const shl = container.querySelector('[aria-label="Shl: missing"]');
    expect(inc).not.toBeNull();
    expect(shl).not.toBeNull();
  });

  it("drill-in link has aria-label naming the target packet", () => {
    render(<IncomingDataFeed packets={SAMPLE_PACKETS} />);
    const link = screen.getByRole("link", {
      name: /Open packet abc12345/i,
    });
    expect(link).toHaveAttribute("href", "/packets/abc12345");
  });
});
