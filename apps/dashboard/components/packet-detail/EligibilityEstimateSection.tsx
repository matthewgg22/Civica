import { getPacketAnswers } from "../../lib/packet-fetchers";
import { rowsToAnswers, estimatePacketBenefit } from "../../lib/engines/facts-adapter";

/**
 * EligibilityEstimateSection — Suspense'd packet-detail card showing a live
 * benefit estimate computed from the applicant's collected answers (#504).
 *
 * Mirrors the WorkRequirementsSection pattern: cached fetcher
 * (getPacketAnswers) + async section here + <Suspense> + skeleton at the call
 * site. The number is the benefit-formula output assuming eligibility — it is
 * paired with a "confirm to finalize" checklist so it reads as an estimate
 * pending confirmation, never a determination. (Citizenship / ages / assets /
 * cat-elig aren't collected by the apply flow yet; see #504.)
 */

export function EligibilityEstimateSkeleton() {
  return (
    <div className="rounded-[4px] border border-hairline bg-surface p-5">
      <div className="h-3 w-32 rounded bg-paper" />
      <div className="mt-3 h-8 w-24 rounded bg-paper" />
      <div className="mt-3 h-3 w-full rounded bg-paper" />
    </div>
  );
}

export default async function EligibilityEstimateSection({ packetId }: { packetId: string }) {
  const rows = await getPacketAnswers(packetId);

  if (!rows || rows.length === 0) {
    return (
      <div className="rounded-[4px] border border-hairline bg-surface p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Estimated benefit</p>
        <p className="mt-2 text-[13px] text-graphite">No applicant answers captured yet — estimate unavailable.</p>
      </div>
    );
  }

  const answers = rowsToAnswers(
    rows as { question_key: string; applicant_answer: string | null; navigator_confirmed_value: string | null }[],
  );

  let est;
  try {
    est = estimatePacketBenefit(answers, "CA", new Date());
  } catch {
    return (
      <div className="rounded-[4px] border border-hairline bg-surface p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Estimated benefit</p>
        <p className="mt-2 text-[13px] text-graphite">Estimate unavailable for this packet.</p>
      </div>
    );
  }

  return (
    <section aria-label="Estimated benefit" className="rounded-[4px] border border-hairline bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Estimated benefit</p>
      <p className="mt-2 text-[32px] font-semibold leading-none tabular-nums text-ink">
        ${est.estimatedMonthlyBenefitUsd}
        <span className="text-[14px] font-normal text-graphite">/mo</span>
      </p>
      <p className="mt-1.5 text-[12px] text-muted">
        Estimate from the CA rules engine, assuming eligibility — not a determination. The county sets the final amount.
      </p>

      <div className="mt-4 rounded-[4px] border border-warning/30 bg-warning/[0.06] p-3">
        <p className="text-[12px] font-semibold text-warning">Confirm to finalize the verdict</p>
        <ul className="mt-1.5 space-y-1">
          {est.confirmForVerdict.map((c) => (
            <li key={c} className="text-[12px] leading-relaxed text-graphite">· {c}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-muted">
        Assumptions used for the estimate: {est.assumptions.join("; ")}.
      </p>
    </section>
  );
}
