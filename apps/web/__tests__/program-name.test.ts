import { describe, expect, it } from "vitest";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";
import { programDisplayName } from "../lib/program-name";

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
