import { describe, it, expect } from "vitest";
import { extractCitations, verifyCitations, formatCitationTrailer } from "../citation-verifier";

describe("Mae citation verifier", () => {
  it("extracts CFR, ACL/ACIN, and statute citations", () => {
    const text =
      "Per 7 CFR 273.9(d)(2) and CDSS ACL 25-68 and ACIN I-46-25, and Pub. L. 119-21, see 8 CFR 212.21.";
    const cites = extractCitations(text);
    expect(cites).toContain("7 CFR 273.9(d)(2)");
    expect(cites).toContain("8 CFR 212.21");
    expect(cites).toContain("ACL 25-68");
    expect(cites).toContain("ACIN I-46-25");
    expect(cites).toContain("Pub. L. 119-21");
  });

  it("classifies citations into in_sources / known / unrecognized", () => {
    const retrieved = ["7 CFR 273.9(d)(6)", "7 CFR 273.9(d)"];
    const answer =
      "Shelter is 7 CFR 273.9(d)(6); benefit math is 7 CFR 273.10; also 7 CFR 273.99(z); ACL 25-68; ACL 99-99; 8 CFR 212.21.";
    const byCite = Object.fromEntries(verifyCitations(answer, retrieved).map((c) => [c.citation, c.status]));
    expect(byCite["7 CFR 273.9(d)(6)"]).toBe("in_sources"); // in the retrieved text
    expect(byCite["7 CFR 273.10"]).toBe("known"); // corpus section, not retrieved here
    expect(byCite["7 CFR 273.99(z)"]).toBe("unrecognized"); // invented
    expect(byCite["ACL 25-68"]).toBe("known");
    expect(byCite["ACL 99-99"]).toBe("unrecognized"); // invented ACL
    expect(byCite["8 CFR 212.21"]).toBe("known");
  });

  it("trailer flags unrecognized citations loudly and is empty when there are none", () => {
    expect(formatCitationTrailer([])).toBe("");
    const trailer = formatCitationTrailer([
      { citation: "7 CFR 273.9(d)(6)", status: "in_sources" },
      { citation: "ACL 25-68", status: "known" },
      { citation: "7 CFR 273.99", status: "unrecognized" },
    ]);
    expect(trailer).toContain("Citation check");
    expect(trailer).toContain("⚠️");
    expect(trailer).toContain("7 CFR 273.99"); // the bad one is named
    expect(trailer).toContain("✓");
    expect(trailer).toContain("◑");
  });
});
