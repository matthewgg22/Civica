"use client";

// The contents list, with the section you are reading marked.
//
// THESE PAGES ARE DELIBERATELY TEXT. The renderer is a server component with
// no state, because a legal document does not need JavaScript to be readable
// — and this does not change that. The list is server-rendered in full and
// every link works before, during and after hydration; the script only adds
// the highlight. If it never runs, the page is exactly what it was.
//
// Which is also why the active state is a decoration and not the only way to
// know where you are: the headings are numbered, and the numbers are in the
// text.

import { useEffect, useRef, useState } from "react";

export interface ContentsEntry {
  id: string;
  heading: string;
}

/** The band near the top of the viewport that decides "current". A section is
 *  current while its box crosses it, which is roughly where your eye is —
 *  not the top edge, where a heading is already read, and not the middle,
 *  which lags a screen behind. */
const ACTIVE_BAND = "-12% 0px -70% 0px";

export function LegalContents({
  entries,
  label,
}: {
  entries: ContentsEntry[];
  label: string;
}) {
  // Starts on the first section rather than nothing: at the top of the page
  // you are, in every sense that matters, at the beginning.
  const [activeId, setActiveId] = useState(entries[0]?.id ?? null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const nodes = entries
      .map((e) => document.getElementById(e.id))
      .filter((n): n is HTMLElement => n !== null);
    if (nodes.length === 0) return;

    const inBand = new Map<string, number>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          if (r.isIntersecting) inBand.set(r.target.id, r.boundingClientRect.top);
          else inBand.delete(r.target.id);
        }
        // Nothing in the band happens constantly — between two sections, in a
        // long paragraph. Keeping the last one is the difference between a
        // marker and a flicker.
        if (inBand.size === 0) return;
        // THE LAST ONE TO HAVE ENTERED, not the one sitting highest.
        // Two sections straddle the band constantly: the outgoing one's
        // bottom is still in it while the incoming one's top arrives. The
        // section you are now reading is the one that just started — the
        // GREATEST top, not the smallest. Picking the smallest marks the
        // section you have already finished, which reads as the marker
        // lagging a heading behind the whole way down.
        let best: string | null = null;
        let bestTop = -Infinity;
        for (const [id, top] of inBand) {
          if (top > bestTop) {
            bestTop = top;
            best = id;
          }
        }
        if (best) setActiveId(best);
      },
      { rootMargin: ACTIVE_BAND, threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));

    // THE LAST SECTIONS ARE THE SHORT ONES. "Other terms" and "Contact" can
    // be too short to ever reach the band, so scrolling to the bottom would
    // leave the marker stranded three entries above where you are.
    const onScroll = () => {
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) setActiveId(entries[entries.length - 1]!.id);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [entries]);

  // Keep the marker inside its own scroll box WITHOUT touching the page's
  // scroll — scrollIntoView would drag the document with it.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !activeId) return;
    // Matched by attribute rather than by selector: a selector would need
    // CSS.escape, which is an optional global (jsdom has no `CSS` at all), and
    // depending on it here would mean the marker silently stops following in
    // any environment that lacks it.
    const el = [...list.querySelectorAll("a")].find(
      (a) => a.getAttribute("href") === `#${activeId}`,
    );
    if (!el) return;
    const top = el.offsetTop - list.offsetTop;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + el.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = top + el.offsetHeight - list.clientHeight;
    }
  }, [activeId]);

  return (
    <nav className="lgl__toc" aria-label={label}>
      <p className="lgl__toc-label">{label}</p>
      {/* No list marker: every heading already begins with its own number, and
          the numbers are cross-referenced in the body ("Section 13.10"), so
          they belong in the text rather than in a marker that would print
          "1. 1. This agreement". */}
      <ol className="lgl__toc-list" ref={listRef}>
        {entries.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              className={e.id === activeId ? "is-current" : undefined}
              // "location", not "page" — this marks a position WITHIN the
              // document, and the document is the page.
              aria-current={e.id === activeId ? "location" : undefined}
            >
              {e.heading}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
