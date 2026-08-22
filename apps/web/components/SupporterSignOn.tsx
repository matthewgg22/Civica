"use client";

// Supporter sign-on form — posts to /api/supporters; rows land PENDING and
// appear on the wall only after moderation (eng F1). The hidden company_fax
// field is a bot honeypot.

import { useState } from "react";

export function SupporterSignOn() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    setErrMsg("");
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      const res = await fetch("/api/supporters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErrMsg(j.error ?? "Something went wrong — please try again.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setErrMsg("Network error — please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <section className="ssignon" aria-live="polite">
        <h2 className="ssignon__title">Thank you!</h2>
        <p>
          Your sign-on is in — we review every submission before listing (usually within
          a few days). We&apos;ll email you at the address you provided.
        </p>
      </section>
    );
  }

  return (
    <section className="ssignon">
      <h2 className="ssignon__title">Sign on as a Supporter</h2>
      <p className="ssignon__sub">
        Free, takes a minute. Listings are reviewed before they appear.
      </p>
      <form className="ssignon__form" onSubmit={submit}>
        <label>
          Organization name *
          <input name="org_name" required minLength={2} maxLength={120} autoComplete="organization" />
        </label>
        <label>
          Contact email *
          <input name="contact_email" type="email" required maxLength={200} autoComplete="email" />
        </label>
        <label>
          Website
          <input name="website" type="url" placeholder="https://…" maxLength={300} />
        </label>
        <label>
          State you serve
          <input name="state" maxLength={30} placeholder="e.g. TX" />
        </label>
        <label>
          Anything we should know?
          <textarea name="note" maxLength={500} rows={3} />
        </label>
        {/* Honeypot — hidden from real users, filled only by bots. */}
        <label className="ssignon__hp" aria-hidden="true">
          Fax
          <input name="company_fax" tabIndex={-1} autoComplete="off" />
        </label>
        {errMsg && (
          <p className="ssignon__error" role="alert">
            {errMsg}
          </p>
        )}
        <button className="ssignon__submit" type="submit" disabled={state === "busy"}>
          {state === "busy" ? "Sending…" : "Sign on"}
        </button>
      </form>
    </section>
  );
}
