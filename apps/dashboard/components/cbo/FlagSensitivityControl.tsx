"use client";

// FlagSensitivityControl — SCAFFOLD (preview, not yet wired to persistence).
//
// Lets a CBO tune *which QC flags surface to navigators and what is held for
// review* — a triage layer only. It NEVER changes the determination, the
// benefit math, or the measured error rate, so the cross-CBO PER comparison
// and the §10105 audit story stay intact. The interactive state here is local;
// "Save" is a stub until the per-org preferences table + engine read-path land
// (tracked separately — see issue filed for flag-sensitivity persistence).

import { useState } from "react";

type Sensitivity = "conservative" | "balanced" | "thorough";

const LEVELS: { key: Sensitivity; label: string; blurb: string }[] = [
  {
    key: "conservative",
    label: "Conservative",
    blurb: "Only high-risk flags interrupt the line. Best for lean teams — fewer holds, faster handoff.",
  },
  {
    key: "balanced",
    label: "Balanced",
    blurb: "The default. High- and medium-risk flags surface; low-risk passes through passively.",
  },
  {
    key: "thorough",
    label: "Thorough",
    blurb: "Every flag surfaces for review. Best when accuracy is the priority over throughput.",
  },
];

// Mirrors the four QC pillars shown above. Focus = surface this pillar's flags
// one tier more aggressively than the global level.
const PILLARS = [
  "Income verification",
  "Household composition",
  "Work requirements",
  "Deduction calculation",
] as const;

export default function FlagSensitivityControl() {
  const [level, setLevel] = useState<Sensitivity>("balanced");
  const [focus, setFocus] = useState<Set<string>>(new Set());

  const toggleFocus = (p: string) => {
    setFocus((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const active = LEVELS.find((l) => l.key === level)!;

  return (
    <section aria-label="Flag sensitivity">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[14px] font-bold text-ink">Flag sensitivity</h2>
        <span className="rounded-sm bg-indigo/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo">
          Preview
        </span>
      </div>

      <div className="rounded-[4px] border border-hairline bg-surface p-5">
        <p className="text-[12px] leading-relaxed text-graphite">
          Tune how aggressively the engine surfaces flags to your navigators.
          This changes <span className="font-semibold text-ink">what gets reviewed</span>,
          never the eligibility determination, the benefit amount, or your measured
          error rate — so your numbers stay comparable and audit-ready.
        </p>

        {/* Segmented control */}
        <div
          role="radiogroup"
          aria-label="Global flag sensitivity level"
          className="mt-4 grid grid-cols-3 gap-1 rounded-[4px] border border-hairline bg-paper p-1"
        >
          {LEVELS.map((l) => {
            const selected = l.key === level;
            return (
              <button
                key={l.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setLevel(l.key)}
                className={`rounded-[3px] px-3 py-2 text-[12px] font-semibold transition-colors ${
                  selected
                    ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    : "text-graphite hover:text-ink"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{active.blurb}</p>

        {/* Per-pillar focus */}
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">
            Focus areas
          </p>
          <p className="mt-1 text-[12px] text-muted">
            Surface flags from these pillars one tier more aggressively than the level above.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {PILLARS.map((p) => {
              const on = focus.has(p);
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFocus(p)}
                  className={`rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    on
                      ? "border-pine bg-pine/10 text-pine"
                      : "border-hairline bg-surface text-graphite hover:border-graphite/40 hover:text-ink"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stub save row */}
        <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
          <p className="text-[11px] text-graphite">
            Preview only — saving preferences isn’t wired up yet.
          </p>
          <button
            type="button"
            disabled
            title="Coming soon — preference persistence is not yet wired"
            className="cursor-not-allowed rounded-[4px] border border-hairline bg-paper px-4 py-2 text-[12px] font-semibold text-graphite/60"
          >
            Save preferences
          </button>
        </div>
      </div>
    </section>
  );
}
