// The assent notice is a legal control, so it is pinned like one.
//
// Terms reachable only from a footer link is browsewrap, which courts routinely
// decline to enforce. When the agreement falls, everything in it falls with it —
// the arbitration clause, the class waiver, the limitation of liability, and the
// disclaimer that Demeter is not an eligibility determination. The notice beside
// the composer and beside the sign-in button is what turns those from text into
// an agreement, which makes it exactly the kind of small UI string that must not
// quietly disappear in a redesign.
//
// It must exist in EVERY language. A Spanish-speaking user shown an English-only
// notice has not been given conspicuous notice, and Demeter's whole point is
// that it serves people in their own language.

import { describe, expect, it } from "vitest";
import { T } from "../demeter-chat-copy";
import { SIGNIN_T } from "../demeter-signin-copy";
import { TERMS_OF_SERVICE } from "../../legal";

const LOCALES = ["en", "es", "vi", "zh"] as const;

/** The parts must join into a sentence — no empty segments that would render as
 *  "you agree to and ." if a translation were half-filled. */
function assertWellFormed(parts: {
  before: string;
  terms: string;
  between: string;
  privacy: string;
  after: string;
}, label: string) {
  for (const [key, value] of Object.entries(parts)) {
    expect(value.length, `${label}.${key} is empty`).toBeGreaterThan(0);
  }
  const joined = parts.before + parts.terms + parts.between + parts.privacy + parts.after;
  expect(joined.length, `${label} is too short to be notice`).toBeGreaterThan(20);
}

describe("chat composer assent notice", () => {
  for (const locale of LOCALES) {
    it(`${locale} carries a complete notice`, () => {
      assertWellFormed(T[locale].termsNotice, `T.${locale}.termsNotice`);
    });
  }
});

describe("sign-in assent notice", () => {
  for (const locale of LOCALES) {
    it(`${locale} carries a complete notice`, () => {
      assertWellFormed(SIGNIN_T[locale].termsAssent, `SIGNIN_T.${locale}.termsAssent`);
    });
  }
});

describe("the Terms describe the mechanism the UI actually implements", () => {
  // If the UI notice says agreement happens at the composer and at sign-up, the
  // document must say the same thing. A Terms that claims assent by some other
  // route than the one the product uses is the defect that gets it struck.
  it("names sending a message and creating an account as the moments of assent", () => {
    const agreement = TERMS_OF_SERVICE.sections.find((s) => s.id === "agreement");
    const text = agreement!.blocks
      .map((b) => (b.kind === "p" || b.kind === "callout" ? b.text : ""))
      .join(" ");
    expect(text).toMatch(/send Demeter a message/i);
    expect(text).toMatch(/create an account/i);
    // The point is that it is NOT footer-only, and the document says so.
    expect(text).toMatch(/footer/i);
  });
});
