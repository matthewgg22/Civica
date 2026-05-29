/**
 * OBBBAReadinessStrip — regulatory readiness surface beside the formula.
 *
 * Per arch-finding A3 (eng review 2026-05-25): OBBBA is NOT a pillar in the
 * FormulaHero. CA FY24 baseline predates OBBBA enforcement; OBBBA-correctness
 * prevents a NEW kind of error rather than reducing the FY24 baseline.
 *
 * This strip sits between PillarTracking and BaselinePanel on /qc. It reads
 * obbbaProvisions() from lib/analytics/obbba.ts (the same source /compliance
 * uses — single source of truth for OBBBA shipping status, per scope reduction
 * decision 2026-05-25). When counsel/external answers land on Track 2/3 + 1.3,
 * both pages update from one place.
 *
 * Visual register: indigo accent token, distinct from PillarTracking's
 * semantic pillar colors. This makes the separation unmistakable — OBBBA
 * does not contribute to the PER number in FormulaHero.
 *
 * Plan §3.6.
 */

import {
  obbbaProvisions,
  type ObbbaProvision,
} from "../../lib/analytics/obbba";

const STATUS_META = {
  Ready: { color: "var(--color-amber)", bg: "rgba(201,146,42,0.10)" },
  Partial: { color: "var(--color-amber-dark)", bg: "rgba(154,90,20,0.10)" },
} as const;

// Indigo accent (per DESIGN.md §1 "info accent, secondary status") to make
// this section visually distinct from PillarTracking's semantic pillar colors.
const INDIGO = "#4F46A5";

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
}

function daysUntil(iso: string): number | null {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export default function OBBBAReadinessStrip() {
  const provisions = obbbaProvisions();
  const ready = provisions.filter((p) => p.status === "Ready");
  const partial = provisions.filter((p) => p.status === "Partial");

  return (
    <section
      aria-labelledby="obbba-strip-title"
      className="bg-surface border border-hairline border-t-2 rounded-[4px] p-5"
      style={{ borderTopColor: INDIGO }}
      data-testid="obbba-readiness-strip"
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p
            className="text-[10px] uppercase tracking-[0.13em] font-bold mb-1"
            style={{ color: INDIGO }}
          >
            Regulatory readiness · OBBBA
          </p>
          <h3
            id="obbba-strip-title"
            className="text-[16px] font-semibold tracking-tight text-ink leading-tight"
          >
            Seven federal SNAP tracks tightened in 2025 — shipping state
          </h3>
          <p className="text-[12px] text-graphite mt-1 max-w-2xl leading-snug">
            OBBBA does NOT enter the formula above (FY24 baseline predates
            enforcement). Tracked here as engineering readiness for the new
            error surface OBBBA creates from FY26 forward.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
            style={{ color: INDIGO, background: `${INDIGO}15` }}
          >
            <span className="w-1 h-1 rounded-full bg-current" />
            {ready.length} ready · {partial.length} partial
          </span>
          <p className="text-[10px] text-muted font-mono tracking-wide mt-1">
            source: lib/analytics/obbba.ts
          </p>
        </div>
      </div>

      {/* Provision list */}
      <ul className="border border-hairline rounded-[3px] divide-y divide-hairline/60">
        {provisions.map((p) => (
          <TrackRow key={p.step} provision={p} />
        ))}
      </ul>

      <p className="text-[11px] text-muted leading-snug mt-3">
        Detail and exposure dollars live on{" "}
        <code className="font-mono text-[10px] bg-paper rounded px-1 py-0.5">
          /compliance
        </code>{" "}
        · this strip is engineering-readiness only. Updates ship via PR to{" "}
        <code className="font-mono text-[10px] bg-paper rounded px-1 py-0.5">
          lib/analytics/obbba.ts
        </code>{" "}
        as counsel / external answers land on pending tracks.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// One track row — compact, single line per provision
// ---------------------------------------------------------------------------

function TrackRow({ provision: p }: { provision: ObbbaProvision }) {
  const statusMeta = STATUS_META[p.status];
  const days = daysUntil(p.deadlineIso);
  const isUrgent = days !== null && days >= 0 && days < 180;
  const isOverdue = days !== null && days < 0;

  return (
    <li
      className="grid grid-cols-[80px_1fr_auto] items-baseline gap-3 px-3 py-2.5"
      aria-label={`OBBBA track ${p.section}: ${p.title}. Status ${p.status}. Deadline ${formatDeadline(p.deadlineIso)}.`}
    >
      {/* Section citation */}
      <span className="font-mono text-[11px] font-semibold text-graphite tracking-wide whitespace-nowrap">
        {p.section}
      </span>

      {/* Title + status row */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[13px] font-semibold text-ink truncate">
            {p.title}
          </span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase tracking-wide whitespace-nowrap"
            style={{ color: statusMeta.color, background: statusMeta.bg }}
            role="status"
            aria-label={`Shipping status: ${p.status}`}
          >
            <span
              className="w-1 h-1 rounded-full"
              style={{ background: statusMeta.color }}
              aria-hidden="true"
            />
            {p.status}
          </span>
        </div>
        <p className="text-[11px] text-graphite leading-snug mt-0.5">
          {p.posture}
        </p>
      </div>

      {/* Deadline */}
      <div className="text-right shrink-0">
        <span
          className="text-[11px] font-mono tabular-nums tracking-wide whitespace-nowrap"
          style={{
            color: isOverdue
              ? "#9C3A24"
              : isUrgent
                ? "var(--color-warning)"
                : "#5A544D",
          }}
        >
          {formatDeadline(p.deadlineIso)}
        </span>
        {days !== null && (
          <p className="text-[9px] text-muted font-mono tracking-wide mt-0.5">
            {isOverdue
              ? `${Math.abs(days)}d past`
              : days < 365
                ? `${days}d ahead`
                : `${Math.round(days / 30)}mo ahead`}
          </p>
        )}
      </div>
    </li>
  );
}
