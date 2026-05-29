"use client";

import { useEffect, useRef, useState } from "react";

// Order matches the page scroll. All 7 parts numbered consistently so the
// nav reads as a sequence. Section IDs stay unchanged (pillar-*, landscape,
// model) to avoid breaking in-page anchors — only the user-visible labels
// follow the Part X scheme.
const PILLARS = [
  { id: "pillar-1",  label: "Part 1 · Rules" },
  { id: "pillar-2",  label: "Part 2 · OBBBA" },
  { id: "pillar-3",  label: "Part 3 · Errors" },
  { id: "landscape", label: "Part 4 · Landscape" },
  { id: "pillar-4",  label: "Part 5 · Verification" },
  { id: "pillar-5",  label: "Part 6 · Outcomes" },
  { id: "model",     label: "Part 7 · Model" },
];

// Scroll-position threshold (px below the top of the viewport). The active
// section is the LAST one whose top has scrolled above this line — i.e. the
// most recently-passed section header. Tuned to sit just below the sticky
// nav (~40px) plus a small reading buffer.
const SCROLL_THRESHOLD_PX = 120;

export default function PillarNav() {
  const [active, setActive] = useState<string>("pillar-1");
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs    = useRef<Map<string, HTMLAnchorElement>>(new Map());

  // Scroll-position scrollspy. Simpler + more reliable than the per-section
  // IntersectionObserver band: we just measure each section's top edge each
  // frame and pick the last one that's scrolled past the threshold.
  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      let activeId = PILLARS[0].id;
      for (const { id } of PILLARS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= SCROLL_THRESHOLD_PX) activeId = id;
        else break;
      }
      setActive((prev) => (prev === activeId ? prev : activeId));
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll the active chip into view on mobile, where the nav row overflows
  // horizontally. Desktop has room for all chips; this is a no-op there.
  useEffect(() => {
    const chip = chipRefs.current.get(active);
    const scroller = scrollerRef.current;
    if (!chip || !scroller) return;
    if (scroller.scrollWidth <= scroller.clientWidth) return; // no overflow

    const chipLeft   = chip.offsetLeft;
    const chipRight  = chipLeft + chip.offsetWidth;
    const viewLeft   = scroller.scrollLeft;
    const viewRight  = viewLeft + scroller.clientWidth;
    const padding    = 24;

    if (chipLeft < viewLeft + padding) {
      scroller.scrollTo({ left: chipLeft - padding, behavior: "smooth" });
    } else if (chipRight > viewRight - padding) {
      scroller.scrollTo({ left: chipRight - scroller.clientWidth + padding, behavior: "smooth" });
    }
  }, [active]);

  return (
    <nav className="sticky top-0 z-40 bg-paper/95 backdrop-blur-sm border-b border-hairline">
      <div
        ref={scrollerRef}
        className="max-w-6xl mx-auto px-8 py-2 flex items-center gap-1 overflow-x-auto snap-x scroll-px-8"
        style={{ scrollbarWidth: "none" }}
      >
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted mr-3 whitespace-nowrap shrink-0">
          Jump to
        </span>
        {PILLARS.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            ref={(el) => {
              if (el) chipRefs.current.set(id, el);
              else chipRefs.current.delete(id);
            }}
            onClick={() => setActive(id)}
            className="px-3 py-1 rounded-full text-[11px] tracking-wide font-semibold transition-colors whitespace-nowrap shrink-0 snap-start"
            style={
              active === id
                ? { background: "rgba(201,146,42,0.12)", color: "var(--color-amber)" }
                : { color: "#6B655C" }
            }
          >
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
