/**
 * Regression: every staff dashboard page must expose exactly one <h1>
 * (the page title) and level its section headings as <h2> — no missing
 * top-level heading, no h1->h3 skip. Live /design-review (FINDING-002)
 * caught pages opening at <h2> with section <h3>s and zero <h1> on the
 * rendered outline.
 *
 * Covers: /dashboard, /packets, /ops, /qc, /outreach/network, /pilot.
 *
 * Lint-as-test: reads source and asserts on the heading tags, matching the
 * existing color-tokens / contrast regression pattern in this suite.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

describe("heading hierarchy — /dashboard a11y outline", () => {
  it("dashboard page title is an <h1>, not <h2>", () => {
    const src = read("app/dashboard/page.tsx");
    expect(src).toMatch(
      /<h1 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
    expect(src).not.toMatch(
      /<h2 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
  });

  it("dashboard section titles are <h2>, never <h3> (no h1->h3 skip)", () => {
    const sections = read("components/dashboard/sections.tsx");
    const qc = read("components/QCOutcomesPanel.tsx");
    expect(sections).not.toMatch(/<h3 className="section-title"/);
    expect(qc).not.toMatch(/<h3 className="section-title"/);
    expect(sections).toMatch(/<h2 className="section-title"/);
    expect(qc).toMatch(/<h2 className="section-title"/);
  });

  it("packets page title is an <h1>, not <h2>", () => {
    const src = read("app/packets/page.tsx");
    expect(src).toMatch(
      /<h1 className="text-\[26px\] font-semibold tracking-tight leading-tight text-ink">/
    );
    expect(src).not.toMatch(
      /<h2 className="text-\[26px\] font-semibold tracking-tight leading-tight text-ink">/
    );
  });
});

describe("heading hierarchy — /ops a11y outline", () => {
  it("ops page title is an <h1>, not <h2>", () => {
    const src = read("app/ops/page.tsx");
    expect(src).toMatch(
      /<h1 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
    expect(src).not.toMatch(
      /<h2 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
  });

  it("ops section panel titles are <h2>, never <h3> (no h1->h3 skip)", () => {
    // Every panel rendered on /ops carries its section title at the same
    // utility-class size; none may keep the pre-fix <h3>.
    const panels = [
      "CohortRetentionPanel",
      "DistressOverlayPanel",
      "EBTBalancePanel",
      "EligibilityQueuePanel",
      "LTVPanel",
      "MedicareAdvantagePanel",
      "NotificationOutlayPanel",
      "PartnerPnLPanel",
      "PlacementMapPanel",
      "RevenueLinesPanel",
      "TTFDPanel",
    ];
    for (const name of panels) {
      const src = read(`components/ops/${name}.tsx`);
      expect(src).not.toMatch(
        /<h3 className="text-\[18px\] font-bold tracking-tight text-ink"/
      );
      expect(src).toMatch(
        /<h2 className="text-\[18px\] font-bold tracking-tight text-ink"/
      );
    }
  });
});

describe("heading hierarchy — /qc a11y outline", () => {
  it("qc page title is an <h1>, not <h2>", () => {
    const src = read("app/qc/page.tsx");
    expect(src).toMatch(
      /<h1 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
    expect(src).not.toMatch(
      /<h2 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
  });

  it("qc section titles are <h2>, never <h3> (no h1->h3 skip)", () => {
    // Each section component carries exactly one heading (the section title).
    const sections = [
      "FormulaHero",
      "PillarTracking",
      "OBBBAReadinessStrip",
      "IncomingDataFeed",
      "BaselinePanel",
      "SliceErrorRates",
    ];
    for (const name of sections) {
      const src = read(`components/qc/${name}.tsx`);
      expect(src).not.toMatch(/<h3[\s>]/);
      expect(src).toMatch(/<h2[\s>]/);
    }
  });
});

describe("heading hierarchy — /outreach network a11y outline", () => {
  it("outreach network page title is an <h1>, not <h2>", () => {
    const src = read("app/outreach/network/page.tsx");
    expect(src).toMatch(
      /<h1 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
    expect(src).not.toMatch(
      /<h2 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
  });

  it("outreach section titles are <h2>, never <h3> (no h1->h3 skip)", () => {
    for (const name of ["EntityAttributionTable", "PendingApprovalQueue"]) {
      const src = read(`components/outreach/${name}.tsx`);
      expect(src).not.toMatch(
        /<h3 className="text-\[18px\] font-bold tracking-tight text-ink"/
      );
      expect(src).toMatch(
        /<h2 className="text-\[18px\] font-bold tracking-tight text-ink"/
      );
    }
  });
});

describe("heading hierarchy — /pilot a11y outline", () => {
  it("pilot page title is an <h1>, not <h2>", () => {
    const src = read("app/pilot/page.tsx");
    expect(src).toMatch(
      /<h1 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
    expect(src).not.toMatch(
      /<h2 className="text-\[26px\] font-bold tracking-tight leading-none text-ink">/
    );
  });

  it("pilot section titles are <h2>, never <h3> (no h1->h3 skip)", () => {
    // The four pilot section titles live inline in the page (Funnel, Stage
    // durations, Stalled, Risk) and share one utility-class string.
    const src = read("app/pilot/page.tsx");
    expect(src).not.toMatch(
      /<h3 className="text-\[18px\] font-semibold tracking-tight text-ink leading-tight">/
    );
    expect(src).toMatch(
      /<h2 className="text-\[18px\] font-semibold tracking-tight text-ink leading-tight">/
    );
  });
});
