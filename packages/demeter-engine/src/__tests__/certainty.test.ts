import { describe, it, expect } from "vitest";
import { assessCertainty, formatCertaintyBanner } from "../certainty";
import type { CitationCheck } from "../citation-verifier";

// CERTAIN is a claim about benefits information, so most of this suite is about
// the cases where it must be WITHHELD. Over-claiming certainty is the failure
// that costs someone food; under-claiming just sends them to the source.

const inSrc = (c: string): CitationCheck => ({ citation: c, status: "in_sources" });
const known = (c: string): CitationCheck => ({ citation: c, status: "known" });
const bad = (c: string): CitationCheck => ({ citation: c, status: "unrecognized" });

const base = { outcome: "clean", state: null, stateVerified: true };

describe("assessCertainty", () => {
  it("grants CERTAIN when every cite is backed by retrieved regulation text", () => {
    const v = assessCertainty({ ...base, checks: [inSrc("7 CFR 273.9(a)(1)")] });
    expect(v.level).toBe("certain");
    expect(v.code).toBe("grounded");
    expect(v.basis).toContain("7 CFR 273.9(a)(1)");
  });

  it("grants CERTAIN to a RECOMPOSED answer — the bad draft never reached the reader", () => {
    // The first attempt failed the citation check and was discarded mid-stream;
    // the replacement cleared the same bar. That is the machinery working.
    const v = assessCertainty({ ...base, outcome: "recomposed", checks: [inSrc("7 CFR 273.10")] });
    expect(v.level).toBe("certain");
  });

  it("WITHHOLDS certainty when a citation is unrecognized, even if others are solid", () => {
    const v = assessCertainty({
      ...base,
      checks: [inSrc("7 CFR 273.10"), bad("7 CFR 999.99")],
    });
    expect(v.level).toBe("uncertain");
    expect(v.code).toBe("unrecognized_citation");
    expect(v.basis).toEqual(["7 CFR 999.99"]); // point at the problem, not everything
  });

  it("WITHHOLDS certainty when the answer degraded to quoting sources", () => {
    const v = assessCertainty({ ...base, outcome: "degraded", checks: [inSrc("7 CFR 273.10")] });
    expect(v.level).toBe("uncertain");
    expect(v.code).toBe("degraded_to_sources");
  });

  it("WITHHOLDS certainty when the authority is recognized but its text wasn't retrieved", () => {
    // "We know this section exists" is not "we read it for your question".
    const v = assessCertainty({ ...base, checks: [known("TWH A-1429")] });
    expect(v.level).toBe("uncertain");
    expect(v.code).toBe("authority_not_retrieved");
  });

  it("WITHHOLDS certainty for a state we have not verified", () => {
    const v = assessCertainty({
      checks: [inSrc("7 CFR 273.9(a)(1)")],
      outcome: "clean",
      state: "OH",
      stateVerified: false,
    });
    expect(v.level).toBe("uncertain");
    expect(v.code).toBe("state_not_verified");
  });

  it("still grants CERTAIN on the federal floor — no state claim is being made", () => {
    const v = assessCertainty({
      checks: [inSrc("7 CFR 273.9(a)(1)")],
      outcome: "clean",
      state: null,
      stateVerified: false,
    });
    expect(v.level).toBe("certain");
  });

  it("reports the WORST signal when several apply", () => {
    // Unrecognized outranks degraded outranks unverified state.
    const v = assessCertainty({
      checks: [bad("7 CFR 999.99")],
      outcome: "degraded",
      state: "OH",
      stateVerified: false,
    });
    expect(v.code).toBe("unrecognized_citation");
  });

  it("never grants CERTAIN with no citations at all", () => {
    // The guarantee this test exists for is in its name: no citations must
    // never buy a confident label. That still holds. What changed (#685) is
    // the other side — it no longer claims UNCERTAIN either, because an answer
    // that cites nothing is usually a correct refusal, and telling someone
    // "these are real authorities but we lacked their text" is false when
    // there are no authorities.
    const v = assessCertainty({ ...base, checks: [] });
    expect(v.level).not.toBe("certain");
    expect(v.level).toBe("not_applicable");
    expect(v.code).toBe("no_claim_to_verify");
  });

  it("shows no banner for an answer that makes no citation claim", () => {
    // Measured on the gold set: ALL 7 uncertain answers were refusals, PII
    // deflections or distress replies. A distress reply leading with emergency
    // food help was being stamped "we can't be certain".
    const v = assessCertainty({ ...base, checks: [] });
    expect(formatCertaintyBanner(v)).toBe("");
  });

  it("does not hedge a distress reply that cites help, not regulation", () => {
    // Someone said their benefits were cut. The answer leads with 211 and the
    // local office — its substance is a phone number, not a policy claim — so
    // it cites nothing retrievable and used to land on "we can't be certain".
    // Measured firing on distress-benefits-cut in consecutive gold runs.
    const v = assessCertainty({ ...base, checks: [known("7 CFR 273.15")], distress: true });
    expect(v.level).toBe("not_applicable");
    expect(formatCertaintyBanner(v)).toBe("");
  });

  it("STILL warns a distress reply that cites something fabricated", () => {
    // The suppression is scoped to one branch on purpose. A made-up citation
    // is more dangerous in a crisis reply, not less — this must keep warning.
    const v = assessCertainty({ ...base, checks: [bad("7 CFR 999.99")], distress: true });
    expect(v.level).toBe("uncertain");
    expect(v.code).toBe("unrecognized_citation");
    expect(formatCertaintyBanner(v)).toContain("UNCERTAIN");
  });

  it("a properly grounded distress reply is still CERTAIN, not silenced", () => {
    // Suppression only replaces the authority_not_retrieved hedge; it does not
    // strip a verdict the answer legitimately earned.
    const v = assessCertainty({ ...base, checks: [inSrc("7 CFR 273.15")], distress: true });
    expect(v.level).toBe("certain");
  });

  it("still warns when authorities WERE cited but none were retrieved", () => {
    // The real recall failure must keep its warning — this is the case the
    // banner exists for, and the boundary that keeps #685's fix from
    // swallowing it.
    const v = assessCertainty({ ...base, checks: [known("7 CFR 273.7")] });
    expect(v.level).toBe("uncertain");
    expect(v.code).toBe("authority_not_retrieved");
    expect(formatCertaintyBanner(v)).toContain("UNCERTAIN");
  });
});

