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
    <html lang="en" className={hanken.variable}>
      <body>{children}</body>
    </html>
  );
}
