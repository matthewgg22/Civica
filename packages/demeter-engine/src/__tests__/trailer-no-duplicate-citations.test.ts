import { describe, it, expect } from "vitest";
import { assessCertainty, formatCertaintyBanner } from "../certainty";
import { formatCitationTrailer } from "../citation-verifier";
import type { CitationCheck } from "../citation-verifier";

// Regression: a real production transcript (2026-08-15) showed every answer's
// trailer naming the SAME citation twice, back to back, in two different
// bullet styles:
//
//   ✓ **CERTAIN** — ... check it yourself below.
//   _Check it yourself:_ 7 CFR 273.1
//
//   **Citation:**
//   - ✓ regulatory text retrieved for this question: 7 CFR 273.1
//
// certainty.ts's own top-of-file comment says it was added to REPLACE the old
// "◑ in a footer, which no applicant reads" — but formatCitationTrailer (the
// old footer) was never removed, so the new banner just stacked another
// citation list on top of it instead of replacing it. This composes the
// trailer exactly the way orchestrator.ts does (banner + trailer, both gated
// on the same `degraded` flag, both driven by the same checks — see
// orchestrator.ts:522-528) and asserts each citation appears at most once in
// the combined text.
function composeTrailer(checks: CitationCheck[]): string {
  const verdict = assessCertainty({ checks, outcome: "clean", state: null, stateVerified: true });
  const banner = formatCertaintyBanner(verdict);
  const trailer = formatCitationTrailer(checks).replace(/^\n\n---\n/, "");
  return [banner, trailer ? `\n\n${trailer}` : ""].filter(Boolean).join("");
}

describe("trailer composition — no duplicate citations (real transcript regression)", () => {
  it("names a CERTAIN citation only once across the whole trailer", () => {
    const combined = composeTrailer([{ citation: "7 CFR 273.1", status: "in_sources" }]);
    const occurrences = combined.split("7 CFR 273.1").length - 1;
    expect(occurrences, `citation appeared ${occurrences} times in:\n${combined}`).toBe(1);
  });

  it("names each of several citations only once, even mixed status", () => {
    const combined = composeTrailer([
      { citation: "7 CFR 273.9(a)(1)", status: "in_sources" },
      { citation: "7 CFR 273.9(d)(2)", status: "known" },
    ]);
    for (const cite of ["7 CFR 273.9(a)(1)", "7 CFR 273.9(d)(2)"]) {
      const occurrences = combined.split(cite).length - 1;
      expect(occurrences, `"${cite}" appeared ${occurrences} times in:\n${combined}`).toBe(1);
    }
  });

  it("the certainty verdict itself still names the outcome, just not its own citation list", () => {
    const combined = composeTrailer([{ citation: "7 CFR 273.1", status: "in_sources" }]);
    expect(combined).toContain("**CERTAIN**");
    // The citation trailer is still the one place citations are enumerated.
    expect(combined).toContain("**Citation:**");
  });
});
