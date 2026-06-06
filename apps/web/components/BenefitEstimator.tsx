"use client";
import { useState, useEffect, useRef } from "react";

// FNS FY26 maximum monthly allotments — 48 contiguous states + DC.
const MAX_BENEFIT: Record<number, number> = {
  1: 298, 2: 549, 3: 787, 4: 994, 5: 1182, 6: 1419, 7: 1569, 8: 1794,
};

function useCountUp(target: number, duration = 320) {
  const [displayed, setDisplayed] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return;

    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return displayed;
}

export function BenefitEstimator() {
  const [size, setSize] = useState(2);
  const target = MAX_BENEFIT[Math.min(size, 8)];
  const displayed = useCountUp(target);
  const prevSize = useRef(size);
  const direction = size > prevSize.current ? "up" : size < prevSize.current ? "down" : "none";

  function handleSize(n: number) {
    prevSize.current = size;
    setSize(n);
  }

  return (
    <div className="benefit-est">
      <div className="benefit-est__row">
        <span className="benefit-est__label">Household size</span>
        <div className="benefit-est__sizes" role="group" aria-label="Select household size">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              className={`benefit-est__size ${size === n ? "benefit-est__size--active" : ""}`}
              onClick={() => handleSize(n)}
              aria-pressed={size === n}
            >
              {n}
            </button>
          ))}
          <button
            className={`benefit-est__size ${size >= 7 ? "benefit-est__size--active" : ""}`}
            onClick={() => handleSize(7)}
            aria-pressed={size >= 7}
          >
            7+
          </button>
        </div>
      </div>
      <div className="benefit-est__result" aria-live="polite">
        Up to{" "}
        <strong
          className={`benefit-est__amount benefit-est__amount--${direction}`}
          key={target}
        >
          ${displayed.toLocaleString()}/mo
        </strong>{" "}
        estimated
      </div>
    </div>
  );
}
