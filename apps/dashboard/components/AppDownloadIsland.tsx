"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "https://testflight.apple.com/";

interface Props {
  label?: string;
  sub?: string;
  cta?: string;
  dismissLabel?: string;
}

export function AppDownloadIsland({
  label = "View on iPhone or iPad",
  sub = "Manage cases on the go",
  cta = "Download the app →",
  dismissLabel = "Close app download prompt",
}: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  if (dismissed) return null;

  return (
    <aside
      role="complementary"
      aria-label="Download the Civica app"
      aria-hidden={!visible}
      className={[
        "fixed bottom-6 right-6 z-50 w-[240px] rounded-[4px] p-[14px]",
        "bg-pine",
        "[box-shadow:0_4px_20px_rgba(0,0,0,0.22),0_1px_4px_rgba(0,0,0,0.08)]",
        "transition-none",
        visible
          ? "opacity-100 pointer-events-auto motion-safe:animate-island-in"
          : "opacity-0 pointer-events-none",
        /* mobile: full-width strip */
        "max-[479px]:left-4 max-[479px]:right-4 max-[479px]:w-auto max-[479px]:bottom-4",
        "max-[479px]:flex max-[479px]:flex-row max-[479px]:items-center max-[479px]:gap-2.5 max-[479px]:py-2.5",
      ].join(" ")}
    >
      {/* dismiss — 44px touch target */}
      <button
        aria-label={dismissLabel}
        onClick={() => setDismissed(true)}
        className="absolute top-0 right-0 p-[13px] text-[11px] leading-none text-white/60 hover:text-white bg-transparent border-0 cursor-pointer max-[479px]:static max-[479px]:order-3 max-[479px]:p-2"
      >
        ✕
      </button>

      {/* icon + text row */}
      <div className="flex items-center gap-[11px] mb-[11px] pr-[18px] max-[479px]:flex-1 max-[479px]:mb-0 max-[479px]:pr-0 max-[479px]:min-w-0">
        <Image
          src="/civica-app-icon.png"
          alt="Civica"
          width={42}
          height={42}
          className="shrink-0 w-[42px] h-[42px] rounded-[9px] object-cover [box-shadow:0_2px_6px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.35),inset_0_0_0_1px_rgba(255,255,255,0.16)]"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold leading-[1.25] tracking-[-0.01em] text-white m-0">{label}</p>
          <p className="text-[11px] leading-[1.35] text-white/70 m-0 max-[479px]:hidden">{sub}</p>
        </div>
      </div>

      {/* CTA */}
      <a
        href={TESTFLIGHT_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${cta} — opens TestFlight`}
        className="block w-full py-2 rounded-[3px] bg-transparent border border-white/60 text-white text-[12px] font-semibold text-center no-underline hover:border-white hover:bg-white/8 transition-colors max-[479px]:w-auto max-[479px]:whitespace-nowrap max-[479px]:px-3 max-[479px]:shrink-0"
      >
        {cta}
      </a>
    </aside>
  );
}
