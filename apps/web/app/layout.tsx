import { siteUrl } from "../lib/site-url";
import type { Metadata } from "next";
import { Hanken_Grotesk, Newsreader, Be_Vietnam_Pro, Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--demeter-font-display",
});
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--demeter-font-sans",
});
// CJK fallbacks — "Noto sits behind each for Simplified Chinese." Own
// variables (not bundled into the fallback stack as bare family-name
// strings) so next/font actually loads and subsets them.
const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--demeter-font-serif-cjk",
});
const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--demeter-font-sans-cjk",
});

// metadataBase makes every relative OG/canonical URL absolute — without it
// Next emits relative og:image paths that crawlers and Slack can't resolve.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "Civica — Apply for SNAP food benefits",
  description:
    "SNAP — also called CalFresh, EBT, or food stamps — is monthly money for groceries. Civica reads your state's rules and walks you through the application in about 10 minutes.",
  openGraph: {
    title: "Civica — Apply for SNAP food benefits",
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
    <html lang="en" className={`${hanken.variable} ${newsreader.variable} ${beVietnamPro.variable} ${notoSerifSC.variable} ${notoSansSC.variable}`}>
      <body>{children}</body>
    </html>
  );
}
