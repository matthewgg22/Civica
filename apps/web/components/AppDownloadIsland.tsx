"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const TESTFLIGHT_URL =
  process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? "https://testflight.apple.com/";

interface Props {
  label: string;
  sub: string;
  cta: string;
  dismissLabel?: string;
}

export function AppDownloadIsland({
  label,
  sub,
  cta,
  dismissLabel = "Close app download prompt",
}: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, []);

  // Both the full island and the collapsed bookmark tab stay mounted; we just
  // toggle data-attributes so CSS transitions animate the swap. On dismiss the
  // card slides out to the right edge as the tab slides in from the same edge
  // (one continuous motion), and the reverse on reopen — no mount/unmount jump.
  const islandOpen = visible && !dismissed;

  return (
    <>
      <aside
        className="app-island"
        role="complementary"
        aria-label="Download the Civica app"
        aria-hidden={!islandOpen}
        data-visible={islandOpen}
        data-collapsed={dismissed}
      >
        <button
          className="app-island__dismiss"
          aria-label={dismissLabel}
          tabIndex={islandOpen ? 0 : -1}
          onClick={() => setDismissed(true)}
        >
          ✕
        </button>

        <div className="app-island__header">
          <Image
            src="/civica-app-icon.png"
            alt="Civica"
            width={44}
            height={44}
            className="app-island__icon"
          />
          <div className="app-island__text">
            <p className="app-island__headline">{label}</p>
            <p className="app-island__sub">{sub}</p>
          </div>
        </div>

        <a
          className="app-island__btn"
          href={TESTFLIGHT_URL}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={islandOpen ? 0 : -1}
          aria-label={`${cta} — opens TestFlight`}
        >
          {cta}
        </a>
      </aside>

      <button
        className="app-island-tab"
        aria-label="Reopen the Civica app download prompt"
        aria-hidden={!dismissed}
        data-shown={dismissed}
        tabIndex={dismissed ? 0 : -1}
        onClick={() => setDismissed(false)}
      >
        <Image
          src="/civica-app-icon.png"
          alt=""
          width={26}
          height={26}
          className="app-island-tab__icon"
        />
        <span className="app-island-tab__label">{cta}</span>
      </button>
    </>
  );
}
