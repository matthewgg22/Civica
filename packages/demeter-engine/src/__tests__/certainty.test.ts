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
    const v = assessCertainty({ ...base, checks: [] });
    expect(v.level).toBe("uncertain");
  });
});

describe("formatCertaintyBanner", () => {
  it("leads with a label a non-expert can read, then what to check", () => {
    const v = assessCertainty({ ...base, checks: [inSrc("7 CFR 273.10")] });
    const out = formatCertaintyBanner(v);
    expect(out).toContain("**CERTAIN**");
    expect(out).toContain("Check it yourself");
    expect(out).toContain("7 CFR 273.10");
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
    expect(out).toContain("Compruébalo tú mismo");
    expect(out).not.toContain("CERTAIN");
  });
});
