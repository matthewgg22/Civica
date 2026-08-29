// THE STRINGS WHERE A MISTRANSLATION IS A BROKEN PROMISE, NOT AWKWARD COPY.
//
// Key-set parity — what the existing i18n tests check — cannot see meaning. es,
// vi and zh can each carry a fluent, well-formed sentence that promises
// something English never promised, and every suite stays green. That is not
// hypothetical: #1078 was exactly this. From the day the four locales landed
// together (#778), en offered to "gather your answers into an application
// outline" while es, vi and zh all offered to work out a DOLLAR FIGURE. Three
// languages made the louder claim for months, unseen, and the product is
// careful everywhere else to say "an estimate, not a decision".
//
// This pins the en text of the strings that make a commitment to the reader —
// what Demeter will do, what it keeps, what it is not. Changing one fails this
// test, and the failure is the reminder: THREE OTHER LOCALES SAY THIS TOO.
//
// WHAT IT CANNOT DO, stated plainly so nobody trusts it further than it goes:
// it cannot tell whether a translation is faithful. It catches en moving ahead
// of the other locales; it would NOT have caught #1078, where the translations
// were wrong from birth. Only a reader of the language catches that. This
// narrows the window, it does not close it.

import { describe, it, expect } from "vitest";
import { T } from "../demeter-chat-copy";

const LOCALES = ["es", "vi", "zh"] as const;

/**
 * en text -> why it is load-bearing. Update BOTH sides deliberately: change the
 * string here only after deciding what the other three locales should now say.
 */
const PROMISES: Array<[string, string, string]> = [
  [
    "modeOffer",
    "Want me to gather your answers into an application outline as we go?",
    "Promises an OUTLINE, not a dollar figure. This is the #1078 string.",
  ],
  [
    "modeOfferEstimate",
    "Gather my answers",
    "The button that accepts the offer above; it must accept the same thing.",
  ],
  [
    "emptyLede",
    "I can help you see whether you’re likely to qualify and build up your application as we go, quoting the rule behind every answer, so you can check it.",
    "'likely to qualify', never 'find out if you are eligible' — the claim the product is built to avoid.",
  ],
  [
    "clearNote",
    "Removes it from this browser. We still keep the question and answer to check our accuracy.",
    "Says retention out loud. Saying 'clear' without it is the retention lie #703 fixed.",
  ],
  [
    "piiHint",
    "Please don’t type your Social Security number or bank details.",
    "Names what redactPii cannot save someone from.",
  ],
  [
    "disclaimer",
    "Demeter is AI and can make mistakes. Please double-check cited sources and",
    "The AI disclosure. A softer translation is a weaker disclosure.",
  ],
];

const NESTED_PROMISES: Array<[string, string, string]> = [
  [
    "welcome.body",
    "Every answer quotes the rule it came from, so you can check it.",
    "The core claim: every answer is checkable.",
  ],
  [
    "welcome.bodyTwo",
    "Demeter is not the government and cannot decide your case.",
    "What Demeter is NOT. The most consequential sentence to get wrong.",
  ],
  [
    "worksheet.disclaimer",
    "An estimate, not a decision.",
    "Separates this from an eligibility determination.",
  ],
  [
    "worksheet.privacy",
    "An estimate, not a decision. We keep the text to check our accuracy, so avoid names.",
    "Retention plus the ask not to type names.",
  ],
];

function at(path: string): string {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], T.en) as string;
}

describe("promise-bearing en strings", () => {
  for (const [key, expected, why] of [...PROMISES, ...NESTED_PROMISES]) {
    it(`${key} is unchanged (${why})`, () => {
      expect(
        at(key),
        `en.${key} changed. ${why}\nBefore updating this test, decide what es/vi/zh should now say — all three carry this string too.`,
      ).toBe(expected);
    });
  }

  // A translation may be longer or shorter, but an EMPTY or untranslated one
  // means the reader gets English or nothing where a promise should be.
  it("every locale actually carries these strings", () => {
    for (const [key] of [...PROMISES, ...NESTED_PROMISES]) {
      for (const locale of LOCALES) {
        const value = key
          .split(".")
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], T[locale]) as string;
        expect(value?.trim(), `${locale}.${key} is missing or empty`).toBeTruthy();
        expect(value, `${locale}.${key} is still the English string`).not.toBe(at(key));
      }
    }
  });
});
