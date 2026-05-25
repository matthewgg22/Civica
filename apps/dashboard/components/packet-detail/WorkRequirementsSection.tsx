import { formatDate } from "../../lib/format";
import { getWrStatus } from "../../lib/packet-fetchers";

/**
 * WorkRequirementsSection — Suspense'd packet-detail card for OBBBA
 * §10102 work-requirement evaluation. Fetches its own data via the
 * cached getWrStatus() fetcher (lib/packet-fetchers.ts), so the
 * parent packet-detail page doesn't need to await this query in its
 * primary Promise.all batch. Wrap the export in <Suspense> at the
 * call site to defer it.
 *
 * Extracted from app/packets/[packetId]/page.tsx as the first step
 * of the per-section Suspense refactor surfaced by
 * /plan-design-review (T6b). The pattern: cached fetcher in
 * lib/packet-fetchers.ts + async section component here + Suspense
 * + skeleton fallback at the call site.
 */

type WrStatusData = {
  wr_status_id: string;
  is_subject: boolean;
  compliance_status: string | null;
  exemption_type: string | null;
  months_used_in_window: number | null;
  next_review_due: string | null;
  determined_at: string;
  determination_basis: string | null;
} | null;

const COMPLIANCE_BADGE: Record<string, string> = {
  unknown: "bg-paper text-muted border border-hairline",
  compliant: "bg-teal/10 text-teal",
  at_risk: "bg-warning/15 text-warning",
  non_compliant: "bg-brick/10 text-brick",
};

/**
 * Skeleton matching the rendered WorkRequirementsCard footprint so
 * the Suspense fallback doesn't jolt layout when the real card
 * resolves. Export so the call site can pass it as the Suspense
 * fallback.
 */
export function WorkRequirementsSkeleton() {
  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6 space-y-3 animate-pulse">
      <div className="h-3 w-32 bg-paper rounded" />
      <div className="h-5 w-48 bg-paper rounded" />
      <div className="h-7 w-24 bg-paper rounded-full" />
      <div className="h-3 w-40 bg-paper rounded" />
    </section>
  );
}

function WorkRequirementsCard({ wrStatus }: { wrStatus: WrStatusData }) {
  if (wrStatus === null) {
    return (
      <section className="bg-surface border border-hairline rounded-[4px] p-6">
        <p className="eyebrow mb-3">Work-Hours Rule</p>
        <p className="text-[14px] text-graphite leading-snug">
          Work-hours rule not yet evaluated. Use the iOS navigator app to run the evaluation for this household.
        </p>
      </section>
    );
  }

  const complianceBadgeClass = COMPLIANCE_BADGE[wrStatus.compliance_status ?? "unknown"] ?? COMPLIANCE_BADGE["unknown"];
  const determinationLabel =
    wrStatus.determination_basis === "rules_engine" ? "automated rules" : "navigator override";

  return (
    <section className="bg-surface border border-hairline rounded-[4px] p-6 space-y-3">
      <p className="eyebrow">Work-Hours Rule</p>

      {/* Subject / not subject headline */}
      <p className={`text-[16px] font-semibold ${wrStatus.is_subject ? "text-brick" : "text-teal"}`}>
        {wrStatus.is_subject ? "Subject to work requirements" : "Not subject to work requirements"}
      </p>

      {wrStatus.is_subject ? (
        <div className="space-y-2">
          {/* Compliance status badge */}
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${complianceBadgeClass}`}>
              {wrStatus.compliance_status ?? "unknown"}
            </span>
          </div>

          {/* Exemption */}
          {wrStatus.exemption_type && wrStatus.exemption_type !== "none" && (
            <p className="text-[13px] text-graphite">
              Exemption: <span className="font-medium text-ink">{wrStatus.exemption_type}</span>
            </p>
          )}

          {/* Time limit */}
          {wrStatus.months_used_in_window !== null && (
            <p className="text-[13px] text-graphite">
              Time limit: <span className="font-medium text-ink tabular-nums">{wrStatus.months_used_in_window}/3 months used</span>
            </p>
          )}
        </div>
      ) : (
        <div>
          {wrStatus.exemption_type ? (
            <p className="text-[13px] text-graphite">
              Exempt — <span className="font-medium text-ink">{wrStatus.exemption_type}</span>
            </p>
          ) : (
            <p className="text-[13px] text-muted italic">Not subject — no exemption required</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-hairline text-[11px] text-muted space-y-0.5">
        <p>
          Evaluated {formatDate(wrStatus.determined_at)} · via {determinationLabel}
        </p>
        {wrStatus.next_review_due && (
          <p>Next review: {formatDate(wrStatus.next_review_due)}</p>
        )}
      </div>
    </section>
  );
}

export default async function WorkRequirementsSection({ packetId }: { packetId: string }) {
  const wrStatus = (await getWrStatus(packetId)) as WrStatusData;
  return <WorkRequirementsCard wrStatus={wrStatus} />;
}
