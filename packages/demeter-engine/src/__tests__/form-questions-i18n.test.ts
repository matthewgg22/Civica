import { describe, it, expect } from "vitest";
import { FORM_QUESTIONS } from "../form-questions";
import { FORM_QUESTION_I18N, untranslatedTopics, type TranslatedLang } from "../form-questions.i18n";
import { ANSWER_LANGS } from "../lang";

// Localized pages render these explanations as their FAQ. A form question that
// ships without translations would render English text under a /es, /vi or /zh
// URL — worse than not having the page at all, because a search engine reads
// that as duplicate content in the wrong language. This test is the gate.

const TRANSLATED: TranslatedLang[] = ANSWER_LANGS.filter(
  (l): l is TranslatedLang => l !== "en",
);

describe("form-question translations", () => {
  it("covers EVERY form question in EVERY non-English language", () => {
    const missing = untranslatedTopics(
      FORM_QUESTIONS.map((q) => q.topic),
      TRANSLATED,
    );
    expect(missing, `untranslated topics: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no orphaned translations for topics that no longer exist", () => {
    const topics = new Set(FORM_QUESTIONS.map((q) => q.topic));
    const orphans = Object.keys(FORM_QUESTION_I18N).filter((t) => !topics.has(t));
    expect(orphans, `orphaned: ${orphans.join(", ")}`).toEqual([]);
  });

  it("carries no dollar figures — translations must not rot at the COLA either", () => {
    for (const [topic, byLang] of Object.entries(FORM_QUESTION_I18N)) {
      for (const [lang, text] of Object.entries(byLang)) {
        expect(text, `${topic}/${lang}`).not.toMatch(/\$\s?\d/);
      }
    }
  });

  it("keeps citations OUT of the translated text (they render separately, verbatim)", () => {
    for (const [topic, byLang] of Object.entries(FORM_QUESTION_I18N)) {
      for (const [lang, text] of Object.entries(byLang)) {
        expect(text, `${topic}/${lang}`).not.toMatch(/\bCFR\b/);
      }
    }
  });
});
