import { describe, it, expect } from "vitest";
import { assessFreshness, formatFreshnessFooter } from "../freshness";

const CORPUS = "2026-06-02";

describe("Mae freshness monitoring", () => {
  it("is clean while sources are current", () => {
    const f = assessFreshness(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(f.warnings).toEqual([]);
    // The corpus fetch date left the VISIBLE line (it answers our question,
    // not the reader's). It still governs the staleness warning below.
    expect(f.asOf).toMatch(/valid through/i);
    // "FY26" became "FY2026" when the line stopped being a stamp.
    expect(f.asOf).toMatch(/FY ?2026/);
  });

  it("warns once FY26 figures expire (after Oct 1)", () => {
    const f = assessFreshness(new Date("2026-10-15T00:00:00Z"), CORPUS);
    expect(f.warnings.join(" ")).toMatch(/FY26 figures expired/i);
  });

  it("warns once the CA ABAWD waiver window ends (after Oct 31)", () => {
    const f = assessFreshness(new Date("2026-11-15T00:00:00Z"), CORPUS);
    expect(f.warnings.join(" ")).toMatch(/ABAWD county-waiver/i);
    expect(f.warnings.join(" ")).toMatch(/FY26 figures expired/i); // both fire
  });

  it("warns when the corpus snapshot is stale (>120 days)", () => {
    const f = assessFreshness(new Date("2026-11-01T00:00:00Z"), CORPUS); // ~152 days
    expect(f.warnings.join(" ")).toMatch(/eCFR corpus is \d+ days old/i);
  });

  it("footer always names its source and its validity, and renders warnings", () => {
    // PLAIN LANGUAGE SINCE 2026-08-26. It was "Source: eCFR 2026-06-02 · FY26
    // figures through 2026-09-30" — accurate and shaped like a filename. What
    // is pinned is what it must still CARRY: a named source, a link, and how
    // long the figures hold. Not the stamp format it used to carry them in.
    const fresh = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(fresh).toContain("eCFR");
    expect(fresh).toContain("ecfr.gov");
    expect(fresh).toMatch(/valid through/i);
    expect(fresh).not.toContain("⚠️");

    const stale = formatFreshnessFooter(new Date("2026-11-15T00:00:00Z"), CORPUS);
    expect(stale).toContain("eCFR");
    expect(stale).toContain("⚠️");
  });

  it("links the SOURCE NAME, not the whole line", () => {
    // Underlining the dates gave a footnote more visual pull than a citation
    // deserves, so the markdown link wraps "eCFR" alone.
    const f = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(f).toContain("[eCFR](");
    expect(f).not.toMatch(/\[[^\]]*valid through[^\]]*\]\(/);
  });

  it("localizes the as-of line for Spanish answers", () => {
    const es = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS, undefined, "es");
    // What is pinned is that Spanish gets a SPANISH line, not the wording.
    expect(es).toMatch(/Según las reglas federales/);
    expect(es).toMatch(/vigentes hasta/);
    expect(es).not.toMatch(/valid through/i);
    expect(es).not.toMatch(/Based on federal/);
  });

  it("warns before 2026-06-01 that CA ABAWD screening is not yet in effect, and is silent after", () => {
    const before = assessFreshness(new Date("2026-05-15T00:00:00Z"), CORPUS);
    expect(before.warnings.join(" ")).toMatch(/ABAWD time-limit screening does not begin/i);
    const after = assessFreshness(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(after.warnings.join(" ")).not.toMatch(/does not begin/i);
  });
});
