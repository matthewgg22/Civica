"use client";

import { useState } from "react";

interface LeadCaptureModalProps {
  open: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  organization: string;
  email: string;
  qcProcess: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  organization: "",
  email: "",
  qcProcess: "",
};

type SubmitStatus = "idle" | "submitting" | "success" | "error";

export default function LeadCaptureModal({ open, onClose }: LeadCaptureModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<SubmitStatus>("idle");

  if (!open) return null;

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
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
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("non-200");
      setStatus("success");
      setForm(EMPTY_FORM);
    } catch {
      setStatus("error");
    }
  }

  function handleClose() {
    setStatus("idle");
    setForm(EMPTY_FORM);
    onClose();
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(26,23,20,0.48)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-md bg-surface rounded-[6px] shadow-xl border border-hairline overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-modal-title"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-hairline">
          <p className="text-[11px] text-graphite uppercase tracking-wider font-medium">
            §10106 county walkthrough
          </p>
          <h2
            id="lead-modal-title"
            className="text-lg font-semibold text-ink mt-1 tracking-tight"
          >
            Get your county&apos;s estimate
          </h2>
          <p className="text-sm text-graphite mt-1 leading-relaxed">
            Federal admin cost-share drops 50% → 25% on Oct 1, 2026. We&apos;ll
            calculate your county&apos;s exposure and show how to offset it.
          </p>
        </div>

        {status === "success" ? (
          <div className="px-6 py-8 text-center">
            <p className="text-base font-semibold text-ink">
              Request received
            </p>
            <p className="text-sm text-graphite mt-2 leading-relaxed">
              A member of the Civica team will reach out within one business day
              with a county-specific estimate.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 px-4 py-2 rounded-[4px] text-sm font-semibold text-surface bg-pine hover:bg-pine-pressed transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Name */}
            <div>
              <label
                htmlFor="lc-name"
                className="block text-[12px] font-semibold text-graphite uppercase tracking-wider mb-1"
              >
                Name <span className="text-error">*</span>
              </label>
              <input
                id="lc-name"
                name="name"
                type="text"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Jane Smith"
                className="w-full px-3 py-2 text-sm border border-hairline rounded-[4px] bg-paper text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine transition-colors"
              />
            </div>

            {/* Organization / County */}
            <div>
              <label
                htmlFor="lc-organization"
                className="block text-[12px] font-semibold text-graphite uppercase tracking-wider mb-1"
              >
                Organization / County <span className="text-error">*</span>
              </label>
              <input
                id="lc-organization"
                name="organization"
                type="text"
                required
                value={form.organization}
                onChange={handleChange}
                placeholder="Los Angeles DPSS"
                className="w-full px-3 py-2 text-sm border border-hairline rounded-[4px] bg-paper text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="lc-email"
                className="block text-[12px] font-semibold text-graphite uppercase tracking-wider mb-1"
              >
                Email <span className="text-error">*</span>
              </label>
              <input
                id="lc-email"
                name="email"
                type="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="jane@lacounty.gov"
                className="w-full px-3 py-2 text-sm border border-hairline rounded-[4px] bg-paper text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine transition-colors"
              />
            </div>

            {/* QC process */}
            <div>
              <label
                htmlFor="lc-qcprocess"
                className="block text-[12px] font-semibold text-graphite uppercase tracking-wider mb-1"
              >
                What&apos;s your current QC process?
              </label>
              <textarea
                id="lc-qcprocess"
                name="qcProcess"
                rows={3}
                value={form.qcProcess}
                onChange={handleChange}
                placeholder="e.g. manual case review, supervisor sampling, vendor tool..."
                className="w-full px-3 py-2 text-sm border border-hairline rounded-[4px] bg-paper text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-pine/30 focus:border-pine transition-colors resize-none"
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-error">
                Something went wrong — please try again or email us directly.
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="text-sm font-medium text-graphite hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={status === "submitting"}
                className="px-5 py-2 rounded-[4px] text-sm font-semibold text-surface bg-pine hover:bg-pine-pressed disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {status === "submitting"
                  ? "Submitting…"
                  : "Request county walkthrough"}
              </button>
            </div>
          </form>
        )}

        {/* Close X */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-muted hover:text-ink transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>
      </div>
    </div>
  );
}
