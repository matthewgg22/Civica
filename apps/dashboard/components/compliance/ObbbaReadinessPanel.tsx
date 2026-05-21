/**
 * ObbbaReadinessPanel — pillar 2 of /compliance.
 *
 * Each provision answers three questions up front:
 *   1. Who's affected   — stakeholder chips
 *   2. What it requires — oneliner
 *   3. Downstream impact — risk / upside split
 *
 * Visual tiers:
 *   hero     → §10105, §10106 — dollar numeral + impact split
 *   standard → §10102, §10108 — 3-zone layout
 *   posture  → shipped / internal items — collapsed chips
 *
 * Data: `lib/analytics/obbba.ts`.
 */
import type {
  ObbbaProvision,
  ObbbaStatus,
  ObbbaStakeholder,
} from "../../lib/analytics/obbba";
import ObbbaTimeline from "./ObbbaTimeline";

const STATUS_META: Record<ObbbaStatus, { color: string; bg: string }> = {
  Ready:   { color: "#C9922A", bg: "rgba(201,146,42,0.10)" },
  Partial: { color: "#9A5A14", bg: "rgba(154,90,20,0.10)" },
};

const STAKEHOLDER_META: Record<ObbbaStakeholder, { color: string; bg: string }> = {
  State:     { color: "#B5511E", bg: "rgba(181,81,30,0.09)"  },
  County:    { color: "#7A3A1F", bg: "rgba(122,58,31,0.09)"  },
  CBO:       { color: "#2D5A45", bg: "rgba(45,90,69,0.09)"   },
  Household: { color: "#5A544D", bg: "rgba(90,84,77,0.09)"   },
  Civica:    { color: "#C9922A", bg: "rgba(201,146,42,0.09)" },
};

function StakeholderChips({ stakeholders }: { stakeholders: ObbbaStakeholder[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {stakeholders.map((s) => {
        const m = STAKEHOLDER_META[s];
        return (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide"
            style={{ color: m.color, background: m.bg }}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: m.color }} />
            {s}
          </span>
        );
      })}
    </div>
  );
}

function firstSentence(text: string): string {
  const idx = text.indexOf(". ");
  return idx !== -1 ? text.slice(0, idx + 1) : text;
}

// ---------------------------------------------------------------------------
// Tier 1 — hero card
// ---------------------------------------------------------------------------

