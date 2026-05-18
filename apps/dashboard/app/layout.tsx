import type { Metadata } from "next";
import "./globals.css";
import UATFeedbackButton from "../components/UATFeedbackButton";

export const metadata: Metadata = {
  title: "Civica Navigator Dashboard",
  description: "SNAP enrollment management for navigators",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-hairline bg-surface px-8 py-3 flex items-center justify-end">
          <UATFeedbackButton />
        </footer>
      </body>
    </html>
  );
}
