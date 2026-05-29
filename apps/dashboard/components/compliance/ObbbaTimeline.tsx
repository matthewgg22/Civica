"use client";

import type { ObbbaProvision } from "../../lib/analytics/obbba";

type Phase = {
  key: string;
  heading: string;
  badge: string;
  urgency: string;
  isDone: boolean;
  borderColor: string;
  headingColor: string;
  badgeBg: string;
  badgeColor: string;
  provisions: ObbbaProvision[];
};

export default function ObbbaTimeline({
  provisions,
}: {
  provisions: ObbbaProvision[];
}) {
  const phases: Phase[] = [
    {
      key: "active",
      heading: "Already active",
      badge: "In effect",
      urgency: "FY2025 — 4 provisions",
      isDone: true,
      borderColor: "var(--color-amber)",
      headingColor: "var(--color-amber)",
      badgeBg: "rgba(201,146,42,0.10)",
      badgeColor: "var(--color-amber)",
      provisions: provisions.filter(
        (p) => new Date(p.deadlineIso) < new Date("2026-01-01")
      ),
    },
    {
      key: "oct2026",
      heading: "Oct 1, 2026",
      badge: "~5 months out",
      urgency: "2 provisions incoming",
      isDone: false,
      borderColor: "var(--color-amber-dark)",
      headingColor: "var(--color-amber-dark)",
      badgeBg: "rgba(154,90,20,0.10)",
      badgeColor: "var(--color-amber-dark)",
      provisions: provisions.filter((p) => {
        const d = new Date(p.deadlineIso);
        return d >= new Date("2026-01-01") && d < new Date("2027-01-01");
      }),
    },
    {
      key: "fy2028",
      heading: "FY2028",
      badge: "Deadline Sep 2028",
      urgency: "1 provision — largest exposure",
      isDone: false,
      borderColor: "var(--color-amber-dark)",
      headingColor: "var(--color-amber-dark)",
      badgeBg: "rgba(154,90,20,0.08)",
      badgeColor: "var(--color-amber-dark)",
      provisions: provisions.filter(
        (p) => new Date(p.deadlineIso) >= new Date("2027-01-01")
      ),
    },
  ];

  return (
    <div className="mb-7 pb-6 border-b border-hairline">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-graphite mb-4">
        Implementation timeline · 7 provisions · FY2025 → FY2028
      </p>

      <div className="grid grid-cols-3 gap-3">
        {phases.map((phase) => (
          <div
            key={phase.key}
            className="rounded-[4px] border border-hairline bg-paper p-4"
            style={{ borderLeftWidth: 3, borderLeftColor: phase.borderColor }}
          >
            {/* Phase heading + badge */}
            <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
              <p
                className="text-[14px] font-bold tracking-tight leading-none"
                style={{ color: phase.headingColor }}
              >
                {phase.heading}
              </p>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ color: phase.badgeColor, background: phase.badgeBg }}
              >
                {phase.badge}
              </span>
            </div>

            {/* Provision list */}
            <ul className="space-y-2">
              {phase.provisions.map((p) => (
                <li key={p.step} className="flex items-start gap-1.5">
                  <span className="font-mono text-[10px] font-semibold text-graphite tracking-wide whitespace-nowrap pt-px shrink-0">
                    {p.section}
                  </span>
                  <span className="text-[12px] text-ink leading-snug">
                    {p.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
