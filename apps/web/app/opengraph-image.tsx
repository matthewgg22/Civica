// Link preview card — the cheapest credibility surface there is (a shared link
// in a CBO's Slack, a funder's inbox, a text to someone who needs SNAP). It
// should say, at a glance, what you DO here and why to trust it.
//
// BRAND-ACCURATE per apps/web/DEMETER-DESIGN.md — an earlier cut drifted into
// generic parchment-and-system-fonts, which is the retired palette (§3: the
// ground is TRUE WHITE) with the wrong mark. This uses the real assets:
//   - the real wheat mark (public/demeter-wheat-mark.png), the file the nav and
//     favicon use, embedded so the card can't drift from them (see DemeterMark);
//   - the real faces (§4): Newsreader SPEAKS (wordmark, headline, body), Be
//     Vietnam Pro LABELS (the language line), loaded as TTF from the same
//     public/fonts/demeter dir the PDF generators read — Satori can't use woff2;
//   - the real tokens (§3): white paper, ink, body, muted, terracotta for the
//     accent, wheat for one 2px rule.

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

// DEMETER-DESIGN.md §3 — the real tokens.
const PAPER = "#FFFFFF";
const INK = "#232220";
const BODY = "#4B4A46";
const MUTED = "#6C6A64";
const TERRA = "#C0553B"; // the accent — the wordmark "AI" and the word "SNAP"
const WHEAT = "#E8C547"; // one 2px rule, and nothing else

const HEADWORDS: Array<[string, string]> = [
  ["See", INK],
  ["if", INK],
  ["you", INK],
  ["qualify", INK],
  ["for", INK],
  ["SNAP.", TERRA],
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "stretch",
          backgroundColor: PAPER,
          padding: "74px 82px",
          fontFamily: "Be Vietnam Pro",
        }}
      >
        {/* The message. */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingRight: 40,
          }}
        >
          {/* Wordmark: real mark + "Demeter" (ink) + "AI" (terracotta). */}
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <img src={MARK} width={82} height={82} alt="" style={{ borderRadius: 999 }} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 11, fontFamily: "Newsreader", fontWeight: 600 }}>
              <div style={{ fontSize: 46, color: INK, letterSpacing: "-0.01em" }}>Demeter</div>
              <div style={{ fontSize: 46, color: TERRA }}>AI</div>
            </div>
          </div>

          {/* Headline (serif speaks; the word it is about carries the accent) +
              the descriptor. */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                columnGap: 19,
                fontFamily: "Newsreader",
                fontWeight: 600,
                fontSize: 72,
                letterSpacing: "-0.025em",
                lineHeight: 1.05,
              }}
            >
              {HEADWORDS.map(([word, color], i) => (
                <div key={i} style={{ display: "flex", color }}>
                  {word}
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: "Newsreader",
                fontWeight: 400,
                fontSize: 30,
                color: BODY,
                lineHeight: 1.46,
                maxWidth: 560,
              }}
            >
              Start a conversation about food benefits and get answers grounded in the actual rules.
              Every claim cites its source, so you can check it yourself. Free, no account.
            </div>
          </div>

          {/* A 2px wheat rule (the one on-brand use of wheat here), then the
              four languages in the sans that labels. */}
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 64, height: 3, borderRadius: 999, backgroundColor: WHEAT, display: "flex" }} />
            <div style={{ display: "flex", fontFamily: "Be Vietnam Pro", fontWeight: 500, fontSize: 23, color: MUTED, letterSpacing: "0.01em" }}>
              English · Español · Vietnamese · Chinese
            </div>
          </div>
        </div>

        {/* The mark, large, anchoring the right so the composition is not
            left-heavy. Crisp — the source is 538px. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <img src={MARK} width={356} height={356} alt="" style={{ borderRadius: 999 }} />
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
