import { describe, it, expect } from "vitest";
import { assessCertainty } from "../certainty";
import { formatCitationTrailer, type CitationCheck } from "../citation-verifier";

// #959: an answer ended with "✓ CERTAIN — … check it yourself below." and
// nothing followed — no Citation line, no Source line. The verdict promised, in
// its own words, a list "below" that the rendered answer did not keep.
//
// The client half of the fix drops a model-improvised banner that the pipeline
// never backed (see render-answer.test.tsx). This is the pipeline half: the
// invariant that makes a *real* CERTAIN-with-no-citations unreachable, so the
// only way to see one is the model imitating the format. CERTAIN is graded only
// when a citation was retrieved for THIS question (assessCertainty), and
// formatCitationTrailer renders whenever there is any citation — so fed the SAME
// checks (as orchestrator.ts does), a CERTAIN verdict can never sit above an
// empty trailer.
describe("CERTAIN is unreachable with an empty citation trailer (#959)", () => {
  const inSrc = (c: string): CitationCheck => ({ citation: c, status: "in_sources" });
  const known = (c: string): CitationCheck => ({ citation: c, status: "known" });
  const bad = (c: string): CitationCheck => ({ citation: c, status: "unrecognized" });

  it("grades CERTAIN when a retrieved citation is present, and the trailer renders it", () => {
    const checks = [inSrc("7 CFR 273.9")];
    const v = assessCertainty({ checks, outcome: "clean", state: null, stateVerified: true });
    expect(v.level).toBe("certain");
    expect(formatCitationTrailer(checks)).not.toBe("");
  });

  it("never grades CERTAIN with zero checks (and the trailer is empty there)", () => {
    const v = assessCertainty({ checks: [], outcome: "clean", state: null, stateVerified: true });
    expect(v.level).not.toBe("certain");
    expect(formatCitationTrailer([])).toBe("");
  });

  it("a 'known but not retrieved' citation is not enough to earn CERTAIN", () => {
    // known ≠ read: recognizing an authority is not the same as having pulled
    // its text for this question, so this must NOT be certain — and if it were,
    // the guarded invariant below would catch it.
    const v = assessCertainty({ checks: [known("ACL 25-68")], outcome: "clean", state: null, stateVerified: true });
    expect(v.level).not.toBe("certain");
  });

  it("holds across the whole input space: certain ⟹ non-empty trailer", () => {
    const pool: CitationCheck[] = [inSrc("7 CFR 273.9"), known("ACL 25-68"), bad("7 CFR 999.9")];
    const outcomes = ["clean", "recomposed", "degraded"];
    const states: Array<[string | null, boolean]> = [
      [null, true], // federal floor
      ["CA", true], // verified state
      ["ZZ", false], // unverified state
    ];
    let sawCertain = false;
    for (let mask = 0; mask < 1 << pool.length; mask++) {
      const checks = pool.filter((_, i) => mask & (1 << i));
      for (const outcome of outcomes) {
        for (const [state, stateVerified] of states) {
          for (const distress of [false, true]) {
            const v = assessCertainty({ checks, outcome, state, stateVerified, distress });
            if (v.level === "certain") {
              sawCertain = true;
              expect(
                formatCitationTrailer(checks),
                `CERTAIN with empty trailer — checks=${JSON.stringify(checks)} outcome=${outcome} state=${state}`,
              ).not.toBe("");
            }
          }
        }
      }
    }
    // Guard against the invariant passing vacuously because nothing graded certain.
    expect(sawCertain).toBe(true);
  });
});
