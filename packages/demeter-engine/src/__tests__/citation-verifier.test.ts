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
    expect(trailer).toContain("Citation:");
    expect(trailer).toContain("⚠️");
    expect(trailer).toContain("7 CFR 273.99"); // the bad one is named
    expect(trailer).toContain("✓");
    expect(trailer).toContain("◑");
  });

  it("renders the trailer in Spanish when the answer language is es", () => {
    const checks = [
      { citation: "7 CFR 273.10", status: "known" as const },
      { citation: "7 CFR 273.99", status: "unrecognized" as const },
    ];
    const es = formatCitationTrailer(checks, "es");
    expect(es).toContain("Citas:");
    expect(es).toContain("autoridad reconocida");
    expect(es).toContain("NO reconocida");
    expect(es).not.toContain("recognized authority");
    // Default stays English.
    expect(formatCitationTrailer(checks)).toContain("Citation:");
  });

  it("recognizes the verification-limits authority cluster the ME reviewers actually cite", () => {
    const byCite = Object.fromEntries(
      verifyCitations(
        "Verify only what is required or questionable — MPP 63-300.5(j), ACL 20-48, ACL 21-24, ACIN I-45-11; confirm TWN per ACL 23-53.",
        [],
      ).map((c) => [c.citation, c.status]),
    );
    expect(byCite["MPP 63-300.5(j)"]).toBe("known"); // resolves to section MPP 63-300
    expect(byCite["ACL 20-48"]).toBe("known");
    expect(byCite["ACL 21-24"]).toBe("known");
    expect(byCite["ACIN I-45-11"]).toBe("known");
    expect(byCite["ACL 23-53"]).toBe("known");
  });

  it("extracts MPP citations at all (they were previously invisible to the verifier)", () => {
    const cites = extractCitations("Per MPP 63-504.23 the denial NOA is due by day 30; see also MPP 20-006.");
    expect(cites).toContain("MPP 63-504.23");
    expect(cites).toContain("MPP 20-006");
  });

  it("extracts and recognizes FNS Handbook citations (#585 supplements cite them)", () => {
    const cites = extractCitations(
      "Per FNS Handbook 310 §1350.2 all listed reasons must be accurate; sampling is FNS Handbook 311.",
    );
    expect(cites).toContain("FNS Handbook 310 §1350.2");
    expect(cites).toContain("FNS Handbook 311");
    const byCite = Object.fromEntries(
      verifyCitations("See FNS Handbook 310 §1320 and FNS Handbook 311.", []).map((c) => [
        c.citation,
        c.status,
      ]),
    );
    expect(byCite["FNS Handbook 310 §1320"]).toBe("known");
    expect(byCite["FNS Handbook 311"]).toBe("known");
  });

  it("flags an invented FNS Handbook number as unrecognized", () => {
    const byCite = Object.fromEntries(
      verifyCitations("See FNS Handbook 399.", []).map((c) => [c.citation, c.status]),
    );
    expect(byCite["FNS Handbook 399"]).toBe("unrecognized");
  });

  it("flags an invented MPP section as unrecognized", () => {
    const byCite = Object.fromEntries(
      verifyCitations("See MPP 99-999.", []).map((c) => [c.citation, c.status]),
    );
    expect(byCite["MPP 99-999"]).toBe("unrecognized");
  });
});
