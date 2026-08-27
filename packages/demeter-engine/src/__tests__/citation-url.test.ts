// Where a citation can actually be read.
//
// The certainty banner promises "check it yourself below" and what followed
// was the unclickable string "7 CFR 273.5" (owner, 2026-08-26). A product
// whose whole claim is "every answer quotes the rule it came from, so you can
// check it" was asking the reader to go find the rule themselves.
//
// The URL shape below was verified live against eCFR on 2026-08-26 — 7 CFR
// 271.2, 273.5, 273.9, 273.10 and 273.24 all returned 200 through the short
// section form, which redirects to the full subtitle/chapter path.
import { describe, it, expect } from "vitest";
import { citationUrl, citationMarkdown } from "../citation-url";
import { formatCitationTrailer } from "../citation-verifier";

describe("citationUrl", () => {
  it("points a federal citation at its own section", () => {
    expect(citationUrl("7 CFR 273.5")).toBe(
      "https://www.ecfr.gov/current/title-7/part-273/section-273.5",
    );
    // A different title and part, to prove nothing is hardcoded to 7/273.
    expect(citationUrl("8 CFR 212.21")).toBe(
      "https://www.ecfr.gov/current/title-8/part-212/section-212.21",
    );
  });

  it("drops the subsection, because eCFR anchors sections not paragraphs", () => {
    // "…/section-273.9(d)(2)" resolves to nothing. The section page is the
    // closest thing to the cited paragraph that actually exists.
    expect(citationUrl("7 CFR 273.9(d)(2)")).toBe(
      "https://www.ecfr.gov/current/title-7/part-273/section-273.9",
    );
  });

  it("returns null rather than guessing at anything it does not recognize", () => {
    // State policy instruments and statutes have no eCFR page. A citation
    // rendered as plain text is a small loss; a citation rendered as a link
    // to the WRONG rule is the failure this whole verifier exists to prevent.
    for (const c of ["ACL 21-108", "MPP 63-300", "7 U.S.C. 2014", "", "273.9"]) {
      expect(citationUrl(c), c).toBeNull();
      expect(citationMarkdown(c), c).toBe(c);
    }
  });
});

describe("the trailer's links", () => {
  it("links what it stands behind", () => {
    const trailer = formatCitationTrailer([
      { citation: "7 CFR 273.5", status: "in_sources" },
    ]);
    expect(trailer).toContain("(https://www.ecfr.gov/current/title-7/part-273/section-273.5)");
  });

  it("leaves an unrecognized citation unlinked", () => {
    // "7 CFR 999.9" is well-formed enough to build a URL from, and that URL
    // is a 404. Linking the tier we have just called "likely an error" would
    // hand an invented citation the one thing that makes a citation look
    // real, and send the reader to a dead page to discover otherwise.
    const trailer = formatCitationTrailer([
      { citation: "7 CFR 999.9", status: "unrecognized" },
    ]);
    expect(trailer).toContain("7 CFR 999.9");
    expect(trailer).not.toContain("ecfr.gov");
  });

  it("still links the verified ones when a bad one is present", () => {
    const trailer = formatCitationTrailer([
      { citation: "7 CFR 273.5", status: "in_sources" },
      { citation: "7 CFR 999.9", status: "unrecognized" },
    ]);
    expect(trailer).toContain("section-273.5");
    expect(trailer).not.toContain("part-999");
  });
});
