// Link preview card — the cheapest credibility surface there is (a shared link
// in a CBO's Slack, a funder's inbox, a text to someone who needs SNAP).
//
// BRAND-ACCURATE per apps/web/DEMETER-DESIGN.md — an earlier version drifted
// into generic parchment-and-terracotta with an invented disc, which is exactly
// the retired palette (§3: the ground is TRUE WHITE, the parchment family is
// gone) and the wrong mark. This uses the real assets:
//   - the real wheat mark (public/demeter-wheat-mark.png), the same file the nav
//     and favicon use, so the OG card can't drift from them (see DemeterMark);
//   - the real faces (§4): Newsreader SPEAKS (wordmark, headline, body),
//     Be Vietnam Pro LABELS (the language line), loaded as TTF from the same
//     public/fonts/demeter dir the PDF generators read — no network fetch, and
//     Satori cannot use the app's woff2;
//   - the ten real tokens (§3): white paper, ink, body, muted, terracotta for
//     the mark accent, terracotta-deep for the wordmark "AI", wheat for a 2px
//     rule and nothing else.

import { ImageResponse } from "next/og";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt = "Demeter AI. See if you qualify for SNAP food benefits, with verified answers for any state";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "public", "fonts", "demeter");
const NEWSREADER_600 = readFileSync(join(FONT_DIR, "Newsreader-SemiBold.ttf"));
const NEWSREADER_400 = readFileSync(join(FONT_DIR, "Newsreader-Regular.ttf"));
const BEVIETNAM_500 = readFileSync(join(FONT_DIR, "BeVietnamPro-Medium.ttf"));
const MARK = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "demeter-wheat-mark.png"),
).toString("base64")}`;

// DEMETER-DESIGN.md §3 — the real tokens, not eyeballed hexes.
const PAPER = "#FFFFFF";
const INK = "#232220";
const BODY = "#4B4A46";
const MUTED = "#6C6A64";
const TERRA = "#C0553B"; // the accent — emphasis on "SNAP"
const TERRA_DEEP = "#8E3A26"; // wordmark "AI"
const WHEAT = "#E8C547"; // a 2px rule, and nothing else here

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
          backgroundColor: PAPER,
          padding: "78px 84px",
          fontFamily: "Be Vietnam Pro",
        }}
      >
        {/* Wordmark: the real mark + "Demeter" (Newsreader, ink) + "AI"
            (terracotta-deep) — the treatment the design tokens name. */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <img src={MARK} width={62} height={62} alt="" style={{ borderRadius: 999 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 9, fontFamily: "Newsreader", fontWeight: 600 }}>
            <div style={{ fontSize: 37, color: INK, letterSpacing: "-0.01em" }}>Demeter</div>
            <div style={{ fontSize: 37, color: TERRA_DEEP }}>AI</div>
          </div>
        </div>

        {/* The thesis, in the serif that speaks. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontFamily: "Newsreader",
              fontWeight: 600,
              fontSize: 82,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              maxWidth: 940,
            }}
          >
            <div style={{ display: "flex", color: INK }}>See if you qualify for</div>
            <div style={{ display: "flex", color: TERRA }}>SNAP.</div>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "Newsreader",
              fontWeight: 400,
              fontSize: 34,
              color: BODY,
              lineHeight: 1.48,
              maxWidth: 830,
            }}
          >
            Start a conversation about food benefits and get answers grounded in the actual rules.
            Every claim cites its source, so you can check it yourself. Free, no account.
          </div>
        </div>

        {/* Reach — a 2px wheat rule (the one on-brand use of wheat here), then
            the four languages in the sans that labels. */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 68, height: 3, borderRadius: 999, backgroundColor: WHEAT, display: "flex" }} />
          <div style={{ display: "flex", fontFamily: "Be Vietnam Pro", fontWeight: 500, fontSize: 23, color: MUTED, letterSpacing: "0.01em" }}>
            English · Español · Vietnamese · Chinese
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: NEWSREADER_600, weight: 600, style: "normal" },
        { name: "Newsreader", data: NEWSREADER_400, weight: 400, style: "normal" },
        { name: "Be Vietnam Pro", data: BEVIETNAM_500, weight: 500, style: "normal" },
      ],
    },
  );
}
