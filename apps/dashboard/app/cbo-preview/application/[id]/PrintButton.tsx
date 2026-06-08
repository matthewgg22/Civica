"use client";

// Triggers the browser print dialog ("Save as PDF"). The page's print styles
// (print:hidden on chrome) reduce it to the document sheet alone.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-[2px] bg-pine px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-pine-pressed transition-colors"
    >
      Download PDF
    </button>
  );
}
