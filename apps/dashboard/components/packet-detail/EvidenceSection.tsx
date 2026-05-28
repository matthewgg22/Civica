import React from "react";

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  count?: number;
  summary?: string;
  flagged?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

/**
 * Collapsible card for "evidence" content on the packet detail page.
 *
 * Decide-zone sign-off gates stay as <Section>; reference + computed-advisory
 * material wraps in <EvidenceSection> so the page reads as two distinct zones.
 *
 * Auto-open rule: `defaultOpen` wins; otherwise opens when `flagged`. Closed
 * sections still surface their state through the summary chip text + the ⚠
 * glyph, so collapsing never hides a problem from a scanner.
 *
 * Uses native <details>/<summary> for free keyboard a11y, screen-reader
 * semantics, and prefers-reduced-motion compliance. See DESIGN.md §4.
 */
export default function EvidenceSection({
  id,
  title,
  subtitle,
  count,
  summary,
  flagged,
  defaultOpen,
  children,
}: Props) {
  const open = defaultOpen ?? flagged ?? false;
  return (
    <details
      id={id}
      open={open}
      className="group bg-surface border border-hairline rounded-[4px] overflow-hidden"
    >
      <summary
        className="cursor-pointer list-none flex items-center justify-between gap-4 px-6 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/30 focus-visible:ring-offset-2 focus-visible:ring-offset-paper rounded-[4px]"
      >
        <div className="flex items-baseline gap-3 min-w-0">
          <span
            aria-hidden="true"
            className="text-muted text-[11px] shrink-0 inline-block w-2 transition-transform duration-150 motion-reduce:transition-none group-open:rotate-90"
          >
            ▶
          </span>
          <h2 className="section-title truncate">{title}</h2>
          {count !== undefined && (
            <span className="text-[12px] text-muted tabular-nums shrink-0">({count})</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-muted shrink-0">
          {summary && <span>{summary}</span>}
          {flagged && (
            <span role="img" aria-label="needs attention" className="text-warning font-semibold">
              ⚠
            </span>
          )}
        </div>
      </summary>
      {subtitle && (
        <p className="section-sub px-6 -mt-1 mb-3 leading-snug">{subtitle}</p>
      )}
      <div className="bg-paper border-t border-hairline px-6 py-5 space-y-5">{children}</div>
    </details>
  );
}

export function EvidenceSectionSkeleton() {
  return (
    <div className="bg-surface border border-hairline rounded-[4px] px-6 py-4 animate-pulse">
      <div className="h-3 w-32 bg-paper rounded" />
    </div>
  );
}
