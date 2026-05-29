import Link from "next/link";

/**
 * Breadcrumbs — wayfinding chrome for detail pages.
 *
 * Per /plan-design-review D11 + /plan-ceo-review D4 + /plan-eng-review D4:
 * each page passes its breadcrumb chain explicitly via the items prop. The
 * last item is treated as the current page (unlinked even if href is
 * provided). Empty arrays render nothing — safer than rendering an empty
 * <nav>. Long labels truncate with ellipsis so a 47-char applicant name
 * never overflows the chrome.
 *
 * Server component. Zero JS. ARIA nav landmark + ordered list semantics
 * for screen readers; visual separator is decorative + aria-hidden.
 */

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-[13px] mb-3">
      <ol className="flex items-center gap-1.5 flex-wrap">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5 min-w-0">
              {isLast || !item.href ? (
                <span
                  className="text-graphite font-semibold truncate max-w-[40ch]"
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-pine font-semibold hover:underline truncate max-w-[40ch] focus:outline-none focus:ring-2 focus:ring-pine/30 rounded-[2px]"
                >
                  {item.label}
                </Link>
              )}
              {!isLast && (
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
