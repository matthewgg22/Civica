import { siteUrl } from "../lib/site-url";
import type { Metadata } from "next";
import localFont from "next/font/local";
// CJK, self-hosted from npm rather than fetched from Google at build time.
// These two ship ~165 pre-subsetted woff2 files with unicode-range, so a
// browser still downloads only the glyph ranges a page actually uses — which
// is why they are NOT next/font/local like the Latin faces below. localFont
// cannot express unicode-range, so pointing it at a single CJK file would make
// every /zh visitor download ~5MB to read one page. They are also why the
// files are not committed: 165 files / 10MB of binary does not belong in git.
import "@fontsource/noto-serif-sc";
import "@fontsource/noto-sans-sc";
import "./globals.css";

// SELF-HOSTED (#697). These were next/font/google, which DOWNLOADS THE FILES
// DURING THE BUILD — so an unreachable fonts.gstatic.com did not degrade
// typography, it failed the deploy. It took out CI on PR #696 for a change
// that had nothing to do with fonts.
//
// Provenance, so these can be regenerated deliberately rather than guessed:
//   pnpm add -D @fontsource-variable/newsreader@5.3.0 \
//              @fontsource-variable/hanken-grotesk@5.3.0 \
//              @fontsource/be-vietnam-pro@5.3.0
//   cp node_modules/<pkg>/files/<face>-latin-*.woff2 app/fonts/
// The three packages are then removed again — once the files are committed the
// build needs nothing but the repo.
//
// Latin only, which is the whole Latin payload: 9 files, 288KB. The CJK half
// is what made the Google fetch 230 files and 11MB.
const hanken = localFont({
  src: "./fonts/hanken-grotesk-latin-wght-normal.woff2",
  // Variable font: one file covers the whole 400–600 range the design uses.
  weight: "100 900",
  display: "swap",
  variable: "--civica-font-loaded",
});

// Demeter's own type family (Type Directions spec, Turn 3 — "sibling not
// twin"): Newsreader for anything that speaks (answers, headings, page
// titles, the whole PDF), Be Vietnam Pro for anything that labels or
// operates (buttons, inputs, table heads, toolbars). Separate variables from
// --civica-font-loaded, same pattern as the --demeter-* color tokens staying
// separate from --civica-*. Scoped to .screening/.screen-landing/.screen-auth
// in globals.css; the older pine-branded pages are untouched. No mono face —
// the prior JetBrains Mono use sites were both labels and moved to sans.
const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader-latin-wght-normal.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/newsreader-latin-wght-italic.woff2", style: "italic", weight: "100 900" },
  ],
  display: "swap",
  variable: "--demeter-font-display",
});
// Be Vietnam Pro has no variable build, so each weight/style is its own file —
// the same six next/font/google was fetching.
const beVietnamPro = localFont({
  src: [
    { path: "./fonts/be-vietnam-pro-latin-400-normal.woff2", style: "normal", weight: "400" },
    { path: "./fonts/be-vietnam-pro-latin-400-italic.woff2", style: "italic", weight: "400" },
    { path: "./fonts/be-vietnam-pro-latin-500-normal.woff2", style: "normal", weight: "500" },
    { path: "./fonts/be-vietnam-pro-latin-500-italic.woff2", style: "italic", weight: "500" },
    { path: "./fonts/be-vietnam-pro-latin-600-normal.woff2", style: "normal", weight: "600" },
    { path: "./fonts/be-vietnam-pro-latin-600-italic.woff2", style: "italic", weight: "600" },
  ],
  display: "swap",
  variable: "--demeter-font-sans",
});

// metadataBase makes every relative OG/canonical URL absolute — without it
// Next emits relative og:image paths that crawlers and Slack can't resolve.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Civica: Apply for SNAP food benefits",
  description:
    "SNAP. Also called CalFresh, EBT, or food stamps. Is monthly money for groceries. Civica reads your state's rules and walks you through the application in about 10 minutes.",
  openGraph: {
    title: "Civica: Apply for SNAP food benefits",
    description:
      "See if you qualify for SNAP food benefits. Civica figures out your state's rules and guides you through the application step by step.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // --demeter-font-serif-cjk / --demeter-font-sans-cjk are no longer
    // next/font variables (those two faces come from @fontsource now, which
    // registers the plain family names). They are declared in globals.css
    // instead, so every `var(--demeter-font-*-cjk)` use site is unchanged.
    <html lang="en" className={`${hanken.variable} ${newsreader.variable} ${beVietnamPro.variable}`}>
      <body>{children}</body>
    </html>
  );
}
