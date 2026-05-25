"use client";

import { useEffect, useState } from "react";

type FormatKind =
  | "usd-compact"      // $1.2M, $432K, $87
  | "usd-full"         // $1,182,440
  | "count-compact"    // 3.4K, 1.2M
  | "count-full"       // 3,412
  | "percent"          // 87%
  | "tenths-day";      // 8.4d (input is integer × 10)

function applyFormat(n: number, kind: FormatKind): string {
  switch (kind) {
    case "usd-compact": {
      const d = n / 100;
      if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(d >= 10_000_000 ? 1 : 2)}M`;
      if (d >= 1_000) return `$${(d / 1_000).toFixed(d >= 10_000 ? 0 : 1)}K`;
      return `$${d.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    }
    case "usd-full":
      return (n / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    case "count-compact":
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
      return n.toLocaleString();
    case "count-full":
      return n.toLocaleString();
    case "percent":
      return `${n}%`;
    case "tenths-day":
      return `${(n / 10).toFixed(1)}d`;
  }
}

/**
 * Easing count-up animation with named format kinds.
 *
 * Accepts a `format` string (not a function) so this Client Component can be
 * mounted inside Server Components without crossing the function-serialization
 * boundary. Add new format kinds above as needed.
 */
export function CountUp({
  target,
  durationMs = 1400,
  format,
  className,
}: {
  target: number;
  durationMs?: number;
  format: FormatKind;
  className?: string;
}) {
  const [v, setV] = useState(0);

  useEffect(() => {
    if (target === 0) { setV(0); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return <span className={className}>{applyFormat(v, format)}</span>;
}

// Re-exports for non-CountUp use (e.g. static labels in Server Components).
export function formatUSDCompact(cents: number): string {
  return applyFormat(cents, "usd-compact");
}
export function formatCountCompact(n: number): string {
  return applyFormat(n, "count-compact");
}
