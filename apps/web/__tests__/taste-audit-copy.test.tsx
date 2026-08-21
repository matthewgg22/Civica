// @vitest-environment jsdom
//
// Taste-audit findings 1 and 2 (2026-08-21, Leonxlnx/taste-skill run).
//
// FINDING 1 (a bug, not taste): the state map's screen-reader fallback — the
// dmx__sronly roster in SnapDetail — rendered pack.program and pack.agency
// RAW. Those fields are written for the MODEL (issue #761 documents the
// drift), so a screen-reader user got the research annexe read aloud:
// "see PROVENANCE.md Finding 8", "NOTE the acronym collision…", "the OPPOSITE
// of North Carolina's pack". The one audience that receives the text version
// of the map received the internal annotations. The visible map panel had the
// same leak on its AGENCY line (program was already cleaned through
// programDisplayName; agency was not).
//
// FINDING 2: 19 visible em-dashes on the page — the skill's hardest ban, and
// the character most recognized as AI-written text. Demeter's voice keeps a
// BUDGET rather than a ban: the few dashes that carry a genuine beat stay,
// the ones doing comma-or-period work were rewritten. This test pins the
// budget so the count cannot silently creep back up.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

import { SnapDetail } from "../components/SnapOverview";
import { agencyDisplayName } from "../lib/program-name";
import { PAGE_COPY } from "../lib/i18n/snap-page";

describe("the screen-reader state roster is user copy, not the research annexe (finding 1)", () => {
  it("renders no provenance annotations anywhere in the section", () => {
    const { container } = render(<SnapDetail states={VERIFIED_STATES} />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/PROVENANCE\.md/i);
    expect(text).not.toMatch(/OPPOSITE of/);
    expect(text).not.toMatch(/acronym collision/i);
    expect(text).not.toMatch(/LEGACY/);
  });

  it("every roster line is a name, an agency and a portal — not a paragraph", () => {
    const { container } = render(<SnapDetail states={VERIFIED_STATES} />);
    const items = [...container.querySelectorAll(".dmx__sronly li")];
    expect(items.length).toBeGreaterThanOrEqual(50);
    for (const li of items) {
      const line = li.textContent ?? "";
      // The Missouri entry alone ran ~480 characters of naming history before
      // the fix. A cleaned line — code, program, agency, portal — fits well
      // under this bound for every jurisdiction.
      expect(line.length, line.slice(0, 80)).toBeLessThanOrEqual(160);
    }
  });

  it("agencyDisplayName cuts annotation the way programDisplayName does", () => {
    expect(
      agencyDisplayName(
        "Minnesota Department of Children, Youth, and Families (DCYF) — but the Combined Manual itself is still hosted on the LEGACY Department of Human Services (DHS) domain",
      ),
    ).toBe("Minnesota Department of Children, Youth, and Families (DCYF)");
    // A depth-0 dash inside a division name cuts too — shorter but still
    // accurate beats longer with the annexe attached.
    expect(
      agencyDisplayName(
        "Washington State Department of Social and Health Services (DSHS), Economic Services Administration — Community Services Division",
      ),
    ).toBe("Washington State Department of Social and Health Services (DSHS), Economic Services Administration");
    expect(agencyDisplayName("Department of Transitional Assistance (DTA)")).toBe(
      "Department of Transitional Assistance (DTA)",
    );
  });

  it("the visible map panel also cleans the agency line", () => {
    const src = readFileSync(join(__dirname, "..", "components", "UsCoverageMap.tsx"), "utf8");
    expect(src).toContain("agencyDisplayName(");
    // The raw field must not reach either render site.
    expect(src).not.toMatch(/\{chosen\.agency\}/);
  });
});

describe("visible em-dashes stay inside the budget (finding 2)", () => {
  it("the English page copy carries at most 4", () => {
    const en = JSON.stringify(PAGE_COPY.en);
    const count = (en.match(/—/g) ?? []).length;
    expect(count).toBeLessThanOrEqual(4);
  });

  it("the copy is American English", () => {
    const en = JSON.stringify(PAGE_COPY.en);
    expect(en).not.toMatch(/programme|neighbouring/);
  });
});
