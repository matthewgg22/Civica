import { describe, it, expect } from "vitest";
import { assessFreshness, formatFreshnessFooter } from "../freshness";

const CORPUS = "2026-06-02";

describe("Mae freshness monitoring", () => {
  it("is clean while sources are current", () => {
    const f = assessFreshness(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(f.warnings).toEqual([]);
    expect(f.asOf).toContain("2026-06-02");
    expect(f.asOf).toContain("FY26");
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

  it("footer always carries an 'as of' line and renders warnings", () => {
    const fresh = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(fresh).toContain("Sources as of");
    expect(fresh).not.toContain("⚠️");

    const stale = formatFreshnessFooter(new Date("2026-11-15T00:00:00Z"), CORPUS);
    expect(stale).toContain("Sources as of");
    expect(stale).toContain("⚠️");
  });

  it("warns before 2026-06-01 that CA ABAWD screening is not yet in effect, and is silent after", () => {
    const before = assessFreshness(new Date("2026-05-15T00:00:00Z"), CORPUS);
    expect(before.warnings.join(" ")).toMatch(/ABAWD time-limit screening does not begin/i);
    const after = assessFreshness(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(after.warnings.join(" ")).not.toMatch(/does not begin/i);
  });
});
