"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Layout-level error boundary — catches errors thrown by the root layout
// itself (next/font load failure, top-level import crash). Owns its own
// <html>/<body> because the root layout has failed.
//
// Inline styles only, literal values: globals.css and the --demeter-* tokens
// may not be loaded, and the Newsreader / Be Vietnam Pro faces load via the
// failed layout, so type falls back to Georgia / system sans. Palette is the
// Demeter tokens spelled out: paper #FFFFFF, ink #232220, body #4B4A46, muted
// #6C6A64, rule #E8E6E2, terracotta #C0553B / deep #8E3A26. English only
// (i18n may not have loaded either).

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
          backgroundColor: "#FFFFFF",
          color: "#232220",
          fontFamily:
            "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            maxWidth: "32rem",
            width: "100%",
            padding: "2.5rem",
            backgroundColor: "#FFFFFF",
            border: "1px solid #E8E6E2",
            borderRadius: "12px",
          }}
        >
          {/* Plain <img>, not next/image: the Next runtime this boundary
              depends on may itself be what failed. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/demeter-wheat-mark.png"
            alt="Demeter"
            width={40}
            height={40}
            style={{ display: "block", width: 40, height: 40, borderRadius: "50%", marginBottom: "1.5rem" }}
          />
          <p
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#8E3A26",
              margin: "0 0 0.75rem",
            }}
          >
            SOMETHING WENT WRONG
          </p>
          <h1
            style={{
              fontFamily: "'Newsreader', Georgia, 'Times New Roman', serif",
              fontSize: "1.9rem",
              fontWeight: 600,
              lineHeight: 1.12,
              letterSpacing: "-0.02em",
              margin: "0 0 1rem",
              color: "#232220",
            }}
          >
            Demeter couldn&rsquo;t load this page.
          </h1>
          <p
            style={{
              fontFamily: "'Newsreader', Georgia, 'Times New Roman', serif",
              fontSize: "1.05rem",
              color: "#4B4A46",
              lineHeight: 1.6,
              margin: "0 0 1.5rem",
            }}
          >
            Something on our end went wrong. Try reloading in a moment. This
            doesn&rsquo;t affect your SNAP case or eligibility.
          </p>
          <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                backgroundColor: "#C0553B",
                color: "#FFFFFF",
                padding: "0.7rem 1.4rem",
                minHeight: 44,
                borderRadius: "999px",
                border: "none",
                fontSize: "0.9rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* Plain <a>, not next/link: the Next runtime <Link> needs is the thing that failed here. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "#C0553B",
                textDecoration: "underline",
                textUnderlineOffset: "2px",
              }}
            >
              Go to Demeter →
            </a>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              lineHeight: 1.6,
              color: "#6C6A64",
              margin: "1.75rem 0 0",
              paddingTop: "1rem",
              borderTop: "1px solid #E8E6E2",
            }}
          >
            Need SNAP help right now? Contact your state SNAP agency, or dial 211
            to reach a local benefits navigator.
          </p>
        </div>
      </body>
    </html>
  );
}
