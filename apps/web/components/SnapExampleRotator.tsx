"use client";

// The hero's example exchanges, cycling (requested 2026-08-21).
//
// THE HONESTY CONTRACT CARRIES OVER FROM THE SINGLE CARD: every exchange is a
// real pipeline answer, shortened and labeled; a verdict line renders only on
// exchanges the pipeline graded CERTAIN. See snap-page.ts's examples comment.
//
// MOTION RULES (the design system bans decoration motion; this is the one
// deliberate exception, built inside the guardrails):
// - Auto-advance every 9s with an opacity-only crossfade (compositor-safe).
// - prefers-reduced-motion: NO auto-advance and NO transition — the dots
//   still work, so the content is never gated behind motion.
// - Hover or any focus inside the card pauses the timer; the reader is
//   reading.
// - Touching the dots stops auto-advance for good: a manual choice should
//   not be un-chosen by a timer (Vercel guideline: input-driven).
// - Height is stabilized by stacking every exchange in the same grid cell,
//   so the card sizes to its tallest member once and never reflows the page
//   while cycling (no CLS).
//
// SEO/no-JS: this is a client component, but Next still server-renders its
// initial markup — every exchange is in the HTML (the inactive ones hidden
// with aria-hidden + opacity), so crawlers and no-JS readers get all of it.

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

const ADVANCE_MS = 9_000;

export interface ExampleExchange {
  q: string;
  a: ReactNode;
  /** Present only when the pipeline graded this exchange CERTAIN. */
  verdict?: string;
}

export function SnapExampleRotator({
  items,
  dotLabelTemplate,
}: {
  items: ExampleExchange[];
  /** Localized accessible label for the dots, with {n} standing in for the
   *  1-based index — a STRING template, not a function, because this prop
   *  crosses the server→client boundary and must serialize. */
  dotLabelTemplate: string;
}) {
  const [active, setActive] = useState(0);
  const [manual, setManual] = useState(false);
  const [reduced, setReduced] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    // Guarded: jsdom (and some legacy embedded views) lack matchMedia; the
    // safe default is the motion path with its own pause affordances.
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (manual || reduced || items.length < 2) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) setActive((i) => (i + 1) % items.length);
    }, ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [manual, reduced, items.length]);

  return (
    <div
      className={`dmex__stage${reduced ? " dmex__stage--static" : ""}`}
      onMouseEnter={() => (pausedRef.current = true)}
      onMouseLeave={() => (pausedRef.current = false)}
      onFocus={() => (pausedRef.current = true)}
      onBlur={() => (pausedRef.current = false)}
    >
      <div className="dmex__stack">
        {items.map((item, i) => (
          <div
            key={i}
            className={`dmex__item${i === active ? " dmex__item--active" : ""}`}
            aria-hidden={i !== active}
            // Inactive exchanges stay in the DOM (server-rendered, crawlable)
            // but out of the tab order.
            {...(i !== active ? { inert: true } : {})}
          >
            <p className="dmex__q">{item.q}</p>
            <div className="dmex__a">{item.a}</div>
            {item.verdict ? <p className="dmex__verdict">{item.verdict}</p> : null}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="dmex__dots" role="group">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              className="dmex__dot"
              aria-label={dotLabelTemplate.replace("{n}", String(i + 1))}
              aria-pressed={i === active}
              onClick={() => {
                setActive(i);
                setManual(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
