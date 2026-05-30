"use client";

/**
 * IncomingDataFeed — last N packets benchmarked against the thesis.
 *
 * Verbatim the user's ask: "pulling data from applicants to see how it is
 * tracking." Each row shows one packet's engagement vector (which pillars
 * have signal), per-packet realization gap, and a what-would-close-it hint.
 *
 * Filter chips: All / Missing income / Missing shelter / Missing OBBBA-impact /
 * Stack engaged · verify projection. The last chip is the validation lens —
 * filter to packets where the full stack DID engage, then check whether
 * their per-packet realization tracks the projected ~5.5%.
 *
 * Plan §3.3 + cross-model tension CMT2 (engagement-implied, not measured).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CA_BASELINE_PER,
  PROJECTED_PER_AT_FULL_ENGAGEMENT,
  computeEngagementImpliedPER,
  type PillarCoverage,
} from "@civica/snap-qc-engine";

export interface FeedPacket {
  packetId: string;
  applicantInitials: string;
  daysPending: number;
  /** Binary per-pillar engagement for this packet (true/false). */
  engagement: {
    income: boolean;          // Argyle connected
    shelter: boolean;          // lease doc confirmed
    suaFlags: boolean;         // SUA utility questions answered
    obbbaImpactTagged: boolean; // OBBBA-impacted packet had rule chain run
  };
}

export interface IncomingDataFeedProps {
  packets: FeedPacket[];
}

type FilterKey =
  | "all"
  | "missing-income"
  | "missing-shelter"
  | "missing-obbba"
  | "stack-engaged";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All packets" },
  { key: "missing-income", label: "Missing income wire" },
  { key: "missing-shelter", label: "Missing shelter doc" },
  { key: "missing-obbba", label: "Missing OBBBA tag" },
  { key: "stack-engaged", label: "Stack engaged · verify projection" },
];

function packetCoverage(p: FeedPacket): PillarCoverage {
  return {
    utility_sua: p.engagement.shelter && p.engagement.suaFlags ? 1 : 0,
    gig_income: p.engagement.income ? 1 : 0,
    shared_lease: 0, // classifier UI pending across the cohort
    assets: 0,
    benefit_impact: 1,
  };
}

function packetRealizationGap(p: FeedPacket): number {
  const per = computeEngagementImpliedPER(packetCoverage(p));
  return per - PROJECTED_PER_AT_FULL_ENGAGEMENT;
}

function whatWouldClose(p: FeedPacket): string {
  if (!p.engagement.income && !p.engagement.shelter) {
    return "Connect Argyle + upload lease";
  }
  if (!p.engagement.income) return "Connect Argyle";
  if (!p.engagement.shelter) return "Upload lease document";
  if (!p.engagement.suaFlags) return "Answer SUA utility questions";
  if (!p.engagement.obbbaImpactTagged) return "Run OBBBA rule chain";
  return "Stack engaged · projection holds";
}

function matchesFilter(p: FeedPacket, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "missing-income":
      return !p.engagement.income;
    case "missing-shelter":
      return !p.engagement.shelter;
    case "missing-obbba":
      return !p.engagement.obbbaImpactTagged;
    case "stack-engaged":
      return (
        p.engagement.income &&
        p.engagement.shelter &&
        p.engagement.suaFlags
      );
  }
}

