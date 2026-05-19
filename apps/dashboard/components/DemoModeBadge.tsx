"use client";

/**
 * DemoModeBadge — small pill indicating demo/placeholder data is active.
 * Shown when ?demo=true in URL or when real analytics data is unavailable.
 * Uses amber border (deadline/warning token, NOT brick which is brand/CTA).
 */
export default function DemoModeBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider border"
      style={{
        color: "var(--color-amber)",
        borderColor: "var(--color-amber)",
        backgroundColor: "color-mix(in srgb, var(--color-amber) 8%, transparent)",
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: "var(--color-amber)" }}
      />
      Demo data
    </span>
  );
}
