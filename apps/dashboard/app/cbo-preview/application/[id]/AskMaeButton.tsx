"use client";

// Opens the global Mae assistant (mounted in the root layout) from the
// full-application page. Decoupled via the "mae:prefill" window event so this
// button doesn't import Mae — same channel the caseload's "Ask Mae" uses. Opens
// with an empty composer; the caseworker types their own (PII-free) question.
export default function AskMaeButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("mae:prefill", { detail: {} }))}
      className="inline-flex items-center gap-1.5 rounded-[2px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-semibold text-pine hover:bg-surface-secondary transition-colors"
    >
      <span
        aria-hidden
        className="flex h-4 w-4 items-center justify-center rounded-full bg-pine text-[10px] font-semibold text-white"
      >
        M
      </span>
      Ask Mae
    </button>
  );
}
