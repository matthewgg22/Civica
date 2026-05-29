/**
 * KpiCard — shared KPI tile used by /cbo-preview, /cdss, and
 * /compliance/county/[slug]. Extracted from three inlined copies per
 * /plan-design-review T10 + /plan-eng-review note (dead variant cleanup).
 *
 * Variant union is intentionally narrow:
 *   - "neutral" — default; ink-colored value, hairline border.
 *   - "warning" — burnt-orange value, warning-tinted border. Use when
 *     the metric is signaling something to investigate (high error rate,
 *     stalled processing, expiring window).
 *
 * The pre-extraction copies had dead variants ("positive" + "success")
 * that both rendered identically to "neutral" — same `--color-ink` value
 * color. We drop them; existing callsites switch to "neutral."
 */

import type { CSSProperties } from "react";

export type KpiCardVariant = "neutral" | "warning";

export interface KpiCardProps {
  label: string;
  value: string;
  subtext: string;
  variant?: KpiCardVariant;
}

export default function KpiCard({
  label,
  value,
  subtext,
  variant = "neutral",
}: KpiCardProps) {
  const accentColor =
    variant === "warning" ? "var(--color-warning)" : "var(--color-ink)";

  const borderStyle: CSSProperties =
    variant === "warning"
      ? {
          borderColor:
            "color-mix(in srgb, var(--color-warning) 30%, transparent)",
        }
      : {};

  return (
    <div
      className="bg-surface rounded-[4px] border border-hairline p-5"
      style={borderStyle}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className="text-3xl font-semibold tabular-nums mt-2 leading-none"
        style={{ color: accentColor }}
      >
        {value}
      </p>
      <p className="text-[12px] text-graphite mt-1.5 leading-relaxed">
        {subtext}
      </p>
    </div>
  );
}
