import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const runtime = "edge";
export const alt = "Civica — Apply for CalFresh in 10 minutes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: { locale: string };
};

// Brand tokens (kept inline; ImageResponse runs in an isolated edge env
// without access to globals.css).
const PAPER = "#F5F2EC";
const INK = "#1A1714";
const BRICK = "#9C3A24";
const GRAPHITE = "#5A544D";

export default async function OgImage({ params }: Props) {
  const { locale } = params;
  const t = await getTranslations({ locale, namespace: "landing" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: PAPER,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 44,
            fontWeight: 700,
            color: BRICK,
            letterSpacing: "-0.02em",
          }}
        >
          Civica
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 600,
              lineHeight: 1.08,
              color: INK,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
              display: "flex",
            }}
          >
            {t("hero.headline")}
          </div>
          <div
            style={{
              fontSize: 28,
              color: GRAPHITE,
              maxWidth: 980,
              display: "flex",
            }}
          >
            {t("hero.ctaPrimary")}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            height: 12,
            background: BRICK,
            borderRadius: 4,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
