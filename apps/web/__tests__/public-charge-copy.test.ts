// The highest-stakes sentence in the product, and one with a known expiry.
//
// DHS rescinded the 2022 public charge rule effective 2026-09-18. The previous
// answer — "For most families, no. SNAP isn't counted as a public charge" — was
// accurate when written and becomes wrong on that date, in five languages, on a
// page that is live in production, aimed at exactly the households least able
// to absorb being wrong.
//
// It must not swing to a flat warning either: that would suppress enrollment
// among people who remain perfectly eligible. What it has to do is name the
// date and route to someone qualified.
import { describe, expect, it } from "vitest";
import { welcomeStrings } from "../lib/i18n/snap-copy";

const LANGS = Object.keys(welcomeStrings) as Array<keyof typeof welcomeStrings>;

describe("the public charge answer", () => {
  it("gives no flat reassurance, in any language", () => {
    for (const lang of LANGS) {
      const a = welcomeStrings[lang].home_faq_a5;
      expect(a, `${lang} is empty`).toBeTruthy();
      // The exact phrasing that shipped, and the shape of it.
      expect(a, `${lang} still reassures flatly`).not.toMatch(
        /isn't counted as a "?public charge/i,
      );
      expect(a, `${lang} opens with a bare "no"`).not.toMatch(/^\s*(For most families, )?no[.,]/i);
    }
  });

  it("names the effective date, so no locale keeps the old promise", () => {
    for (const lang of LANGS) {
      expect(welcomeStrings[lang].home_faq_a5, `${lang} lost the date`).toMatch(/2026/);
    }
  });

  it("routes to immigration legal aid rather than to us or a caseworker", () => {
    // A caseworker is not an immigration lawyer, and neither are we. Getting
    // this wrong costs someone their status, not their groceries.
    for (const lang of LANGS) {
      const a = welcomeStrings[lang].home_faq_a5.toLowerCase();
      expect(
        /legal aid|legal|jurídic|法律|pháp lý/.test(a),
        `${lang} does not point anywhere`,
      ).toBe(true);
    }
  });

  it("is long enough to be careful", () => {
    // A short answer here is a confident one, and confidence is the failure.
    for (const lang of LANGS) {
      expect(welcomeStrings[lang].home_faq_a5.length, `${lang} too short`).toBeGreaterThan(90);
    }
  });
});
