"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Layout-level error boundary — catches errors thrown by the root layout
// itself (next/font load failure, top-level import crash). Must own its own
// <html> and <body> because the root layout has failed.
//
// Inline styles only — globals.css may not be loaded if the layout failed,
// so CSS variables would resolve to nothing. Every color and length is a
// literal. English only (i18n.ts may not have loaded either).

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureMessage("web.global_error_page_viewed", {
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
          padding: "1rem",
          backgroundColor: "#F7F5EF",
          color: "#1A1714",
          fontFamily:
            "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            width: "100%",
            padding: "2rem",
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
              color: "#9C3A24",
              margin: 0,
              marginBottom: "1.25rem",
            }}
          >
            SOMETHING WENT WRONG
          </p>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              lineHeight: 1.2,
              margin: 0,
              marginBottom: "1.25rem",
              letterSpacing: "-0.01em",
            }}
          >
            Civica could not load this page.
          </h1>
          <p
            style={{
              fontSize: "1rem",
              color: "#5A544D",
              lineHeight: 1.6,
              margin: 0,
              marginBottom: "1.5rem",
            }}
          >
            Our team has been notified. Try reloading, or head back to the
            home page.
          </p>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                backgroundColor: "#2D5A45",
                color: "#F7F5EF",
                padding: "0.5rem 1.25rem",
                borderRadius: "3px",
                border: "none",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#2D5A45",
                textDecoration: "none",
              }}
            >
              Back to Civica →
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
