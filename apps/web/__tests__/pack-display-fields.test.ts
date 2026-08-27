// Every pack carries its own reader-facing fields.
//
// program / agency / portal.name are written for the MODEL: corpus annotation
// behind em-dashes, division chains up to 211 characters, parentheticals that
// are sometimes an acronym expansion and sometimes the only warning on a row.
// Six surfaces used to cut that text at render time, which is why the same
// leak was found and fixed four separate times (#931).
//
// The cut now happens once, into the pack
// (scripts/backfill-pack-display-fields.ts). That is only safe while EVERY
// pack has the fields — a pack merged without them would render undefined, or
// send a future author back to render-time surgery. Hence this file.
import { describe, expect, it } from "vitest";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

describe("every shipped pack has a reader-facing form", () => {
  it.each(VERIFIED_STATES.map((p) => [p.code, p] as const))(
    "%s carries programShort and agencyShort",
    (code, pack) => {
      expect(pack.programShort, `${code} has no programShort`).toBeTruthy();
      expect(pack.agencyShort, `${code} has no agencyShort`).toBeTruthy();
    },
  );

  it.each(VERIFIED_STATES.map((p) => [p.code, p] as const))(
    "%s's short forms are names, not sentences",
    (code, pack) => {
      // The two failure modes the raw fields have: an annexe behind an
      // em-dash, and an org chart after the department.
      expect(pack.programShort, `${code} kept an annexe`).not.toMatch(/—/);
      expect(pack.agencyShort, `${code} kept an annexe`).not.toMatch(/—/);
      expect(pack.programShort.length, `${code}: ${pack.programShort}`).toBeLessThanOrEqual(50);
      expect(pack.agencyShort.length, `${code}: ${pack.agencyShort}`).toBeLessThanOrEqual(80);
      for (const v of [pack.programShort, pack.agencyShort]) {
        expect((v.match(/\(/g) ?? []).length, `${code} unbalanced: ${v}`).toBe(
          (v.match(/\)/g) ?? []).length,
        );
      }
    },
  );

  it("short forms are drawn from the real field, never invented", () => {
    // The generated ones are substrings by construction; a hand-corrected one
    // should still be, and a short form that shares nothing with the field it
    // describes is a mistake worth failing on.
    for (const p of VERIFIED_STATES) {
      expect(p.agency, `${p.code}: ${p.agencyShort}`).toContain(p.agencyShort);
    }
  });

  it("a portal carries its own short form", () => {
    for (const p of VERIFIED_STATES) {
      if (!p.portal) continue;
      expect(p.portal.short, `${p.code} portal has no short form`).toBeTruthy();
      expect(p.portal.name, `${p.code} invented a portal name`).toContain(p.portal.short);
      if (p.portal.note) expect(p.portal.name, `${p.code} invented a note`).toContain(p.portal.note);
    }
  });

  it("a jurisdiction with no portal SAYS why", () => {
    // Otherwise the row shows an Ask link and nothing else, and reads as a gap
    // in our data rather than as a fact about the place. USVI has no web
    // submission at all: the form is printed, picked up or mailed, then filed
    // at an office. If a future pack lands with no portal and no note, this
    // fails rather than shipping a row that looks broken.
    for (const p of VERIFIED_STATES) {
      if (p.portal) continue;
      expect(p.applyNote, `${p.code} has no portal and does not say why`).toBeTruthy();
    }
  });

  it("applyNote is only for the portal-less — it is not a second caveat slot", () => {
    for (const p of VERIFIED_STATES) {
      if (p.portal) expect(p.applyNote, `${p.code} has both`).toBeUndefined();
    }
  });
});
