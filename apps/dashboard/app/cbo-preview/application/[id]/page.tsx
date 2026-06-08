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
    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-graphite border-b border-hairline pb-1.5 mb-3">
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

      {/* Document sheet */}
      <div className="max-w-3xl mx-auto px-6 py-8 print:py-0 print:px-0">
        <article className="bg-surface border border-hairline rounded-[4px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] px-8 sm:px-10 py-10 print:border-0 print:shadow-none print:rounded-none">

          {/* Letterhead */}
          <header className="flex items-start justify-between gap-4 pb-6 border-b border-ink/15">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/civica-wheat-mark.png" alt="Civica" width={40} height={40} className="w-10 h-10 object-contain" />
              <div className="leading-tight">
                <p className="text-[15px] font-semibold text-ink">SNAP / CalFresh Application</p>
                <p className="text-[12px] text-graphite">{CBO_NAME} · prepared with Civica</p>
              </div>
            </div>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-warning border border-warning/40 rounded-[2px] px-2 py-1">
              Working draft
            </span>
          </header>

          {/* Applicant + status summary */}
          <section className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 py-6 border-b border-hairline">
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

          {/* Application responses */}
          <section className="py-6 border-b border-hairline">
            <SectionTitle>Application responses</SectionTitle>
            <div className="space-y-5">
              {sections.map((group) => (
                <div key={group.section}>
                  <p className="text-[12px] font-semibold text-ink mb-2">{group.section}</p>
                  <dl className="divide-y divide-hairline">
                    {group.items.map((a) => (
                      <div key={a.question} className="flex items-baseline justify-between gap-4 py-1.5">
                        <dt className="text-[13px] text-graphite">{a.question}</dt>
                        <dd className={`text-[13px] text-right ${a.flagged ? "text-brick font-semibold" : "text-ink font-medium"}`}>
                          {a.answer}
                          {a.flagged && <span className="ml-1 text-[10px] uppercase tracking-wider">⚑ verify</span>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>

          {/* Engine determination */}
          <section className="py-6 border-b border-hairline">
            <SectionTitle>Engine determination · live</SectionTitle>
            {app.estimatedBenefitUsd !== null ? (
              <p className="text-[14px] text-ink">
                {app.phase === "enrolled" ? "Benefit" : "Estimated monthly benefit"}{" "}
                <span className="font-semibold tabular-nums text-[16px]">{formatUsd(app.estimatedBenefitUsd)}/mo</span>
                <span className="text-[12px] text-graphite">
                  {app.phase === "enrolled" ? " · approved" : " · pending verification"}
                </span>
              </p>
            ) : (
              <p className="text-[13px] text-muted">Engine could not produce an estimate for this household.</p>
            )}
            {app.assumptions.length > 0 && (
              <p className="text-[12px] text-graphite mt-2">
                <span className="font-medium text-ink">Assumptions:</span> {app.assumptions.join("; ")}.
              </p>
            )}
            {app.verificationNeeds.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite mb-2">Verification still needed</p>
                <ul className="space-y-1.5">
                  {app.verificationNeeds.map((v) => (
                    <li key={v} className="flex items-start gap-2 text-[13px] text-ink">
                      <span className="shrink-0 mt-[6px] w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />
                      {v}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* Navigator flags */}
          {app.docFlags.length > 0 && (
            <section className="py-6 border-b border-hairline">
              <SectionTitle>Navigator flags</SectionTitle>
              <ul className="space-y-1.5">
                {app.docFlags.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-ink">
                    <span className="shrink-0 mt-[6px] w-1.5 h-1.5 rounded-full bg-brick" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Pipeline progress */}
          <section className="py-6 border-b border-hairline">
            <SectionTitle>Pipeline · {app.completedSteps}/{totalSteps} steps</SectionTitle>
            <ol className="space-y-1.5">
              {PIPELINE_STEPS.map((step, i) => {
                const state = i < app.completedSteps ? "done" : i === app.completedSteps ? "current" : "pending";
                return (
                  <li key={step} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${
                        state === "done" ? "bg-pine text-white" : state === "current" ? "bg-warning text-white" : "border border-hairline text-muted"
                      }`}
                      aria-hidden="true"
                    >
                      {state === "done" ? "✓" : state === "current" ? "●" : i + 1}
                    </span>
                    <span className={state === "pending" ? "text-muted" : state === "current" ? "text-ink font-semibold" : "text-graphite"}>
                      {step}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Processing history */}
          {app.history.length > 0 && (
            <section className="py-6">
              <SectionTitle>Processing history</SectionTitle>
              <ol className="relative space-y-3 pl-4">
                <span className="absolute left-[3px] top-1 bottom-1 w-px bg-hairline" aria-hidden="true" />
                {app.history.map((e, i) => (
                  <li key={`${e.label}-${i}`} className="relative text-[13px]">
                    <span
                      className={`absolute -left-4 top-[5px] w-[7px] h-[7px] rounded-full ${i === app.history.length - 1 ? "bg-pine" : "bg-graphite/40"}`}
                      aria-hidden="true"
                    />
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-ink">{e.label}</span>
                      <span className="text-graphite tabular-nums shrink-0">{e.when}</span>
                    </div>
                    {e.by && <p className="text-[11px] text-graphite">{e.by}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Footer */}
          <footer className="pt-6 mt-2 border-t border-ink/15 flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-[10px] text-muted leading-relaxed max-w-md">
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