function HeroCard({ p }: { p: ObbbaProvision }) {
  const statusMeta = STATUS_META[p.status];
  return (
    <div className="rounded-[4px] border border-hairline overflow-hidden bg-surface">
      {/* Metadata strip — reg code, stakeholders, status */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-hairline"
        style={{ background: "rgba(92,31,17,0.05)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[11px] font-semibold text-graphite tracking-wide shrink-0">
            {p.section}
          </span>
          <span className="text-[11px] text-graphite truncate">{p.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StakeholderChips stakeholders={p.stakeholders} />
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold whitespace-nowrap"
            style={{ color: statusMeta.color, background: statusMeta.bg }}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: statusMeta.color }} />
            {p.status}
          </span>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5">
        {/* Plain-English headline */}
        <h4 className="text-[18px] font-bold tracking-tight text-ink leading-snug mb-4">
          {p.heroSubhead}
        </h4>

        {/* Number — sized to support the headline, not overpower it */}
        <p className="text-[40px] font-bold text-[#5C1F11] tabular-nums leading-none mb-4">
          {p.heroNumber}
        </p>

        {/* Plain-English law summary — no label */}
        <p className="text-[13px] text-graphite leading-relaxed mb-4 pb-4 border-b border-hairline/50">
          {p.oneliner}
        </p>

        {/* Risk / upside — 1 sentence each */}
        <div className="space-y-2 mb-4">
          <p className="text-[12px] text-graphite leading-relaxed">
            <span
              className="text-[9px] uppercase tracking-[0.12em] font-semibold mr-1.5"
              style={{ color: "#9A5A14" }}
            >
              If wrong
            </span>
            {firstSentence(p.exposure)}
          </p>
          {p.marketOpportunity && (
            <p className="text-[12px] text-graphite leading-relaxed">
              <span className="text-[9px] uppercase tracking-[0.12em] font-semibold mr-1.5" style={{ color: "#C9922A" }}>
                If right
              </span>
              {firstSentence(p.marketOpportunity)}
            </p>
          )}
        </div>

        {/* Full analysis collapsed */}
        <details className="group">
          <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.12em] font-semibold text-muted hover:text-ink transition-colors">
            <span className="group-open:hidden">+ full analysis · posture · sources</span>
            <span className="hidden group-open:inline">− collapse</span>
          </summary>
          <div className="mt-3 pt-3 border-t border-hairline/60 space-y-2.5">
            <p className="text-[12px] text-graphite leading-relaxed">
              <span className="text-[9px] uppercase tracking-[0.12em] font-semibold mr-1.5" style={{ color: "#9A5A14" }}>Full risk</span>
              {p.exposure}
            </p>
            {p.marketOpportunity && (
              <p className="text-[12px] text-graphite leading-relaxed">
                <span className="text-[9px] uppercase tracking-[0.12em] font-semibold mr-1.5" style={{ color: "#C9922A" }}>Full upside</span>
                {p.marketOpportunity}
              </p>
            )}
            <p className="text-[12px] text-graphite leading-relaxed">
              <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mr-1.5">Full requirement</span>
              {p.requires}
            </p>
            <p className="text-[12px] text-graphite leading-relaxed">
              <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mr-1.5">Civica today</span>
              {p.posture}
            </p>
            <p className="font-mono text-[10px] tracking-wide text-muted leading-snug pt-1">
              {p.authorities.join(" · ")} · {p.source} · {p.effective}
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unified provision row — impact left, provision right
// ---------------------------------------------------------------------------

const IMPACT_STYLES: Record<ObbbaProvision["impactKind"], { labelClass: string; color: string }> = {
  dollar:  { labelClass: "text-[32px] font-bold leading-none", color: "#5C1F11" },
  count:   { labelClass: "text-[20px] font-bold leading-tight", color: "#5A544D" },
  risk:    { labelClass: "text-[14px] font-semibold leading-snug", color: "#9A5A14" },
  ready:   { labelClass: "text-[14px] font-semibold leading-snug", color: "#C9922A" },
};

function ProvisionRow({ p }: { p: ObbbaProvision }) {
  const statusMeta = STATUS_META[p.status];
  const impact = IMPACT_STYLES[p.impactKind];

  return (
    <li className="grid grid-cols-[200px_1fr] border-b border-hairline last:border-0">
      {/* LEFT — impact / downstream consequence */}
      <div className="pr-5 py-5 border-r border-hairline">
        <p className="text-[9px] uppercase tracking-[0.14em] font-semibold text-muted mb-1">
          National
        </p>
        <p className={impact.labelClass} style={{ color: impact.color }}>
          {p.impactLabel}
        </p>
        <p className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mt-1.5 mb-0.5">
          California
        </p>
        <p className="text-[11px] text-muted leading-snug">
          {p.impactKind === "dollar"
            ? p.impactSublabel.replace(/^California\s*·\s*/i, "")
            : p.impactSublabel}
        </p>
      </div>

      {/* RIGHT — provision detail */}
      <div className="pl-5 py-5">
        {/* Header: section + title + status */}
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="font-mono text-[11px] font-semibold text-graphite tracking-wide shrink-0">
              {p.section}
            </span>
            <h5 className="text-[14px] font-semibold text-ink leading-snug">
              {p.title}
            </h5>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StakeholderChips stakeholders={p.stakeholders} />
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold whitespace-nowrap"
              style={{ color: statusMeta.color, background: statusMeta.bg }}
            >
              <span className="w-1 h-1 rounded-full" style={{ background: statusMeta.color }} />
              {p.status}
            </span>
          </div>
        </div>

        {/* National rule — what the law actually says */}
        <p className="text-[13px] text-graphite leading-relaxed mb-1.5">
          {p.oneliner}
        </p>

        {/* California-specific callout for dollar provisions */}
        {p.heroSubhead && (
          <p className="text-[11px] text-graphite mb-3 pl-2 border-l-2 border-hairline">
            <span className="font-semibold text-graphite">California: </span>
            {p.heroSubhead.replace(/^California'?s? /i, "").replace(/^California /i, "")}
          </p>
        )}

        {/* Details toggle */}
        <details className="group">
          <summary className="cursor-pointer list-none text-[10px] uppercase tracking-[0.12em] font-semibold text-muted hover:text-ink transition-colors mt-1">
            <span className="group-open:hidden">+ if wrong · if right · posture</span>
            <span className="hidden group-open:inline">− collapse</span>
          </summary>
          <div className="mt-3 pt-3 border-t border-hairline/60 space-y-2">
            <p className="text-[12px] text-graphite leading-relaxed">
              <span className="text-[9px] uppercase tracking-[0.12em] font-semibold mr-1.5" style={{ color: "#9A5A14" }}>If wrong</span>
              {p.exposure}
            </p>
            {p.marketOpportunity && (
              <p className="text-[12px] text-graphite leading-relaxed">
                <span className="text-[9px] uppercase tracking-[0.12em] font-semibold mr-1.5" style={{ color: "#C9922A" }}>If right</span>
                {p.marketOpportunity}
              </p>
            )}
            <p className="text-[12px] text-graphite leading-relaxed">
              <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted mr-1.5">Civica today</span>
              {p.posture}
            </p>
            <p className="font-mono text-[10px] tracking-wide text-muted leading-snug pt-1">
              {p.authorities.join(" · ")} · {p.source} · {p.effective}
            </p>
          </div>
        </details>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function ObbbaReadinessPanel({
  provisions,
}: {
  provisions: ObbbaProvision[];
}) {
  const readyCount = provisions.filter((p) => p.status === "Ready").length;
  const partialCount = provisions.filter((p) => p.status === "Partial").length;

  return (
    <section
      aria-labelledby="obbba-readiness-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine rounded-[4px] p-7"
    >
      <div className="flex items-start justify-between gap-6 mb-5 flex-wrap">
        <div>
          <p className="eyebrow mb-1.5">
            Pillar 2 · OBBBA stress test · what the law costs if we get it wrong
          </p>
          <h3
            id="obbba-readiness-title"
            className="text-[20px] font-semibold tracking-tight text-ink leading-tight"
          >
            Seven federal SNAP rules tightened in 2025 — national rules, California exposure
          </h3>
          <p className="text-[13px] text-graphite mt-2 max-w-3xl leading-relaxed">
            These rules apply to every state. The left column shows what&apos;s at stake
            downstream — dollars, people, or risk — if a provision is missed. The right
            shows what the law requires and where Civica stands today.
          </p>
        </div>
        <div className="text-right shrink-0">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold"
            style={
              partialCount > 0
                ? { background: "rgba(154,90,20,0.10)", color: "#9A5A14" }
                : { background: "rgba(201,146,42,0.10)", color: "#C9922A" }
            }
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {readyCount} ready · {partialCount} partial · FY2026 → FY2028
          </span>
          <p className="text-[11px] text-muted font-mono tracking-wide mt-1.5">
            source: COMPLIANCE_AUDIT_OBBBA.md · section10105.ts · section10106.ts
          </p>
        </div>
      </div>

      {/* Stakeholder legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-6 pb-5 border-b border-hairline">
        <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted self-center mr-1">
          Affected parties
        </span>
        {(Object.keys(STAKEHOLDER_META) as ObbbaStakeholder[]).map((key) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAKEHOLDER_META[key].color }} />
            <span className="font-semibold" style={{ color: STAKEHOLDER_META[key].color }}>{key}</span>
          </span>
        ))}
      </div>

      {/* Implementation timeline */}
      <ObbbaTimeline provisions={provisions} />

      {/* Column headers */}
      <div className="grid grid-cols-[200px_1fr] mb-1">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted pr-5">
          Impact
        </p>
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted pl-5">
          Provision · what the law requires
        </p>
      </div>

      {/* Unified provision list */}
      <ol className="border-t border-hairline">
        {provisions.map((p) => <ProvisionRow key={p.step} p={p} />)}
      </ol>

      <p className="text-[12px] text-graphite leading-relaxed mt-6 pt-4 border-t border-hairline/50">
        Dollar figures for §10105 and §10106 are California-specific, derived from
        <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5 mx-1">lib/analytics/section10105.ts</code>
        and
        <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5 mx-1">lib/analytics/section10106.ts</code>.
        Provision detail tracked in
        <code className="font-mono text-[11px] bg-paper border border-hairline rounded px-1 py-0.5 mx-1">COMPLIANCE_AUDIT_OBBBA.md</code>.
      </p>
    </section>
  );
}
