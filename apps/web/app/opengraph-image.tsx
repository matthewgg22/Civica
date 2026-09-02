// Link preview card.
//
// The cheapest credibility surface there is — a shared link in a CBO's Slack, a
// funder's inbox, a text to someone who needs SNAP. It should say, at a glance,
// what you DO here (start a conversation, find out about SNAP) and why to trust
// it (every answer cites the actual rule).
//
// Palette is from the Demeter design spec: parchment #FCF8F1, ink #2A211C,
// terracotta #C0553B, wheat gold #EFB544 (mark only). Built with the system
// font stack rather than fetching a webfont, because an OG route that depends
// on a network font fetch fails silently at the worst possible moment — which
// is also why the language line uses English names (this stack cannot render
// CJK; native "中文" would be tofu boxes).

import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Demeter AI — see if you qualify for SNAP, with verified answers for any state";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#FCF8F1",
          backgroundImage:
            "linear-gradient(135deg, #FDFAF4 0%, #FBF4E9 55%, #F6ECDA 100%)",
          padding: "70px 80px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        {/* A large, faint sun low in the corner — depth and brand, never louder
            than the words. Two concentric discs evoke the mark's rings. */}
        <div
          style={{
            position: "absolute",
            right: -170,
            bottom: -190,
            width: 560,
            height: 560,
            borderRadius: 999,
            backgroundColor: "#F3E7D0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 380, height: 380, borderRadius: 999, backgroundColor: "#F7EEDD", display: "flex" }} />
        </div>

        {/* Wordmark — "Demeter AI", the canonical name (matches every title and
            the schema). Demeter carries the weight; AI is a terracotta accent. */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              backgroundColor: "#C0553B",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 999, backgroundColor: "#EFB544", display: "flex" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <div style={{ fontSize: 32, fontWeight: 600, color: "#2A211C", letterSpacing: "-0.02em" }}>Demeter</div>
            <div style={{ fontSize: 26, fontWeight: 600, color: "#C0553B", letterSpacing: "0.02em" }}>AI</div>
          </div>
        </div>

        {/* The thesis: what you do here, then why to trust it. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 78,
              fontWeight: 700,
              color: "#2A211C",
              letterSpacing: "-0.043em",
              lineHeight: 1.02,
              maxWidth: 940,
            }}
          >
            See if you qualify for SNAP.
          </div>
          <div style={{ display: "flex", fontSize: 31, color: "#5E4F45", lineHeight: 1.4, maxWidth: 860 }}>
            Start a conversation and get answers grounded in the actual rules — every claim cites its
            source, so you can check it yourself. Free, no account.
          </div>
        </div>

        {/* Reach: the accent rule, then the four languages. */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 120, height: 5, borderRadius: 999, backgroundColor: "#C0553B", display: "flex" }} />
          <div style={{ display: "flex", fontSize: 24, color: "#8A7666", letterSpacing: "0.05em" }}>
            English · Español · Vietnamese · Chinese
          </div>
        </div>
      </div>
    ),
    size,
  );
}
