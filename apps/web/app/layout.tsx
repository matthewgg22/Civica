import { siteUrl } from "../lib/site-url";
import type { Metadata } from "next";
import { Hanken_Grotesk, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--civica-font-loaded",
});

// Demeter's own type family (design spec: Space Grotesk 400/500/600/700,
// JetBrains Mono 400/500) — separate variables from --civica-font-loaded,
// same pattern as the --demeter-* color tokens staying separate from
// --civica-*. Scoped to .screening/.screen-landing/.screen-auth in
// globals.css; the older pine-branded pages are untouched.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--demeter-font-display",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--demeter-font-mono",
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
    <html lang="en" className={`${hanken.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
