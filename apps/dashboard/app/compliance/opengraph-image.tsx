import { ImageResponse } from "next/og";

// Static OG image for /compliance. Generated at build time and cached.
// Mirrors the hero card visually: pine background, wheat-gold TL;DR stats,
// the same stakes-first headline that lands in-page.
//
// To regenerate after editing this file:
//   - `next build` produces the PNG and Next.js auto-links it via <meta>
//   - Test the preview at: /compliance/opengraph-image
// (Twitter card: this same image is used because we set twitter.card =
//  summary_large_image in page.tsx metadata. No separate file needed.)

export const alt =
  "Civica · SNAP enrollment infrastructure · 35.5M Americans qualify for SNAP, Civica enrolls the 16M who don't";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

const TILES: { value: string; suffix?: string; label: string }[] = [
  { value: "$13B", suffix: "/yr",    label: "SNAP payment errors" },
  { value: "16M",                    label: "eligible · not enrolled" },
  { value: "3",    suffix: "layers", label: "operator · gov · adjacency" },
  { value: "$1B+", suffix: "/yr",    label: "CA reachable value" },
];

export default async function Image() {
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
        {/* Eyebrow row — positioning + pilot status pill */}
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
            Civica · SNAP enrollment infrastructure · CA pilot
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
            <div>CA · LIVE</div>
          </div>
        </div>

        {/* Headline — stakes-first, mirrors in-page H1 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 62,
            fontWeight: 700,
            lineHeight: 1.12,
            letterSpacing: -1.2,
            maxWidth: 1060,
          }}
        >
          <div>35.5M Americans qualify for SNAP.</div>
          <div style={{ color: "rgba(255,255,255,0.65)" }}>
            Civica enrolls the 16M who don&apos;t.
          </div>
        </div>

        {/* TL;DR strip — same 4 numbers as the in-page hero */}
        <div
          style={{
            display: "flex",
            gap: 64,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            paddingTop: 32,
          }}
        >
          {TILES.map((t) => (
            <div
              key={t.label}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  color: "var(--color-wheat)",
                }}
              >
                <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1 }}>
                  {t.value}
                </div>
                {t.suffix && (
                  <div
                    style={{
                      fontSize: 22,
                      color: "rgba(255,255,255,0.35)",
                      marginLeft: 6,
                      fontFamily: "monospace",
                    }}
                  >
                    {t.suffix}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "rgba(255,255,255,0.55)",
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {t.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
