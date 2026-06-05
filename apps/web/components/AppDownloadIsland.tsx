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

  // Dismissing doesn't remove the prompt entirely — it collapses to a small
  // bookmark tab hanging off the right edge so it can be reopened.
  if (dismissed) {
    return (
      <button
        className="app-island-tab"
        aria-label="Reopen the Civica app download prompt"
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
    );
  }

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
        aria-label={`${cta} — opens TestFlight`}
      >
        {cta}
      </a>
    </aside>
  );
}
