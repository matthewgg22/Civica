import { describe, expect, it } from "vitest";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { hasLocalProgramName, primaryAgency, programDisplayName, splitPortalName } from "../lib/program-name";

// The point of this file: the card headline is derived from a corpus field
// written for the model, so the derivation is a guess that must be checked
// against the real data rather than against invented examples.
describe("programDisplayName", () => {
  it("leaves a name that is already just a name alone", () => {
    expect(programDisplayName("CalFresh")).toBe("CalFresh");
    expect(programDisplayName("Basic Food")).toBe("Basic Food");
    expect(programDisplayName("SNAP Food Benefits")).toBe("SNAP Food Benefits");
  });

  it("keeps a short parenthetical, which is part of the name", () => {
    expect(programDisplayName("Food Assistance Program (FAP) — Michigan's name for SNAP"))
      .toBe("Food Assistance Program (FAP)");
  });

  it("drops a parenthetical that is prose about the name", () => {
    expect(programDisplayName("FoodShare (Wisconsin's name for SNAP)")).toBe("FoodShare");
    expect(programDisplayName("SNAP (no state-specific branding)")).toBe("SNAP");
  });

  it("does not cut at an em-dash inside parentheses", () => {
    // Cutting here would strand an open bracket.
    expect(programDisplayName("SNAP (formerly Food Stamps — the old name persists in Georgia usage)"))
      .toBe("SNAP");
  });

  // The guard that matters: every shipped pack, not a curated sample.
  it.each(VERIFIED_STATES.map((p) => [p.code, p.program] as const))(
    "%s renders as a name, not a sentence",
    (code, program) => {
      const shown = programDisplayName(program);
      expect(shown.length, `${code} headline is too long to be a name`).toBeLessThanOrEqual(50);
      expect(shown, `${code} kept an annotation clause`).not.toMatch(/—/);
      expect(shown, `${code} kept a quote from the annotation`).not.toMatch(/["']/);
      // Brackets must balance — the failure mode of cutting in the wrong place.
      const opens = (shown.match(/\(/g) ?? []).length;
      const closes = (shown.match(/\)/g) ?? []).length;
      expect(opens, `${code} has unbalanced brackets: ${shown}`).toBe(closes);
    },
  );
});

// ── What /verify decided NOT to print ───────────────────────────────────────
// The three helpers below are subtractions, and each one exists because the
// state directory was showing a field simply because the packs had one.

describe("hasLocalProgramName", () => {
  it("is false when the state just calls it SNAP", () => {
    expect(hasLocalProgramName("SNAP")).toBe(false);
    expect(hasLocalProgramName("Supplemental Nutrition Assistance Program (SNAP)")).toBe(false);
    expect(hasLocalProgramName("Supplemental Nutrition Assistance Program")).toBe(false);
  });

  it("is true for a name the state actually chose", () => {
    for (const p of ["CalFresh", "Basic Food", "FoodShare", "3SquaresVT", "Nutrition Assistance (NA)"]) {
      expect(hasLocalProgramName(p), p).toBe(true);
    }
  });

  it("counts SNAP-derived branding as local — the state picked those words", () => {
    expect(hasLocalProgramName("SNAP Food Benefits")).toBe(true); // TX
    expect(hasLocalProgramName("NJ SNAP")).toBe(true);
  });

  it("sees through the corpus annotation, not just the raw string", () => {
    // "SNAP (no state-specific branding)" is SNAP. If this read the raw field
    // it would call that a local name and print it.
    expect(hasLocalProgramName("SNAP (no state-specific branding)")).toBe(false);
    expect(hasLocalProgramName("FoodShare (Wisconsin's name for SNAP)")).toBe(true);
  });

  it("leaves most of the shipped packs out, which is the point", () => {
    const local = VERIFIED_STATES.filter((p) => hasLocalProgramName(p.program));
    // A rule that hid everything, or nothing, would pass every test above.
    expect(local.length).toBeGreaterThan(3);
    expect(local.length).toBeLessThan(VERIFIED_STATES.length / 2);
    expect(local.map((p) => p.code)).toContain("CA");
    expect(local.map((p) => p.code)).not.toContain("AL");
  });
});

describe("primaryAgency", () => {
  it("keeps the department and drops the divisions under it", () => {
    expect(primaryAgency("Alabama Department of Human Resources (DHR), Food Assistance Division"))
      .toBe("Alabama Department of Human Resources (DHR)");
    expect(
      primaryAgency(
        "Kentucky Cabinet for Health and Family Services (CHFS), Department for Community Based Services (DCBS), Division of Family Support (DFS), Nutrition Assistance Branch (NAB)",
      ),
    ).toBe("Kentucky Cabinet for Health and Family Services (CHFS)");
  });

  it("cuts at a slash as well as a comma", () => {
    expect(
      primaryAgency(
        "North Carolina Department of Health and Human Services (NCDHHS), Division of Social Services / Division of Child and Family Well-Being",
      ),
    ).toBe("North Carolina Department of Health and Human Services (NCDHHS)");
  });

  it("leaves an agency with no acronym alone", () => {
    expect(primaryAgency("Nevada Division of Welfare and Supportive Services"))
      .toBe("Nevada Division of Welfare and Supportive Services");
  });

  it("removes the corpus annexe even when the org-chart cut does not fire", () => {
    // The reason this helper calls agencyDisplayName itself. The annexe is
    // introduced by an em-dash with no comma after the acronym, so the cut
    // below it never matches — a caller composing these by hand would have
    // published the annexe the one time it mattered.
    expect(
      primaryAgency(
        "Minnesota Department of Children, Youth, and Families (DCYF) — but the Combined Manual itself is still hosted on the LEGACY DHS domain",
      ),
    ).not.toMatch(/LEGACY/);
  });

  it("is idempotent, so double-wrapping is harmless", () => {
    for (const p of VERIFIED_STATES) {
      const once = primaryAgency(p.agency);
      expect(primaryAgency(once), p.code).toBe(once);
    }
  });

  it("gets every shipped pack down to something a row can hold", () => {
    for (const p of VERIFIED_STATES) {
      const shown = primaryAgency(p.agency);
      expect(shown.length, `${p.code}: ${shown}`).toBeLessThanOrEqual(80);
      expect(shown, `${p.code} kept an annexe`).not.toMatch(/—/);
      const opens = (shown.match(/\(/g) ?? []).length;
      const closes = (shown.match(/\)/g) ?? []).length;
      expect(opens, `${p.code} has unbalanced brackets: ${shown}`).toBe(closes);
    }
  });
});

describe("splitPortalName", () => {
  it("lifts a prose parenthetical out of the label but keeps it", () => {
    expect(splitPortalName("PAIS (Hawaii DHS SNAP/TANF Application Portal)")).toEqual({
      label: "PAIS",
      note: "Hawaii DHS SNAP/TANF Application Portal",
    });
  });

  it("never drops a note that is the only warning on the row", () => {
    // The two that must survive: Wyoming has no online application at all,
    // and New York's portal does not cover New York City.
    expect(splitPortalName("Wyoming DFS SNAP (paper application only — no online portal found)").note)
      .toMatch(/paper application only/);
    expect(splitPortalName("myBenefits.ny.gov (statewide EXCEPT NYC; NYC uses ACCESS HRA)").note)
      .toMatch(/NYC/);
  });

  it("leaves a short parenthetical in the name, where it belongs", () => {
    expect(splitPortalName("Health-e-Arizona Plus (HEAplus)")).toEqual({
      label: "Health-e-Arizona Plus (HEAplus)",
      note: null,
    });
    expect(splitPortalName("kynect benefits (benefind.ky.gov)").note).toBeNull();
  });

  it("only cuts a TRAILING parenthetical", () => {
    // "ConneCT (connect.ct.gov) / MyDSS" is one name; cutting mid-string would
    // strand "/ MyDSS" as a note that reads like a second portal.
    expect(splitPortalName("ConneCT (connect.ct.gov) / MyDSS")).toEqual({
      label: "ConneCT (connect.ct.gov) / MyDSS",
      note: null,
    });
  });

  it("never loses a character across the shipped packs", () => {
    for (const p of VERIFIED_STATES) {
      if (!p.portal) continue;
      const { label, note } = splitPortalName(p.portal.name);
      expect(p.portal.name, p.code).toContain(label);
      if (note) expect(p.portal.name, p.code).toContain(note);
      expect(label.length, `${p.code} label is empty`).toBeGreaterThan(0);
    }
  });
});
