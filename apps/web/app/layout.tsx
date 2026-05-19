import type { Metadata } from "next";
import { Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--civica-font-loaded",
});

export const metadata: Metadata = {
  title: "Civica — CalFresh for California students",
  description:
    "If you're a half-time student at a California Community College, CSU, or UC, you likely qualify for CalFresh now. The rules changed.",
  openGraph: {
    title: "Civica — CalFresh for California students",
    description:
      "The rules changed. Many students who were told no before are eligible today.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={hanken.variable}>
      <body>{children}</body>
    </html>
  );
}
