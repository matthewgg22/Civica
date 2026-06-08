import { notFound } from "next/navigation";
import Link from "next/link";
import {
  buildPipeline,
  formatUsd,
  PIPELINE_STEPS,
  type SurveyAnswer,
  type QueueApplication,
} from "../../../../lib/cbo/demo-pipeline";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

function cboPreviewEnabled(): boolean {
  const v = process.env.CBO_PREVIEW_ENABLED;
  return v === "true" || v === "1";
}

// Partner CBO name — mirror of CBO_ORG in ../../page.tsx (placeholder for the
// preview; wire both to the authenticated org record once CBO accounts exist).
const CBO_NAME = "Bay Area Community Partners";

const PHASE_LABEL: Record<string, string> = {
  requesting: "Requesting assistance",
  live: "Live application",
  enrolled: "Enrolled",
  recert: "Recertification",
};

const RISK_CLASS: Record<string, string> = {
  "High risk": "text-brick",
  "Medium risk": "text-warning",
  "Low risk": "text-muted",
};

// Group consecutive answers by their section, preserving order.
function groupBySection(answers: SurveyAnswer[]): { section: string; items: SurveyAnswer[] }[] {
  const out: { section: string; items: SurveyAnswer[] }[] = [];
  for (const a of answers) {
    const last = out[out.length - 1];
    if (last && last.section === a.section) last.items.push(a);
    else out.push({ section: a.section, items: [a] });
  }
  return out;
}

function SummaryCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-graphite mb-1">{label}</p>
      <p className="text-[14px] text-ink">{children}</p>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-graphite border-b border-hairline pb-1 mb-2">
      {children}
    </h2>
  );
}

