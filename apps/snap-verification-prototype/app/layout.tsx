import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SNAP Verification Prototype",
  description: "Three SNAP QC-grade verification flows",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
