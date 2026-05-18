"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  children: React.ReactNode;
  /** Optional ms delay applied via CSS transition-delay for stagger. */
  delayMs?: number;
  className?: string;
};

/**
 * Tiny IntersectionObserver-driven fade/slide-in. Honors prefers-reduced-motion
 * by gating the transform/opacity transitions behind `motion-safe:` utilities,
 * so reduced-motion users see the content immediately at its final position.
 */
export function FadeInOnScroll({ children, delayMs = 0, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // If IntersectionObserver isn't available, just show immediately.
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={[
        "motion-safe:transition-all motion-safe:duration-500 motion-safe:ease-out",
        visible
          ? "opacity-100 motion-safe:translate-y-0"
          : "motion-safe:opacity-0 motion-safe:translate-y-2",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
