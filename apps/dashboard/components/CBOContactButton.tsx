"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";
const EMPTY = { name: "", organization: "", email: "", qcProcess: "" };

export default function CBOContactButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState<Status>("idle");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch("/api/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "cbo-preview" }),
      });
      if (!res.ok) throw new Error("non-200");
      setStatus("success");
      setForm(EMPTY);
    } catch {
      setStatus("error");
    }
  }

  function close() {
    setOpen(false);
    setStatus("idle");
    setForm(EMPTY);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-[4px] px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap flex-shrink-0 bg-pine hover:opacity-90 transition-opacity"
      >
        Contact Civica partnerships
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(26,23,20,0.48)" }}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div
            className="relative w-full max-w-md bg-surface rounded-[6px] shadow-xl border border-hairline overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cbo-lead-title"
          >
            <div className="px-6 pt-6 pb-4 border-b border-hairline">
              <p className="text-[11px] text-muted uppercase tracking-wider font-medium">
                CBO licensing inquiry
              </p>
              <h2 id="cbo-lead-title" className="text-lg font-semibold text-ink mt-1 tracking-tight">
                Partner with Civica
              </h2>
              <p className="text-sm text-graphite mt-1 leading-relaxed">
                We partner with CBOs serving SNAP-eligible households. Share your info
                and we&apos;ll follow up within one business day.
              </p>
            </div>

            {status === "success" ? (
              <div className="px-6 py-8 text-center">
                <p className="text-base font-semibold text-ink">Request received</p>
                <p className="text-sm text-graphite mt-2 leading-relaxed">
                  A member of the Civica partnerships team will reach out within one business day.
                </p>
                <button
                  onClick={close}
                  className="mt-6 px-4 py-2 rounded-[4px] text-sm font-semibold text-surface bg-pine hover:opacity-90 transition-opacity"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                  <label htmlFor="cbo-name" className="block text-[12px] font-semibold text-graphite uppercase tracking-wider mb-1">
                    Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="cbo-name" name="name" type="text" required
                    value={form.name} onChange={handleChange}
                    placeholder="Jane Smith"
                    className="w-full px-3 py-2 text-sm border border-hairline rounded-[4px] bg-paper text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="cbo-org" className="block text-[12px] font-semibold text-graphite uppercase tracking-wider mb-1">
                    Organization <span className="text-error">*</span>
                  </label>
                  <input
                    id="cbo-org" name="organization" type="text" required
                    value={form.organization} onChange={handleChange}
                    placeholder="Bay Area Food Bank"
                    className="w-full px-3 py-2 text-sm border border-hairline rounded-[4px] bg-paper text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="cbo-email" className="block text-[12px] font-semibold text-graphite uppercase tracking-wider mb-1">
                    Email <span className="text-error">*</span>
                  </label>
                  <input
                    id="cbo-email" name="email" type="email" required
                    value={form.email} onChange={handleChange}
                    placeholder="jane@bayfoodfbank.org"
                    className="w-full px-3 py-2 text-sm border border-hairline rounded-[4px] bg-paper text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="cbo-qc" className="block text-[12px] font-semibold text-graphite uppercase tracking-wider mb-1">
                    How many clients do you serve annually?
                  </label>
                  <textarea
                    id="cbo-qc" name="qcProcess" rows={2}
                    value={form.qcProcess} onChange={handleChange}
                    placeholder="e.g. ~500 SNAP-eligible households per year"
                    className="w-full px-3 py-2 text-sm border border-hairline rounded-[4px] bg-paper text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine transition-colors resize-none"
                  />
                </div>

                {status === "error" && (
                  <p className="text-sm text-error">Something went wrong — please try again.</p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={close} className="text-sm font-medium text-graphite hover:text-ink transition-colors">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status === "submitting"}
                    className="px-5 py-2 rounded-[4px] text-sm font-semibold text-surface bg-pine hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {status === "submitting" ? "Submitting…" : "Request partnership call"}
                  </button>
                </div>
              </form>
            )}

            <button
              type="button" onClick={close} aria-label="Close"
              className="absolute top-4 right-4 text-muted hover:text-ink transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M4 4l10 10M14 4L4 14" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
