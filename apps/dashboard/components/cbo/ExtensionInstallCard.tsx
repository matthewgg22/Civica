// ExtensionInstallCard — "Install the BenefitsCal autofill helper" surface.
// Presentational, prop-only.
//
// variant="workspace" (default): the authenticated /cbo install CTA.
//   installUrl present → published (unlisted Chrome Web Store): "Add to Chrome".
//   installUrl null    → pilot build: point officers at /cbo/setup (load-unpacked).
// variant="preview": public /cbo-preview explainer — value prop + steps only,
//   NO functional/auth-gated links (a prospect can't use /cbo/setup or install
//   as an officer). Reads as "here's the tool officers use."
//
// Gov-grade Card per DESIGN.md §4 (bg-surface + border-hairline, no shadow);
// pine is the CTA color (§1).
import Link from "next/link";
import { SUBMITTER_USE_STEPS } from "../../lib/cbo/extension";

export default function ExtensionInstallCard({
  installUrl,
  variant = "workspace",
}: {
  installUrl: string | null;
  variant?: "workspace" | "preview";
}) {
  const isPreview = variant === "preview";
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6">
      <div className="mb-3">
        <h2 className="section-title">BenefitsCal autofill helper</h2>
        <p className="section-sub mt-1">
          A Civica browser extension that fills the BenefitsCal application with this
          case&rsquo;s approved answers — highlighted in yellow for you to review. You stay
          logged in and click Next / Accept; Civica never submits for you.
        </p>
      </div>

      {isPreview ? (
        <p className="text-[12px] text-graphite italic">
          CBO officers install this from their Civica workspace and run it on their own
          BenefitsCal session.
        </p>
      ) : (
      <div className="flex flex-wrap items-center gap-3">
        {installUrl ? (
          <a
            href={installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-pine text-white hover:bg-pine/90 transition-colors"
          >
            Add to Chrome
          </a>
        ) : (
          <Link
            href="/cbo/setup"
            className="inline-block px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-pine text-white hover:bg-pine/90 transition-colors"
          >
            Set up the helper
          </Link>
        )}
        <Link href="/cbo/setup" className="text-[13px] font-medium text-pine hover:underline">
          {installUrl ? "Setup &amp; troubleshooting" : "Step-by-step guide"}
        </Link>
        {!installUrl && (
          <span className="text-[11px] uppercase tracking-wider text-warning border border-warning/40 rounded-[2px] px-2 py-1">
            Pilot build
          </span>
        )}
      </div>
      )}

      <ol className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {SUBMITTER_USE_STEPS.map((step, i) => (
          <li key={step} className="flex items-start gap-2 text-[12px] text-ink">
            <span
              aria-hidden="true"
              className="shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-secondary text-graphite text-[9px] font-bold"
            >
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