export default async function ApplicationDraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!cboPreviewEnabled()) notFound();

  const { id } = await params;
  const phases = buildPipeline("CA", new Date(), true);
  const app: QueueApplication | undefined = phases
    .flatMap((p) => p.cases)
    .find((c) => c.id === id);
  if (!app) notFound();

  const sections = groupBySection(app.answers);
  const totalSteps = PIPELINE_STEPS.length;
  const generated = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return (
    <main className="min-h-screen bg-paper">
      {/* Action bar — hidden in print */}
      <div className="print:hidden border-b border-hairline bg-surface">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/cbo-preview" className="text-[13px] font-medium text-pine hover:underline">
            ← Back to overview
          </Link>
          <PrintButton />
        </div>
      </div>

      {/* Print page setup: Letter, half-inch margins, keep colors */}
      <style>{`@media print { @page { size: letter; margin: 0.5in; } html, body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      {/* Document sheet */}
      <div className="max-w-3xl mx-auto px-6 py-8 print:py-0 print:px-0">
        <article className="bg-surface border border-hairline rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-8 sm:px-10 py-8 print:border-0 print:shadow-none print:rounded-none print:px-0 print:py-0">

          {/* Letterhead */}
          <header className="flex items-start justify-between gap-4 pb-4 border-b border-ink/15">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/civica-wheat-mark.png" alt="Civica" width={36} height={36} className="w-9 h-9 object-contain" />
              <div className="leading-tight">
                <p className="text-[15px] font-semibold text-ink">SNAP / CalFresh Application</p>
                <p className="text-[12px] text-graphite">{CBO_NAME} · prepared with Civica</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-warning border border-warning/40 rounded-[2px] px-2 py-1">
                Working draft
              </span>
              <p className="text-[11px] text-graphite mt-1.5 tabular-nums">{generated}</p>
            </div>
          </header>

          {/* Applicant + status summary */}
          <section className="grid grid-cols-3 gap-x-6 gap-y-3 py-4 border-b border-hairline">
            <SummaryCell label="Applicant"><span className="font-semibold">{app.name}</span></SummaryCell>
            <SummaryCell label="Case ID"><span className="font-mono tabular-nums">{app.caseId}</span></SummaryCell>
            <SummaryCell label="County">{app.county} County, CA</SummaryCell>
            <SummaryCell label="Status">{PHASE_LABEL[app.phase] ?? app.phase} · {app.stage}</SummaryCell>
            <SummaryCell label="Navigator">{app.navigator}</SummaryCell>
            <SummaryCell label="Risk">
              <span className={`uppercase tracking-wider text-[12px] font-semibold ${RISK_CLASS[app.risk] ?? "text-muted"}`}>
                {app.risk.replace(" risk", "")}
              </span>
              {app.expedited && (
                <span className="ml-2 text-[10px] uppercase tracking-wider text-warning border border-warning/40 rounded-[2px] px-1.5 py-0.5">
                  Expedited
                </span>
              )}
            </SummaryCell>
          </section>

          {/* Application responses — two columns to keep the draft compact */}
          <section className="py-4 border-b border-hairline">
            <SectionTitle>Application responses</SectionTitle>
            <div className="columns-2 gap-x-8 [&>div]:break-inside-avoid">
              {sections.map((group) => (
                <div key={group.section} className="mb-3">
                  <p className="text-[11px] font-semibold text-ink mb-0.5">{group.section}</p>
                  <dl className="divide-y divide-hairline">
                    {group.items.map((a) => (
                      <div key={a.question} className="flex items-baseline justify-between gap-3 py-1">
                        <dt className="text-[12px] text-graphite">{a.question}</dt>
                        <dd className={`text-[12px] text-right ${a.flagged ? "text-brick font-semibold" : "text-ink font-medium"}`}>
                          {a.answer}
                          {a.flagged && <span className="ml-1 text-[9px] uppercase tracking-wider">⚑ verify</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>

          {/* Engine determination + verification — side by side */}
          <section className="grid sm:grid-cols-2 gap-x-8 gap-y-4 py-4 border-b border-hairline">
            <div>
              <SectionTitle>Engine determination · live</SectionTitle>
              {app.estimatedBenefitUsd !== null ? (
                <p className="text-[13px] text-ink">
                  {app.phase === "enrolled" ? "Benefit" : "Estimated monthly benefit"}{" "}
                  <span className="font-semibold tabular-nums text-[15px]">{formatUsd(app.estimatedBenefitUsd)}/mo</span>
                  <span className="text-[12px] text-graphite">
                    {app.phase === "enrolled" ? " · approved" : " · pending verification"}
                  </span>
                </p>
              ) : (
                <p className="text-[12px] text-muted">Engine could not produce an estimate for this household.</p>
              )}
              {app.assumptions.length > 0 && (
                <p className="text-[11px] text-graphite mt-2 leading-relaxed">
                  <span className="font-medium text-ink">Assumptions:</span> {app.assumptions.join("; ")}.
                </p>
              )}
            </div>
            {app.verificationNeeds.length > 0 && (
              <div>
                <SectionTitle>Verification still needed</SectionTitle>
                <ul className="space-y-1">
                  {app.verificationNeeds.map((v) => (
                    <li key={v} className="flex items-start gap-2 text-[12px] text-ink">
                      <span className="shrink-0 mt-[6px] w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Navigator flags + pipeline — side by side */}
          <section className="grid sm:grid-cols-2 gap-x-8 gap-y-4 py-4 border-b border-hairline">
            <div>
              <SectionTitle>Navigator flags</SectionTitle>
              {app.docFlags.length > 0 ? (
                <ul className="space-y-1">
                  {app.docFlags.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12px] text-ink">
                      <span className="shrink-0 mt-[6px] w-1.5 h-1.5 rounded-full bg-brick" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-muted">No flags.</p>
              )}
            </div>
            <div>
              <SectionTitle>Pipeline · {app.completedSteps}/{totalSteps} steps</SectionTitle>
              <ol className="grid grid-cols-2 gap-x-4 gap-y-1">
                {PIPELINE_STEPS.map((step, i) => {
                  const state = i < app.completedSteps ? "done" : i === app.completedSteps ? "current" : "pending";
                  return (
                    <li key={step} className="flex items-center gap-2 text-[12px]">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold ${
                          state === "done" ? "bg-pine text-white" : state === "current" ? "bg-warning text-white" : "border border-hairline text-muted"
                        }`}
                        aria-hidden="true"
                      >
                        {state === "done" ? "✓" : state === "current" ? "●" : i + 1}
                      </span>
                      <span className={`truncate ${state === "pending" ? "text-muted" : state === "current" ? "text-ink font-semibold" : "text-graphite"}`}>
                        {step}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          {/* Processing history — compact two-column */}
          {app.history.length > 0 && (
            <section className="py-4">
              <SectionTitle>Processing history</SectionTitle>
              <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
                {app.history.map((e, i) => (
                  <li key={`${e.label}-${i}`} className="flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="text-ink">
                      {e.label}
                      {e.by && <span className="text-graphite"> · {e.by}</span>}
                    </span>
                    <span className="text-graphite tabular-nums shrink-0">{e.when}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Footer */}
          <footer className="pt-4 mt-2 border-t border-ink/15 flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-[10px] text-muted leading-relaxed max-w-lg">
              Working draft generated {generated}. Illustrative — applicant responses are synthetic;
              the benefit estimate and verification needs are computed by Civica&rsquo;s rules engine.
              Not a filed application.
            </p>
            <p className="text-[10px] font-mono text-muted tabular-nums">{app.caseId}</p>
          </footer>
        </article>
      </div>
    </main>
  );
}
