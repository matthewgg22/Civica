"use client";

import { useState } from "react";
import LeadCaptureModal from "./LeadCaptureModal";

interface CountyUrgencyBannerProps {
  daysUntilDeadline: number;
}

/**
 * Full-width urgency banner for the §10106 admin cost dashboard.
 *
 * Color: --color-amber (deadline/warning token). NOT --color-brick which is
 * reserved for primary brand CTAs. Amber = deadlines. Brick = actions.
 *
 * Tablet-responsive: text wraps cleanly, no overflow at 768–1024px.
 */
export default function CountyUrgencyBanner({
  daysUntilDeadline,
}: CountyUrgencyBannerProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div
        className="w-full py-4 px-6 md:px-8 flex flex-col md:flex-row md:items-center gap-3 md:gap-6"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-amber) 12%, var(--color-paper))",
          borderBottom: "2px solid var(--color-amber)",
        }}
        role="alert"
      >
        {/* Left: headline + subtext */}
        <div className="flex-1 min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--color-amber)" }}
          >
            Deadline approaching
          </p>
          <p className="text-base md:text-lg font-semibold text-ink mt-0.5 leading-snug">
            <span
              className="tabular-nums font-bold"
              style={{ color: "var(--color-amber)" }}
            >
              {daysUntilDeadline} days
            </span>{" "}
            until Oct 1, 2026 —{" "}
            <span className="font-bold">
              Federal admin cost-share drops 50% → 25%
            </span>
          </p>
          <p className="text-sm text-graphite mt-0.5 leading-relaxed">
            §10106 cuts your federal reimbursement in half. Counties that
            reduce per-case processing cost before the deadline absorb
            the impact.
          </p>
        </div>

        {/* Right: CTA */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-[4px] text-sm font-semibold text-surface transition-colors whitespace-nowrap"
            style={{ backgroundColor: "var(--color-amber)" }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--color-amber) 80%, black)")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--color-amber)")
            }
          >
            Get your county&apos;s estimate
          </button>
        </div>
      </div>

      <LeadCaptureModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
