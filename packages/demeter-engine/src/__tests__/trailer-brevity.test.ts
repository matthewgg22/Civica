// The citation trailer's brevity rule (owner, 2026-08-22: "the sources are a
// little too much").
//
// What was too much: for an answer where every citation checked out, the reader
// got the same assertion three times in four stacked blocks —
//
//   ✓ CERTAIN — Every rule cited here comes from regulation text pulled for
//   your question — check it yourself below.
//   Citation:
//   • ✓ checked against the official rule text we pulled for this question: 7 CFR 273.5
//   Source: eCFR …
//
// The banner already makes the claim. The per-citation restatement is gone and
// the all-clear case is one line.
//
// THE ASYMMETRY IS THE POINT, and it is what this file guards: shortening a
// REASSURANCE costs nothing, because the reader who ignores it loses nothing.
// Shortening a CAVEAT costs them the reason not to rely on the answer. So the
// unrecognized and not-retrieved branches keep their full sentences, and any
// future pass at "tightening the sources" has to fail this test to touch them.
import { describe, it, expect } from "vitest";
import { formatCitationTrailer, type CitationCheck } from "../citation-verifier";
import { ANSWER_LANGS } from "../lang";

const inSources = (c: string): CitationCheck => ({ citation: c, status: "in_sources" });
const known = (c: string): CitationCheck => ({ citation: c, status: "known" });
const bad = (c: string): CitationCheck => ({ citation: c, status: "unrecognized" });

/** Content lines, ignoring the leading blank/rule lines. */
function bodyLines(trailer: string): string[] {
  return trailer.split("\n").map((l) => l.trim()).filter((l) => l && l !== "---");
}

describe("all clear is one line", () => {
  it("collapses the heading and the single citation together", () => {
    const lines = bodyLines(formatCitationTrailer([inSources("7 CFR 273.5")]));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("**Citation:** ✓ 7 CFR 273.5");
  });

  it("stays one line with several verified citations", () => {
    const lines = bodyLines(
      formatCitationTrailer([inSources("7 CFR 273.5"), inSources("7 CFR 273.9")]),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("7 CFR 273.5, 7 CFR 273.9");
  });

  it("never restates what the certainty banner already said", () => {
    // The exact sentence that used to repeat above each citation.
    const trailer = formatCitationTrailer([inSources("7 CFR 273.5")]);
    expect(trailer).not.toMatch(/checked against the official rule text/i);
    expect(trailer).not.toMatch(/we pulled for this question/i);
  });

  it("holds in every language", () => {
    for (const lang of ANSWER_LANGS) {
      const lines = bodyLines(formatCitationTrailer([inSources("7 CFR 273.5")], lang));
      expect(lines, lang).toHaveLength(1);
      expect(lines[0], lang).toContain("✓ 7 CFR 273.5");
    }
  });
});

describe("warnings are never compressed away", () => {
  it("an unrecognized citation keeps its full sentence and its own line", () => {
    const lines = bodyLines(formatCitationTrailer([bad("7 CFR 999.9")]));
    expect(lines.length).toBeGreaterThan(1);
    const warning = lines.find((l) => l.includes("999.9"))!;
    expect(warning).toMatch(/NOT recognized/i);
    expect(warning).toMatch(/verify before relying/i);
  });

  it("a not-retrieved citation keeps its explanation", () => {
    const lines = bodyLines(formatCitationTrailer([known("7 CFR 273.6")]));
    const warning = lines.find((l) => l.includes("273.6"))!;
    expect(warning).toMatch(/didn't pull its wording/i);
    expect(warning).toMatch(/double-check/i);
  });

  it("one bad citation expands the whole trailer, even beside verified ones", () => {
    // The all-clear shortcut must not swallow a warning that shares the answer.
    const trailer = formatCitationTrailer([inSources("7 CFR 273.5"), bad("7 CFR 999.9")]);
    const lines = bodyLines(trailer);
    expect(lines[0]).toBe("**Citation:**");
    expect(trailer).toMatch(/NOT recognized/i);
    expect(trailer).toContain("✓ 7 CFR 273.5");
  });

  it("warnings survive in every language", () => {
    for (const lang of ANSWER_LANGS) {
      const trailer = formatCitationTrailer([bad("7 CFR 999.9")], lang);
      expect(bodyLines(trailer).length, lang).toBeGreaterThan(1);
      expect(trailer, lang).toContain("⚠️");
    }
  });
});
