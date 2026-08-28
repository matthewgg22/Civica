import { describe, it, expect } from "vitest";
import { assessFreshness, formatFreshnessFooter } from "../freshness";
import { getStatePack } from "../states";

const CORPUS = "2026-06-02";

describe("Mae freshness monitoring", () => {
  it("is clean while sources are current", () => {
    const f = assessFreshness(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(f.readerWarnings).toEqual([]);
    expect(f.operatorWarnings).toEqual([]);
    expect(f.asOf).toMatch(/valid through/i);
    expect(f.asOf).toMatch(/FY ?2026/);
  });

  it("splits the FY expiry across both audiences (after Oct 1)", () => {
    // One fact, two sentences. The reader's risk is "these amounts may be
    // wrong now"; the operator's job is "move the engine to FY27". #958 was
    // one sentence trying to serve both.
    const f = assessFreshness(new Date("2026-10-15T00:00:00Z"), CORPUS);
    expect(f.operatorWarnings.join(" ")).toMatch(/FY26 figures expired/i);
    expect(f.operatorWarnings.join(" ")).toMatch(/FY27 COLA/i);
    expect(f.readerWarnings).toHaveLength(1);
    expect(f.readerWarnings[0]).toMatch(/changed on Oct 1/i);
    expect(f.readerWarnings[0], "chores never reach the reader").not.toMatch(/engine|COLA values/i);
  });

  it("keeps operator warnings operator-side (CA ABAWD window, corpus age)", () => {
    const f = assessFreshness(new Date("2026-11-15T00:00:00Z"), CORPUS);
    expect(f.operatorWarnings.join(" ")).toMatch(/ABAWD county-waiver/i);
    const stale = assessFreshness(new Date("2026-11-01T00:00:00Z"), CORPUS);
    expect(stale.operatorWarnings.join(" ")).toMatch(/eCFR corpus is \d+ days old/i);
    expect(stale.readerWarnings.join(" ")).not.toMatch(/corpus|build-ecfr/i);
  });

  it("warns before 2026-06-01 that CA ABAWD screening is not yet in effect, and is silent after", () => {
    const before = assessFreshness(new Date("2026-05-15T00:00:00Z"), CORPUS);
    expect(before.operatorWarnings.join(" ")).toMatch(/ABAWD time-limit screening does not begin/i);
    const after = assessFreshness(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(after.operatorWarnings.join(" ")).not.toMatch(/does not begin/i);
  });

  it("footer always names its source and its validity", () => {
    const fresh = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(fresh).toContain("eCFR");
    expect(fresh).toContain("ecfr.gov");
    expect(fresh).toMatch(/valid through/i);
    expect(fresh).not.toContain("⚠️");
  });

  it("links the SOURCE NAME, not the whole line", () => {
    const f = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS);
    expect(f).toContain("[eCFR](");
    expect(f).not.toMatch(/\[[^\]]*valid through[^\]]*\]\(/);
  });

  it("localizes the footer in all four languages, not two", () => {
    // The apparatus carries the product's promise; a zh reader was getting it
    // in English.
    const es = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS, undefined, "es");
    expect(es).toMatch(/Según las reglas federales/);
    expect(es).not.toMatch(/Based on federal/);
    const vi = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS, undefined, "vi");
    expect(vi).toMatch(/quy định SNAP liên bang/);
    expect(vi).toMatch(/năm tài khóa 2026/);
    const zh = formatFreshnessFooter(new Date("2026-06-15T00:00:00Z"), CORPUS, undefined, "zh");
    expect(zh).toMatch(/联邦 SNAP 规定/);
    expect(zh).toMatch(/2026 财年/);
  });
});

// ── #958: operator provenance must never render under an answer ─────────────
describe("the reader/operator split (#958)", () => {
  it("REGRESSION: Vermont's live leak — the PER provenance note no longer renders", () => {
    // On 2026-08-28 the pack's `vt-hr1-cost-sharing-timeline` entry (809
    // chars of "re-verify Vermont's then-current PER … before citing") fired
    // on every VT answer. That text is a note from the pack's author to the
    // pack's maintainer, rendered at a person in crisis.
    const now = new Date("2026-08-28T12:00:00Z");
    const f = assessFreshness(now, CORPUS, "VT");
    expect(
      f.operatorWarnings.join(" "),
      "the signal itself must survive, operator-side",
    ).toMatch(/cost.sharing|PER/i);
    const footer = formatFreshnessFooter(now, CORPUS, "VT");
    expect(footer, "the note reached the reader").not.toMatch(/re-verify|PER|cost.sharing/i);
    expect(footer).not.toContain("⚠️");
  });

  it("REGRESSION: the October 1 stack — six VT entries stay out of the footer", () => {
    // On Oct 2 the six `expires: 2026-10-01` entries all fire at once —
    // mirror-staleness, manual-inaccessible, single-source SUA… ~4,000 chars
    // of research provenance — exactly when FY26 figures also go stale.
    const oct = new Date("2026-10-02T12:00:00Z");
    const f = assessFreshness(oct, CORPUS, "VT");
    expect(f.operatorWarnings.length).toBeGreaterThanOrEqual(6);
    const footer = formatFreshnessFooter(oct, CORPUS, "VT");
    // The reader gets exactly ONE short line: figures changed, double-check.
    const warningLines = footer.split("\n").filter((l) => l.includes("⚠️"));
    expect(warningLines).toHaveLength(1);
    expect(warningLines[0]).toMatch(/changed on Oct 1/i);
    expect(footer.length, "a footer, not an essay").toBeLessThan(400);
    expect(footer).not.toMatch(/law\.cornell|RoboHelp|single-source|re-verify/i);
  });

  it("localizes the one reader warning per language", () => {
    const oct = new Date("2026-10-02T12:00:00Z");
    expect(formatFreshnessFooter(oct, CORPUS, "VT", "es")).toMatch(/1 de octubre/);
    expect(formatFreshnessFooter(oct, CORPUS, "VT", "vi")).toMatch(/1 tháng 10/);
    expect(formatFreshnessFooter(oct, CORPUS, "VT", "zh")).toMatch(/10月1日/);
  });

  it("no pack entry is reader_facing today — leaking requires an explicit opt-in", () => {
    // The default is the fix: an entry reaches a reader only by declaring
    // `reader_facing: true`, and none does. If one ever does, this test
    // demands the author noticed (update the count deliberately).
    const codes = ["VT", "SC", "CA", "NY", "TX"];
    for (const c of codes) {
      const entries = getStatePack(c)?.freshness ?? [];
      expect(
        entries.filter((e) => e.reader_facing).length,
        `${c} has a reader_facing entry — cap and copy-review it before shipping`,
      ).toBe(0);
    }
  });
});
