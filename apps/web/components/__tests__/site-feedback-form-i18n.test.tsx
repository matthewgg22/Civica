// @vitest-environment jsdom
//
// The feedback form was English-only; it now reads in the language of the
// /[lang]/feedback page that mounts it (launch audit 2026-08-28). These pin
// that the labels localize, that the category VALUES stay the English enum the
// API stores (only the labels translate), and that all four languages carry
// complete, non-empty copy.
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { SiteFeedbackForm } from "../SiteFeedbackForm";
import { FEEDBACK_COPY } from "../../lib/i18n/feedback-copy";

afterEach(cleanup);

describe("SiteFeedbackForm localization", () => {
  it.each(["es", "vi", "zh"] as const)("renders %s copy, not English", (lang) => {
    const c = FEEDBACK_COPY[lang];
    const { container } = render(<SiteFeedbackForm lang={lang} />);
    expect(container.textContent).toContain(c.messageLabel);
    expect(container.textContent).toContain(c.emailLabel);
    expect(container.querySelector("button.fbform__submit")?.textContent).toBe(c.send);
    // The English default must not leak through.
    expect(container.textContent).not.toContain(FEEDBACK_COPY.en.messageLabel);
  });

  it("keeps category option VALUES as the English enum in every language", () => {
    for (const lang of ["en", "es", "vi", "zh"] as const) {
      const { container } = render(<SiteFeedbackForm lang={lang} />);
      const values = [...container.querySelectorAll("select[name='category'] option")].map(
        (o) => (o as HTMLOptionElement).value,
      );
      expect(values, lang).toEqual(["", "bug", "suggestion", "question", "other"]);
      cleanup();
    }
  });

  it("every language carries complete, non-empty copy", () => {
    for (const [lang, copy] of Object.entries(FEEDBACK_COPY)) {
      for (const [key, value] of Object.entries(copy)) {
        expect(typeof value === "string" && value.length > 0, `${lang}.${key}`).toBe(true);
      }
    }
  });
});
