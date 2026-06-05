"use client";
import { useState } from "react";

// FNS FY26 maximum monthly allotments — 48 contiguous states + DC.
// Source: same federal snapshot as eligibility-guide.ts MAX_BENEFIT_ONE_PERSON.
const MAX_BENEFIT: Record<number, number> = {
  1: 298, 2: 549, 3: 787, 4: 994, 5: 1182, 6: 1419, 7: 1569, 8: 1794,
};

export function BenefitEstimator() {
  const [size, setSize] = useState(2);
  const benefit = MAX_BENEFIT[Math.min(size, 8)];

  return (
    <div className="benefit-est">
      <div className="benefit-est__row">
        <span className="benefit-est__label">Household size</span>
        <div className="benefit-est__sizes" role="group" aria-label="Select household size">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              className={`benefit-est__size ${size === n ? "benefit-est__size--active" : ""}`}
              onClick={() => setSize(n)}
              aria-pressed={size === n}
            >
              {n}
            </button>
          ))}
          <button
            className={`benefit-est__size ${size >= 7 ? "benefit-est__size--active" : ""}`}
            onClick={() => setSize(7)}
            aria-pressed={size >= 7}
          >
            7+
          </button>
        </div>
      </div>
      <div className="benefit-est__result">
        Up to <strong className="benefit-est__amount">${benefit.toLocaleString()}/mo</strong> estimated
      </div>
    </div>
  );
}
