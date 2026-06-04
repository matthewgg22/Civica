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

  if (dismissed) return null;

  return (
    <aside
      className="app-island"
      role="complementary"
      aria-label="Download the Civica app"
      aria-hidden={!visible}
      data-visible={visible}
    >
      <button
        className="app-island__dismiss"
        aria-label={dismissLabel}
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>

      <div className="app-island__header">
        <div className="app-island__icon">
          <Image
            src="/civica-wheat-mark.png"
            alt="Civica"
            width={28}
            height={28}
            className="app-island__icon-img"
          />
        </div>
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
        aria-label={`${cta} — opens TestFlight`}
      >
        {cta}
      </a>
    </aside>
  );
}
