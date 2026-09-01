// Link preview card.
//
// Until now a shared Demeter link rendered as a bare URL — in a CBO's Slack, in
// a funder's inbox, in a text message to someone who needs SNAP. This is the
// cheapest credibility surface there is.
//
// Palette is from the Demeter design spec: parchment #FCF8F1, ink #2A211C,
// terracotta #C0553B, wheat gold #EFB544 (mark only — never a UI fill). Built
// with the system font stack rather than fetching Space Grotesk, because an
// OG route that depends on a network font fetch fails silently at the worst
// possible moment.

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Demeter. Verified answers about SNAP, for any state";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FCF8F1",
          padding: "72px 80px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Sun disc — the mark. Wheat gold appears here and nowhere else. */}
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              background: "#C0553B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 999, background: "#EFB544" }} />
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: "#2A211C",
              letterSpacing: "-0.02em",
            }}
          >
            Demeter
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              fontSize: 74,
              fontWeight: 600,
              color: "#2A211C",
              letterSpacing: "-0.042em",
              lineHeight: 1.04,
              maxWidth: 900,
            }}
          >
            Verified answers about SNAP. For any state.
          </div>
          <div style={{ fontSize: 30, color: "#5E4F45", lineHeight: 1.45, maxWidth: 820 }}>
            Free. No account. Every answer cites the rule it came from, so you can check it
            yourself.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 120, height: 4, background: "#C0553B", borderRadius: 999 }} />
          {/* Demeter now answers in four languages. English names for
              Vietnamese and Chinese on purpose: this route uses only the system
              font stack (no bundled/fetched font, by design — see top), which
              cannot render CJK, so native "中文" here would be tofu boxes.
              Español stays native. */}
          <div style={{ fontSize: 24, color: "#8A7666", letterSpacing: "0.06em" }}>
            English · Español · Vietnamese · Chinese
          </div>
        </div>
      </div>
    ),
    size,
  );
}
