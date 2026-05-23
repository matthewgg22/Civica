import { describe, it, expect } from "vitest";
import { obbbaProvisions, publicDataSources } from "../obbba";

describe("obbbaProvisions", () => {
  const provisions = obbbaProvisions();

  it("returns at least one hero-tier provision (the load-bearing rows of the panel)", () => {
    const heros = provisions.filter((p) => p.tier === "hero");
    expect(heros.length).toBeGreaterThanOrEqual(1);
  });

  it("every provision has a non-empty title, section, and source path", () => {
    for (const p of provisions) {
      expect(p.title).toBeTruthy();
      expect(p.section).toBeTruthy();
      expect(p.source).toBeTruthy();
    }
  });

  it("every provision has a parseable ISO deadline date", () => {
    for (const p of provisions) {
      const d = new Date(p.deadlineIso);
      expect(Number.isFinite(d.getTime())).toBe(true);
    }
  });

  it("status values are constrained to the documented enum", () => {
    const allowed = new Set(["Ready", "Partial"]);
    for (const p of provisions) {
      expect(allowed.has(p.status)).toBe(true);
    }
  });

  it("impactKind values are constrained to the documented enum", () => {
    const allowed = new Set(["dollar", "count", "risk", "ready"]);
    for (const p of provisions) {
      expect(allowed.has(p.impactKind)).toBe(true);
    }
  });

  // T5 credibility check: any dollar-tagged impactLabel must NOT contain the
  // strings "$NaN" or "$undefined" — the kind of bug that ships when a
  // formula upstream returns undefined and template-literal interpolation
  // silently leaks it.
  it("no impactLabel contains NaN or undefined (formula leak guard)", () => {
    for (const p of provisions) {
      expect(p.impactLabel).not.toContain("NaN");
      expect(p.impactLabel).not.toContain("undefined");
    }
  });

  it("hero provisions all have a heroNumber field set", () => {
    const heros = provisions.filter((p) => p.tier === "hero");
    for (const p of heros) {
      expect(p.heroNumber).toBeTruthy();
      expect(p.heroNumber).not.toContain("NaN");
    }
  });
});

describe("publicDataSources", () => {
  it("returns at least one source", () => {
    expect(publicDataSources().length).toBeGreaterThan(0);
  });

  it("every source has a non-empty name, url, and status", () => {
    for (const s of publicDataSources()) {
      expect(s.name).toBeTruthy();
      expect(s.url).toBeTruthy();
      expect(s.status).toBeTruthy();
    }
  });
});
