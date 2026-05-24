import { describe, it, expect } from "vitest";
import { allCitations, byRelevance, bySection } from "./index.js";
import type { CfrCitation } from "./index.js";

describe("@civica/cfr-273", () => {
  it("loads all 223 curated citations", () => {
    const rows = allCitations();
    expect(rows.length).toBe(223);
  });

  it("filters by relevance grade", () => {
    const high = byRelevance("HIGH");
    expect(high.length).toBeGreaterThan(0);
    expect(high.every((c: CfrCitation) => c.civica_relevance === "HIGH")).toBe(true);
  });

  it("filters by section number", () => {
    const sec = bySection("273.9");
    expect(sec.length).toBeGreaterThan(0);
    expect(sec.every((c: CfrCitation) => c.section === "273.9")).toBe(true);
  });
});
