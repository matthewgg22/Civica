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
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_STATES } from "@civica/demeter-engine/packs";

import { SnapDetail } from "../components/SnapOverview";
import { DemeterStatePicker } from "../components/DemeterStatePicker";
import { T } from "../lib/i18n/demeter-chat-copy";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { agencyDisplayName } from "../lib/program-name";

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
      // The annotation always rides behind an em-dash in the pack fields, so
      // "no em-dash in a roster line" IS the invariant — length alone cannot
      // separate clean from annotated (Illinois' legitimate line runs 212;
      // Colorado's annotated one ran about the same). The loose bound only
      // backstops a future field that dodges the dash: Missouri's annotated
      // entry ran ~480 characters.
      expect(line, line.slice(0, 80)).not.toContain("—");
      expect(line.length, line.slice(0, 80)).toBeLessThanOrEqual(300);
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

// FINDING 1, third render site (2026-08-22). The audit cleaned the map panel
// and the screen-reader roster; the STATE PICKER's dropdown was missed and
// kept rendering pack.agency raw. Washington's is the test case
// agencyDisplayName itself uses — the annotation ran the row to four lines
// in the rail, which is how it was noticed.
describe("the state picker's dropdown is user copy too (finding 1, third site)", () => {
  it("renders no provenance annotation in any option, and no em-dash tail", async () => {
    const { container } = render(
      <DemeterStatePicker
        states={VERIFIED_STATES}
        value={null}
        onChange={() => {}}
        copy={T.en.picker}
        hint={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: T.en.picker.label }));
    // The federal row's sub-line is AUTHORED copy ("Federal floor — state
    // figures deferred to your agency") and its em-dash is legitimate; only
    // the pack-derived agency lines are under test here.
    const subs = [...container.querySelectorAll(".dmst__opt-sub")].filter(
      (el) => el.textContent !== T.en.picker.federalHint,
    );
    expect(subs.length).toBeGreaterThan(10);
    for (const sub of subs) {
      const line = sub.textContent ?? "";
      // The annotation always rides behind an em-dash in these fields.
      expect(line, line.slice(0, 60)).not.toContain("—");
      expect(line, line.slice(0, 60)).not.toMatch(/PROVENANCE|LEGACY|OPPOSITE of/i);
    }
  });

  it("keeps every agency line to one row so the list stays scannable", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
    const rule = css.match(/\.dmst__opt-sub\s*\{[^}]*\}/)?.[0] ?? "";
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule).toMatch(/white-space:\s*nowrap/);
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

// Findings 4, 5, 6 (same audit, second batch).
//
// FINDING 5: the hero's missing visual is the product itself — a REAL Demeter
// answer (generated through the actual pipeline, shortened for space, and
// labeled as exactly that) rendered server-side beside the orientation bar.
// It is simultaneously the page's only product demonstration and the proof of
// "every claim cited". It also resolves the standing taste call on the empty
// top-right at desktop (#715).
//
// FINDING 4: two CTAs carried the same intent under different labels ("Ask
// Demeter about your situation" up top, "Worried about something else? Ask
// Demeter" at the bottom). One label per intent, everywhere.
//
// FINDING 6: differentiated the two adjacent definition-grid sections — the
// trust list now reads label-left / body-right, a different family from the
// stacked cells of "What SNAP is". ("How Demeter answers" was already a
// numbered pipeline; the audit's 4× count was 2× on recount.)
import { SnapOrientation, SnapFears } from "../components/SnapOverview";

describe("the hero's right column is the way in (finding 5, twice evolved)", () => {
  // HISTORY, because this ground has moved three times. Finding 5 put ONE
  // real answer beside the hero (the card first shipped WITHOUT a ✓ until
  // the retrieval cluster made the pipeline earn it — #766/#785/#915). The
  // 2026-08-21 request made it a rotation of three. The owner redesign the
  // same week replaced the demo with the PRODUCT: a mini chat that hands
  // off to /chat. The exchanges did not die — their questions are the
  // starter chips, and the data tests below still pin their quality.
  it("the mini chat rides beside the hero and hands off to the one chat", () => {
    const { container } = render(<SnapOrientation />);
    const ex = container.querySelector(".dmex");
    expect(ex).toBeTruthy();
    expect(ex!.querySelector("form.dmc")).toBeTruthy();
    expect(ex!.querySelector("form.dmc")!.getAttribute("action")).toBe("/chat");
  });

  it("every language keeps three vetted exchanges, each cited, each with its earned verdict", () => {
    // These are the STARTER BANK now: the chips offer their questions, and
    // the reason these three questions are offered at all is that their
    // answers were regenerated through the live pipeline and every one
    // graded certainty=certain. The standing rule is per-item: an exchange
    // that does not grade CERTAIN loses its verdict field — and its seat.
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const ex = PAGE_COPY[lang].example;
      expect(ex.items.length, lang).toBe(3);
      for (const [i, item] of ex.items.entries()) {
        expect(item.q.trim(), `${lang}[${i}].q`).toBeTruthy();
        expect(item.a, `${lang}[${i}] cites`).toMatch(/7 CFR 273\.\d/);
        expect(item.verdict, `${lang}[${i}] verdict`).toContain("✓");
        // The no-invented-dollars rule covers every exchange.
        expect(item.a + item.q, `${lang}[${i}] no dollars`).not.toMatch(/\$\s?\d/);
      }
    }
  });

  it("the card label survives in every language without invented figures", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const ex = PAGE_COPY[lang].example;
      expect(ex, lang).toBeTruthy();
      expect(String(ex.label).trim(), lang).not.toBe("");
      expect(String(ex.label), lang).not.toMatch(/\$\s?\d/);
    }
  });
});

describe("one label per intent (finding 4)", () => {
  it("the bottom ask-CTA repeats the top's label in every language", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      expect(PAGE_COPY[lang].fearsCta, lang).toBe(PAGE_COPY[lang].askLink);
    }
  });

  it("and the fears section actually renders it", () => {
    const { container } = render(<SnapFears />);
    expect(container.querySelector(".dmfear__ctalabel")?.textContent).toBe(
      PAGE_COPY.en.askLink,
    );
  });
});

describe("the two definition grids are two families now (finding 6)", () => {
  it("trust rows run label-left, body-right", () => {
    const css = readFileSync(join(__dirname, "..", "app", "globals.css"), "utf8");
    expect(css).toMatch(/\.dmx__trustrow\s*\{[^}]*grid-template-columns/);
  });
});
