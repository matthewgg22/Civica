/**
 * SampleDataBanner — renders a top-of-page warning when
 * ANALYTICS_USE_SAMPLE_DATA is set on the server. Reads the env var directly
 * (server component), so the banner only appears in environments that have
 * explicitly opted into the demo / sample analytics path.
 *
 * Production environments must leave ANALYTICS_USE_SAMPLE_DATA unset.
 *
 * See apps/dashboard/SAMPLE_DATA.md for the operator runbook.
 */
export default function SampleDataBanner() {
  const enabled =
    process.env.ANALYTICS_USE_SAMPLE_DATA === "true" ||
    process.env.ANALYTICS_USE_SAMPLE_DATA === "1";

  if (!enabled) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full px-4 py-2 text-[12px] font-medium text-center border-b"
      style={{
        backgroundColor: "color-mix(in srgb, var(--color-amber) 12%, transparent)",
        color: "var(--color-amber)",
        borderColor: "color-mix(in srgb, var(--color-amber) 40%, transparent)",
      }}
    >
      Demo data — not real USDA / OBBBA values. See{" "}
      <code className="font-mono">apps/dashboard/SAMPLE_DATA.md</code> for
      details.
    </div>
  );
}
