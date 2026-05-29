import { ImageResponse } from "next/og";
import { getCountyExposure } from "../../../../lib/countyExposure";

// Per-county OG image for /compliance/county/[slug].
// Static-generated at build time, one PNG per supported county slug
// (generateStaticParams in page.tsx pre-renders all 58). Mirrors the
// pine-on-paper visual of the in-page header.
//
// Preview a county's image directly at:
//   /compliance/county/los-angeles/opengraph-image
// (Twitter card: same image, set by twitter.card = summary_large_image in
//  page.tsx generateMetadata.)

export const alt =
  "Civica · per-county SNAP §10105 compliance brief";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const county = getCountyExposure(slug);

  // Defensive fallback — generateStaticParams should cover every slug, but
  // if a request comes in for an unknown one, render a neutral card rather
  // than crashing the OG endpoint.
  const displayName = county?.displayName ?? "California county";
  const exposureLabel = county?.estimatedExposureLabel ?? "—";
  const shareLabel = county?.caseloadSharePctLabel ?? "—";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0D2B2B",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Eyebrow row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.4)",
              textTransform: "uppercase",
              letterSpacing: 2,
              fontWeight: 600,
            }}
          >
            Civica · Compliance brief · {displayName}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              border: "1px solid rgba(232,197,71,0.75)",
              borderRadius: 999,
              padding: "4px 16px",
              fontSize: 14,
              color: "var(--color-wheat)",
              letterSpacing: 1,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--color-wheat)",
              }}
            />
            <div>§10105 · FY2026–FY2028</div>
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -1.2,
            maxWidth: 1060,
          }}
        >
          <div>SNAP enrollment exposure</div>
          <div style={{ color: "rgba(255,255,255,0.65)" }}>for {displayName}</div>
        </div>

        {/* TL;DR strip — 2 numbers: exposure + caseload share */}
        <div
          style={{
            display: "flex",
            gap: 96,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 32,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: 84,
                fontWeight: 700,
                lineHeight: 1,
                color: "var(--color-wheat)",
              }}
            >
              {exposureLabel}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Est. §10105 exposure · FY2026–FY2028
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: 84,
                fontWeight: 700,
                lineHeight: 1,
                color: "rgba(255,255,255,0.92)",
              }}
            >
              {shareLabel}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "rgba(255,255,255,0.55)",
                letterSpacing: 1.5,
                textTransform: "uppercase",
              }}
            >
              Of CA CalFresh applications
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
