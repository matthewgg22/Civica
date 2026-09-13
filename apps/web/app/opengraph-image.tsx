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

// THESE READS MUST STAY LAZY. They were module-level consts, and that took the
// whole site down (2026-09-12).
//
// `app/opengraph-image.tsx` is a ROOT FILE CONVENTION, so Next imports this
// module while resolving metadata for every route that inherits the root
// layout — not just when it renders the card. Module-level readFileSync
// therefore ran inside every other route's lambda, and next.config.ts traces
// these files into the `/opengraph-image` lambda ONLY. Everywhere else the
// files are absent, the import threw ENOENT, and metadata resolution failed.
//
// Because metadata is baked in at build time for static routes and resolved
// per request for dynamic ones, the damage landed exactly on /chat,
// /screen/ask, /screen and /sign-in while /questions, /states, /safety,
// /sitemap.xml and /api/health all kept serving 200. Locally it never
// reproduced: `next start` has the whole repo on disk.
//
// Reading inside the handler means importing this module touches no
// filesystem. Only the `/opengraph-image` route — the one the tracing include
// covers — ever opens these files. Memoized so a warm lambda reads once.
let assets: {
  newsreader600: Buffer;
  newsreader400: Buffer;
  beVietnam500: Buffer;
  mark: string;
} | null = null;

function loadAssets() {
  if (!assets) {
    assets = {
      newsreader600: readFileSync(join(FONT_DIR, "Newsreader-SemiBold.ttf")),
      newsreader400: readFileSync(join(FONT_DIR, "Newsreader-Regular.ttf")),
      beVietnam500: readFileSync(join(FONT_DIR, "BeVietnamPro-Medium.ttf")),
      mark: `data:image/png;base64,${readFileSync(
        join(process.cwd(), "public", "demeter-wheat-mark.png"),
      ).toString("base64")}`,
    };
  }
  return assets;
}

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
  ["SNAP", TERRA],
];

// The brand row and the language row sit inset from the flush-left headline —
// the headline is the hero, these bracket it.
const INSET = 30;

export default function OpengraphImage() {
  const { newsreader600, newsreader400, beVietnam500, mark } = loadAssets();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 58,
          backgroundColor: PAPER,
          padding: "78px 80px",
          fontFamily: "Be Vietnam Pro",
        }}
      >
        {/* Wordmark: real mark + "Demeter" (ink) + "AI" (terracotta) — inset. */}
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginLeft: INSET }}>
          <img src={mark} width={109} height={109} alt="" style={{ borderRadius: 999 }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, fontFamily: "Newsreader", fontWeight: 600 }}>
            <div style={{ fontSize: 61, color: INK, letterSpacing: "-0.01em" }}>Demeter</div>
            <div style={{ fontSize: 61, color: TERRA }}>AI</div>
          </div>
        </div>

        {/* Headline (serif speaks; the word it is about carries the accent) on
            one line, then the descriptor across the width. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              columnGap: 20,
              fontFamily: "Newsreader",
              fontWeight: 600,
              fontSize: 80,
              letterSpacing: "-0.025em",
              lineHeight: 1.04,
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
              fontSize: 37,
              color: BODY,
              lineHeight: 1.44,
              maxWidth: 1010,
            }}
          >
            Start a free conversation about food benefits and get answers grounded in the actual
            rules, cited so you can apply with confidence.
          </div>
        </div>

        {/* A wheat rule (the one on-brand use of wheat here), then the four
            languages in the sans that labels — inset to match the wordmark. */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginLeft: INSET }}>
          <div style={{ width: 70, height: 5, borderRadius: 999, backgroundColor: WHEAT, display: "flex" }} />
          <div style={{ display: "flex", fontFamily: "Be Vietnam Pro", fontWeight: 500, fontSize: 24, color: MUTED, letterSpacing: "0.01em" }}>
            English · Español · Vietnamese · Chinese
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Newsreader", data: newsreader600, weight: 600, style: "normal" },
        { name: "Newsreader", data: newsreader400, weight: 400, style: "normal" },
        { name: "Be Vietnam Pro", data: beVietnam500, weight: 500, style: "normal" },
      ],
    },
  );
}