export default function IncomingDataFeed({ packets }: IncomingDataFeedProps) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(
    () => packets.filter((p) => matchesFilter(p, filter)),
    [packets, filter],
  );

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      "all": packets.length,
      "missing-income": 0,
      "missing-shelter": 0,
      "missing-obbba": 0,
      "stack-engaged": 0,
    };
    for (const p of packets) {
      if (!p.engagement.income) c["missing-income"]++;
      if (!p.engagement.shelter) c["missing-shelter"]++;
      if (!p.engagement.obbbaImpactTagged) c["missing-obbba"]++;
      if (
        p.engagement.income &&
        p.engagement.shelter &&
        p.engagement.suaFlags
      )
        c["stack-engaged"]++;
    }
    return c;
  }, [packets]);

  return (
    <section
      aria-labelledby="data-feed-title"
      className="bg-surface border border-hairline border-t-2 border-t-pine-surface rounded-[4px] p-5"
    >
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <p className="eyebrow mb-1">
            Incoming data feed · per-applicant signal feeding the formula
          </p>
          <h2
            id="data-feed-title"
            className="text-[16px] font-semibold tracking-tight text-ink leading-tight"
          >
            Last {Math.min(packets.length, 20)} packets · engagement vector + per-packet realization
          </h2>
          <p className="text-[12px] text-graphite mt-1 max-w-2xl leading-snug">
            Each row is one applicant&apos;s contribution to the engagement
            realization gap. Filter to{" "}
            <span className="font-semibold text-ink">stack-engaged</span> to
            isolate the cohort the projection is calibrated against.
          </p>
        </div>
        <span className="text-[11px] text-graphite font-mono tracking-wide shrink-0">
          n = {packets.length} packets
        </span>
      </div>

      {/* Filter chips */}
      <div
        role="radiogroup"
        aria-label="Filter packets by engagement"
        className="flex flex-wrap gap-1.5 mb-4"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              role="radio"
              aria-checked={active}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide transition-colors ${
                active
                  ? "bg-ink text-paper"
                  : "bg-paper border border-hairline text-graphite hover:text-ink"
              }`}
            >
              {f.label}{" "}
              <span
                className={`tabular-nums ${
                  active ? "opacity-80" : "text-muted"
                }`}
              >
                ({counts[f.key]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-hairline/60 rounded-[3px] px-4 py-6 text-center">
          <p className="text-[12px] text-graphite">
            No packets match this filter. Try a different lens, or wait for
            more applicants to flow through.
          </p>
        </div>
      ) : (
        <ul className="border border-hairline rounded-[3px] divide-y divide-hairline/60">
          {filtered.slice(0, 20).map((p) => (
            <FeedRow key={p.packetId} packet={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// One feed row
// ---------------------------------------------------------------------------

function FeedRow({ packet: p }: { packet: FeedPacket }) {
  const gap = packetRealizationGap(p);
  const stackEngaged =
    p.engagement.income && p.engagement.shelter && p.engagement.suaFlags;
  const gapColor =
    Math.abs(gap) < 0.5
      ? "#5A544D"
      : gap > 0
        ? "#9C3A24"
        : "#2A6F66";

  return (
    <li className="grid grid-cols-[110px_140px_60px_1fr_24px] items-baseline gap-3 px-3 py-2.5">
      {/* Packet ID + initials */}
      <div>
        <p className="font-mono text-[11px] font-semibold text-ink tracking-wide truncate">
          {p.packetId.slice(0, 8)}
        </p>
        <p className="text-[10px] text-graphite">{p.applicantInitials}</p>
      </div>

      {/* Engagement vector pills */}
      <div className="flex flex-wrap gap-1">
        <EngagementPill label="Inc" engaged={p.engagement.income} />
        <EngagementPill label="Shl" engaged={p.engagement.shelter} />
        <EngagementPill label="SUA" engaged={p.engagement.suaFlags} />
        <EngagementPill
          label="OBB"
          engaged={p.engagement.obbbaImpactTagged}
          variant="indigo"
        />
      </div>

      {/* Days pending */}
      <div className="text-right">
        <p className="text-[11px] font-mono tabular-nums text-graphite tracking-wide">
          {p.daysPending}d
        </p>
        <p className="text-[9px] text-muted">pending</p>
      </div>

      {/* Gap to thesis + what would close it */}
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className="text-[12px] font-semibold tabular-nums"
            style={{ color: gapColor }}
          >
            {gap >= 0 ? "+" : ""}
            {gap.toFixed(2)} pts
          </span>
          <span className="text-[10px] text-graphite">vs thesis</span>
        </div>
        <p className="text-[10px] text-graphite leading-snug mt-0.5 truncate">
          {whatWouldClose(p)}
        </p>
      </div>

      {/* Drill-in to /packets/[id] */}
      <Link
        href={`/packets/${p.packetId}`}
        className="text-[14px] text-graphite hover:text-pine shrink-0 self-center"
        aria-label={`Open packet ${p.packetId}`}
      >
        →
      </Link>
    </li>
  );
}

function EngagementPill({
  label,
  engaged,
  variant = "default",
}: {
  label: string;
  engaged: boolean;
  variant?: "default" | "indigo";
}) {
  const color = engaged
    ? variant === "indigo"
      ? "#4F46A5"
      : "#2A6F66"
    : "#5A544D";
  const bg = engaged
    ? variant === "indigo"
      ? "rgba(79,70,165,0.12)"
      : "rgba(42,111,102,0.12)"
    : "rgba(90,84,77,0.06)";
  return (
    <span
      className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm"
      style={{ color, background: bg, opacity: engaged ? 1 : 0.55 }}
      aria-label={`${label}: ${engaged ? "engaged" : "missing"}`}
    >
      {label}
    </span>
  );
}
