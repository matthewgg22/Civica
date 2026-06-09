// PortalAutofillCard — the terminal "approved answers → BenefitsCal autofill"
// section. The CBO officer (already logged into BenefitsCal) clicks Next/Accept;
// the extension bridge fills the highlighted fields. Gated on dual approval +
// consent. Presentational, prop-only; full-width section before the sheet footer.
//
// Autofill highlight = bg-amber-surface (#F5E2C0) + text-ink. NEVER wheat-as-text
// (#E8C547 fails WCAG AA on paper — DESIGN.md §1/§7).
import type { PortalAutofill } from "../../lib/cbo/demo-pipeline";

function GateItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={`${label}: ${ok ? "done" : "pending"}`}
      className={`inline-flex items-center gap-1 text-[12px] font-medium ${ok ? "text-amber" : "text-muted"}`}
    >
      <span aria-hidden="true">{ok ? "✓" : "○"}</span>
      {label}
    </span>
  );
}

export default function PortalAutofillCard({ portal }: { portal: PortalAutofill }) {
  const consentOk = portal.consent !== null;
  const ready = portal.applicantApproved && portal.cboApproved && consentOk;
  const blocker = !portal.applicantApproved
    ? "Waiting on applicant approval"
    : !portal.cboApproved
      ? "Waiting on CBO approval"
      : !consentOk
        ? "Waiting on recorded consent"
        : null;

  return (
    <section className="py-4 border-b border-hairline">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-graphite border-b border-hairline pb-1 mb-2">
        Enter into BenefitsCal
      </h2>

      {/* dual-approval + consent gate */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
        <GateItem ok={portal.applicantApproved} label="Applicant approved" />
        <GateItem ok={portal.cboApproved} label="CBO approved" />
        <GateItem ok={consentOk} label="Consent recorded" />
        <span className="text-[12px] text-graphite tabular-nums">· {portal.docCount} documents</span>
      </div>

      {/* approved answer → the BenefitsCal field it autofills */}
      <dl className={`divide-y divide-hairline ${ready ? "" : "opacity-60"}`}>
        {portal.fieldMap.map((row) => (
          <div
            key={row.benefitsCalField}
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0.5 py-1.5"
          >
            <dt className="text-[12px] text-graphite">
              {row.answer}: <span className="text-ink font-medium">{row.value}</span>
            </dt>
            <dd className="text-[12px] text-graphite sm:text-right">
              {row.benefitsCalField}:{" "}
              <span className="bg-amber-surface text-ink px-1.5 py-0.5 rounded-[2px] tabular-nums">
                {ready ? row.value : "—"}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {/* action depiction (pine = CTA per DESIGN.md §1; sheet is a "Working draft") */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          aria-disabled={!ready}
          className={`inline-block px-4 py-2 text-[13px] font-semibold rounded-[3px] ${
            ready ? "bg-pine text-white" : "bg-graphite/20 text-graphite"
          }`}
        >
          Enter into BenefitsCal
        </span>
        {ready ? (
          <p className="text-[12px] text-graphite">
            Officer reviews the highlighted fields and clicks Next / Accept in BenefitsCal.
          </p>
        ) : (
          <p className="text-[12px] text-warning">{blocker}</p>
        )}
      </div>
    </section>
  );
}
