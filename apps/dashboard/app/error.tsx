"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { ERROR_COPY } from "../lib/error-copy";

// Root error boundary — catches errors thrown inside the root layout's
// children. The root layout's <html>/<body>/chrome stay intact.
// Layout-level failures are caught by global-error.tsx instead.

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Fire a custom Sentry event so we can track USER-VISIBLE error frequency,
  // not just exception fire rate (per /plan-ceo-review D11). Sentry's
  // auto-instrumentation already captures the underlying exception.
  useEffect(() => {
    Sentry.captureMessage("dashboard.error_page_viewed", {
      level: "warning",
      tags: { digest: error.digest ?? "none" },
      extra: { pathname: typeof window !== "undefined" ? window.location.pathname : "" },
    });
  }, [error.digest]);

  const errorId = error.digest ?? ERROR_COPY.errorIdFallback;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-8 py-16">
      <div className="max-w-lg w-full bg-surface border border-hairline rounded-[4px] p-8 space-y-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-warning">
          {ERROR_COPY.status}
        </p>
        <h1 className="text-[22px] font-bold tracking-tight leading-tight text-ink">
          {ERROR_COPY.title}
        </h1>
        <p className="text-[13px] text-graphite font-mono leading-relaxed">
          {ERROR_COPY.errorIdLabel}: <span className="text-ink">{errorId}</span>
        </p>
        <p className="text-[14px] text-graphite leading-relaxed">
          {ERROR_COPY.notified}
        </p>
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="bg-pine text-paper px-4 py-2 rounded-[3px] text-[13px] font-semibold hover:bg-pine-pressed transition-colors focus:outline-none focus:ring-2 focus:ring-pine/30 focus:ring-offset-2 focus:ring-offset-paper"
          >
            {ERROR_COPY.retryCta}
          </button>
          <Link
            href="/dashboard"
            className="text-[13px] font-semibold text-pine hover:underline"
          >
            {ERROR_COPY.backCta} →
          </Link>
        </div>
      </div>
    </div>
  );
}