describe("formatCertaintyBanner", () => {
  it("leads with a label a non-expert can read", () => {
    const v = assessCertainty({ ...base, checks: [inSrc("7 CFR 273.10")] });
    const out = formatCertaintyBanner(v);
    expect(out).toContain("**CERTAIN**");
    // Does NOT list its own citations — formatCitationTrailer (which always
    // follows this banner in orchestrator.ts) is the one place citations are
    // enumerated. Duplicating them here was a real production defect (#833
    // audit, 2026-08-15) — see trailer-no-duplicate-citations.test.ts.
    expect(out).not.toContain("Check it yourself");
    expect(out).not.toContain("7 CFR 273.10");
    // The verdict OBJECT still carries the basis for anyone downstream who
    // wants it (e.g. analytics) — only the rendered banner text dropped it.
    expect(v.basis).toContain("7 CFR 273.10");
  });

  it("marks an uncertain answer visibly rather than burying it", () => {
    const v = assessCertainty({ ...base, checks: [bad("7 CFR 999.99")] });
    const out = formatCertaintyBanner(v);
    expect(out).toContain("⚠");
    expect(out).toContain("**UNCERTAIN**");
    expect(out).toContain("confirm with your SNAP agency");
  });

  it("localizes to Spanish, label included", () => {
    const v = assessCertainty({ ...base, checks: [inSrc("7 CFR 273.10")] }, "es");
    const out = formatCertaintyBanner(v, "es");
    expect(out).toContain("**SEGURO**");
    expect(out).not.toContain("CERTAIN");
  });
});
