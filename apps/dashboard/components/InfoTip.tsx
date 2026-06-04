// InfoTip — a small accessible "ⓘ" affordance that reveals an explanation on
// hover or keyboard focus. CSS-only (no client JS) so it works inside server
// components. The explanation is also exposed to screen readers via aria-label
// on the trigger, so the visual tooltip is progressive enhancement, not the
// only path to the text.

export default function InfoTip({
  label,
  align = "center",
  width = "w-60",
}: {
  /** The explanation text. Also read by screen readers. */
  label: string;
  /** Horizontal anchor of the popover relative to the icon. */
  align?: "center" | "left" | "right";
  /** Tailwind width class for the popover. */
  width?: string;
}) {
  const pos =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span className="group relative ml-1.5 inline-flex align-middle">
      <span
        tabIndex={0}
        role="img"
        aria-label={label}
        className="flex h-[15px] w-[15px] cursor-help items-center justify-center rounded-full border border-graphite/40 text-[9px] font-semibold leading-none text-graphite outline-none transition-colors hover:border-graphite hover:text-ink focus-visible:ring-2 focus-visible:ring-pine/40"
      >
        i
      </span>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-2 ${pos} ${width} rounded-[4px] border border-hairline bg-surface px-3 py-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-graphite opacity-0 shadow-[0_4px_16px_rgba(0,0,0,0.10)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {label}
      </span>
    </span>
  );
}
