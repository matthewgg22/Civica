"use client";

// The general feedback form — posts to /api/site-feedback. Distinct from the
// per-answer thumbs up/down inside the chat (DemeterChat's own feedback row):
// that rates ONE answer; this is for anything else someone wants to tell us —
// a bug, a suggestion, a missing state, a compliment. There was no path for
// that at all until this page existed.
//
// idle/busy/done/error states, a hidden
// honeypot field bots fill and real users never see.

import { useState } from "react";

const CATEGORIES = [
  { value: "", label: "Choose one (optional)" },
  { value: "bug", label: "Something's broken" },
  { value: "suggestion", label: "A suggestion" },
  { value: "question", label: "A question" },
  { value: "other", label: "Something else" },
] as const;

export function SiteFeedbackForm() {
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
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErrMsg(j.error ?? "Something went wrong, please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setErrMsg("Network error, please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <section className="fbform" aria-live="polite">
        <h2 className="fbform__title">Thank you</h2>
        <p className="fbform__body">
          We read every message. If you left an email, we&apos;ll follow up if there&apos;s
          something to say back.
        </p>
      </section>
    );
  }

  return (
    <form className="fbform" onSubmit={submit}>
      <label className="fbform__field">
        <span className="fbform__label">What&apos;s this about?</span>
        <select name="category" defaultValue="">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="fbform__field">
        <span className="fbform__label">Your message *</span>
        <textarea name="message" required minLength={1} maxLength={2000} rows={5} />
      </label>
      <label className="fbform__field">
        <span className="fbform__label">Email (optional, if you want a reply)</span>
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
        {state === "busy" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
