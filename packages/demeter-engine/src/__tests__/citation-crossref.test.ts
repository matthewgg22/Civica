// A citation the SOURCE ITSELF quotes is not an invention.
//
// From production (mae_query_log, 2026-08-12 15:09). Question: "four people in
// my household; I make 4 k a month and im in boston". The answer cited
// 45 CFR 260.31 — which appears verbatim inside the retrieved text of
// 7 CFR 273.8(e)(19): "…as defined by 45 CFR 260.31 (a)(1) and (a)(2)…".
//
// 45 CFR is not SNAP corpus, so it scored `unrecognized`. One unrecognized
// citation rejects the draft; the retry was rejected the same way; the turn
// degraded. Every other citation in that answer was in_sources or known — the
// model had done exactly the right thing and cited what its source cited.
import { describe, expect, it } from "vitest";
import { verifyCitations } from "../citation-verifier";

// The real sentence, from 7 CFR 273.8(e)(19).
const RETRIEVED_TEXT =
  "(19) At State agency option, any resources that the State agency excludes when " +
  "determining eligibility or benefits for TANF cash assistance, as defined by " +
  "45 CFR 260.31 (a)(1) and (a)(2), or medical assistance under Section 1931 of the SSA.";

const RETRIEVED = ["7 CFR 273.8(e)(2)", "7 CFR 273.8(b)"];

const statusOf = (answer: string, text?: string) =>
  Object.fromEntries(
    verifyCitations(answer, RETRIEVED, "CA", text).map((c) => [c.citation, c.status]),
  );

describe("a cross-reference quoted by the retrieved source", () => {
  it("is recognized when the source text is available", () => {
    const got = statusOf("TANF resources are defined by 45 CFR 260.31.", RETRIEVED_TEXT);
    expect(got["45 CFR 260.31"]).toBe("known");
  });

  it("is `known`, NOT `in_sources` — we did not retrieve it and cannot vouch for it", () => {
    // The trailer renders `known` as "recognized authority, but not in the
    // retrieved text — confirm against source", which is exactly what a reader
    // should be told about a cross-reference.
    const got = statusOf("See 45 CFR 260.31.", RETRIEVED_TEXT);
    expect(got["45 CFR 260.31"]).not.toBe("in_sources");
  });

  it("still flags a citation that appears NOWHERE", () => {
    // The guardrail has to keep working — this is the whole reason it exists.
    const got = statusOf("See 42 CFR 999.99 for the limit.", RETRIEVED_TEXT);
    expect(got["42 CFR 999.99"]).toBe("unrecognized");
  });

  it("without source text, behaves exactly as before", () => {
    // The parameter is optional; the eval and other callers pass nothing.
    const got = statusOf("TANF resources are defined by 45 CFR 260.31.");
    expect(got["45 CFR 260.31"]).toBe("unrecognized");
  });

  it("does not fuzzy-match — the citation must appear as written", () => {
    // "45 CFR 260.32" is one digit off and is not in the source.
    const got = statusOf("See 45 CFR 260.32.", RETRIEVED_TEXT);
    expect(got["45 CFR 260.32"]).toBe("unrecognized");
  });

  it("still marks the retrieved sections themselves as in_sources", () => {
    const got = statusOf("Under 7 CFR 273.8(b) the limit applies.", RETRIEVED_TEXT);
    expect(got["7 CFR 273.8(b)"]).toBe("in_sources");
  });
});
