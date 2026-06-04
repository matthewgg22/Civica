"use client";

import { useState } from "react";

type State = "form" | "submitting" | "success" | "error";

export default function RequestAccessPage() {
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<State>("form");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("submitting");
    setErrorMsg(null);
    try {
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, organization, email, note }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(body.error ?? "Something went wrong. Please try again.");
        setState("error");
      } else {
        setState("success");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setState("error");
    }
  }

  const lockup = (
    <div className="flex items-center gap-4 mb-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/civica-wheat-mark.png" alt="Civica" width={68} height={68} className="w-[68px] h-[68px] object-contain shrink-0" />
      <div className="flex flex-col justify-center">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink leading-none">Civica Navigator</h1>
        <p className="text-[13px] text-muted mt-1.5 leading-none">SNAP Enrollment</p>
      </div>
    </div>
  );

  if (state === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md text-center">
          {lockup}
          <div className="py-4">
            <p className="text-[15px] text-ink font-medium mb-2">Request received</p>
            <p className="text-[14px] text-muted leading-relaxed">
              We'll review your request and follow up at <strong>{email}</strong> within one business day.
            </p>
            <a
              href="/login"
              className="mt-6 inline-block text-[13px] text-pine hover:underline font-medium"
            >
              Back to sign in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-surface p-8 rounded-[4px] border border-hairline shadow-md w-full max-w-md">
        {lockup}
        <h2 className="text-[24px] font-semibold tracking-tight text-ink mb-2">Request access</h2>
        <p className="text-[14px] text-muted mb-6 leading-relaxed">
          Civica Navigator is available for navigators, CBOs, and county partners. Tell us a bit about yourself and we'll be in touch.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="ra-name" className="block text-[13px] font-medium text-graphite mb-1.5">Full name</label>
            <input
              id="ra-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="ra-org" className="block text-[13px] font-medium text-graphite mb-1.5">Organization</label>
            <input
              id="ra-org"
              type="text"
              required
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Project Bread, SEIU Local 2015…"
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="ra-email" className="block text-[13px] font-medium text-graphite mb-1.5">Work email</label>
            <input
              id="ra-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.org"
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="ra-note" className="block text-[13px] font-medium text-graphite mb-1.5">
              How do you plan to use Civica? <span className="text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="ra-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. navigator for a food bank, county QC team…"
              className="w-full border border-input rounded-[3px] px-3 py-2.5 text-[15px] bg-paper focus:outline-none focus:border-pine focus:bg-white focus:ring-2 focus:ring-pine/30 transition-colors resize-none"
            />
          </div>
          {(state === "error" || errorMsg) && (
            <p className="text-[13px] text-error">{errorMsg}</p>
          )}
          <button
            type="submit"
            disabled={state === "submitting"}
            className="w-full bg-pine text-white py-3 rounded-[3px] text-[15px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {state === "submitting" ? "Submitting…" : "Request access"}
          </button>
          <p className="text-center text-[14px] text-muted pt-1">
            Already have an account?{" "}
            <a href="/login" className="text-pine hover:underline font-medium">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
