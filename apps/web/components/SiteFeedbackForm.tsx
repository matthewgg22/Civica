"use client";

// The general feedback form — posts to /api/site-feedback. Distinct from the
// per-answer thumbs up/down inside the chat (DemeterChat's own feedback row):
// that rates ONE answer; this is for anything else someone wants to tell us —
// a bug, a suggestion, a missing state, a compliment. There was no path for
// that at all until this page existed.
//
// idle/busy/done/error states, a hidden
// honeypot field bots fill and real users never see.
//
// Localized (launch audit 2026-08-28): all copy comes from FEEDBACK_COPY, so a
// Spanish/Vietnamese/Chinese reader who reached /[lang]/feedback fills in a form
// they can read. The category `value`s stay the English enum the API stores;
// only the labels translate.

import { useState } from "react";
import type { AnswerLang } from "@civica/demeter-engine/packs";
import { FEEDBACK_COPY } from "../lib/i18n/feedback-copy";

export function SiteFeedbackForm({ lang = "en" }: { lang?: AnswerLang }) {
  const c = FEEDBACK_COPY[lang];
  const categories = [
    { value: "", label: c.categoryChoose },
    { value: "bug", label: c.catBug },
    { value: "suggestion", label: c.catSuggestion },
    { value: "question", label: c.catQuestion },
    { value: "other", label: c.catOther },
  ] as const;

  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    setErrMsg("");
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    // The page the person was actually on, not this one — feedback about
    // "the map on the SNAP page" is far more useful with that context
    // attached automatically than asking them to describe where they were.
    const pageUrl =
      typeof document !== "undefined" ? document.referrer || window.location.href : "";
    try {
      const res = await fetch("/api/site-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, page_url: pageUrl }),
      });
      if (!res.ok) {
        // The server's error text is English; show the localized generic so a
        // non-English reader never gets an English string mid-form.
        setErrMsg(c.errorGeneric);
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setErrMsg(c.errorNetwork);
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <section className="fbform" aria-live="polite">
        <h2 className="fbform__title">{c.thankYouTitle}</h2>
        <p className="fbform__body">{c.thankYouBody}</p>
      </section>
    );
  }

  return (
    <form className="fbform" onSubmit={submit}>
      {/* THE REQUIRED FIELD FIRST. The category select used to open the
          form, so the first thing anyone met was an OPTIONAL decision, in
          front of the task they came to do. */}
      <label className="fbform__field">
        <span className="fbform__label">{c.messageLabel}</span>
        <textarea name="message" required minLength={1} maxLength={2000} rows={5} />
      </label>
      {/* Sized to what they hold, not to the column. An email box as wide as a
          message box is a promise about the expected input, and the wrong
          one. */}
      <label className="fbform__field fbform__field--narrow">
        <span className="fbform__label">{c.categoryLabel}</span>
        <select name="category" defaultValue="">
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </label>
      <label className="fbform__field fbform__field--narrow">
        <span className="fbform__label">{c.emailLabel}</span>
        <input name="contact_email" type="email" maxLength={200} autoComplete="email" />
      </label>
      {/* Honeypot — hidden from real users, filled only by bots. */}
      <label className="fbform__hp" aria-hidden="true">
        Fax
        <input name="company_fax" tabIndex={-1} autoComplete="off" />
      </label>
      {errMsg && (
        <p className="fbform__error" role="alert">
          {errMsg}
        </p>
      )}
      <button className="fbform__submit" type="submit" disabled={state === "busy"}>
        {state === "busy" ? c.sending : c.send}
      </button>
    </form>
  );
}
