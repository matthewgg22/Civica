"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { GLOBAL_ERROR_COPY } from "../lib/error-copy";

// Layout-level error boundary — catches errors thrown by the root layout
// itself (font load failures, top-level imports). Must own its own <html>
// and <body> because the root layout has failed. Sentry catches the
// underlying exception automatically via withSentryConfig.
//
// Inline styles only — globals.css may not have loaded if the layout failed,
// so we cannot rely on Tailwind utility classes here.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureMessage("dashboard.global_error_page_viewed", {
      level: "fatal",
      tags: { digest: error.digest ?? "none" },
    });
  }, [error.digest]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          padding: 0,
          backgroundColor: "#F7F5EF",
          color: "#1A1714",
          fontFamily:
            "'Hanken Grotesk', system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            padding: "2rem",
            margin: "1rem",
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: "4px",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              // Inline hex, NOT var(--color-warning): global-error renders
              // when the root layout itself threw, so globals.css may not be
              // loaded and the CSS variable would resolve to nothing. Every
              // other color in this file is a hex literal for the same
              // reason. #B5511E === --color-warning. See PR #352 (same bug
              // class in the Satori opengraph images).
              color: "#B5511E",
              marginBottom: "1.25rem",
            }}
          >
            {GLOBAL_ERROR_COPY.status}
          </p>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 700,
              lineHeight: 1.2,
              margin: 0,
              marginBottom: "1.25rem",
            }}
          >
            {GLOBAL_ERROR_COPY.title}
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#443F38",
              lineHeight: 1.6,
              marginBottom: "1.5rem",
            }}
          >
            {GLOBAL_ERROR_COPY.notified}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              backgroundColor: "#2D5A45",
              color: "#F7F5EF",
              padding: "0.5rem 1rem",
              borderRadius: "3px",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {GLOBAL_ERROR_COPY.retryCta}
          </button>
        </div>
      </body>
    </html>
  );
}
