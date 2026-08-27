// @vitest-environment jsdom
//
// Two from the 2026-08-27 round.
//
// "when i clicked california seems like i am being booted to go their instead
//  of actually continuing"
// The message that follows picking a state opened "In California, you apply
// through CDSS" — a destination, arriving one tap after "Yes, use California".
// The fact is fine; leading with it instead of with an acknowledgement is what
// reads as a handoff.
//
// "when i pout in new prompt those top question bars disappeared and
//  immediately reappered"
// The mode bar was gated on `!busy`, so it unmounted on send and remounted
// when the answer landed — once per turn, taking the layout with it.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { T } from "../../lib/i18n/demeter-chat-copy";

const src = readFileSync(join(__dirname, "..", "DemeterChat.tsx"), "utf8");
const LANGS = ["en", "es", "vi", "zh"] as const;

describe("picking a state is answered, not redirected", () => {
  it("names the state before it names the destination, in every language", () => {
    for (const lang of LANGS) {
      const lead = T[lang].portalLead;
      expect(lead, `${lang} portalLead`).toContain("{state}");
      expect(lead, `${lang} portalLead`).toContain("{agency}");
      // The state has to come FIRST — that is the whole difference between
      // "California it is, applications go through CDSS" and "In California,
      // you apply through CDSS".
      expect(
        lead.indexOf("{state}"),
        `${lang}: the destination arrives before the acknowledgement`,
      ).toBeLessThan(lead.indexOf("{agency}"));
      expect(lead.trim().startsWith("{state}") || /^[^{]{0,4}\{state\}/.test(lead.trim()),
        `${lang}: something precedes the acknowledgement`).toBe(true);
    }
  });

  it("still says where the application actually goes", () => {
    // Softening must not cost the reader the fact.
    for (const lang of LANGS) {
      expect(T[lang].portalCta).toContain("{portal}");
      expect(T[lang].portalStay.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("the offer bar holds its place", () => {
  it("is not unmounted while an answer streams", () => {
    const i = src.indexOf("const showModeOffer =");
    expect(i, "showModeOffer").toBeGreaterThan(-1);
    const block = src.slice(i, src.indexOf(";", src.indexOf("MODE_REOFFER_AFTER_TURNS", i)));
    expect(block, "the bar still unmounts on send").not.toContain("!busy");
  });

  it("but is not tappable mid-answer either", () => {
    // Switching mode against a half-written turn would set the rail
    // extracting from it. Holding position is the fix, not enabling the tap.
    const i = src.indexOf('className="demeter__modeoffer-actions"');
    const block = src.slice(i, src.indexOf("</span>", i));
    expect((block.match(/disabled=\{busy\}/g) ?? []).length, "both buttons stand down").toBe(2);
  });
});
