import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import UATFeedbackButton from "../components/UATFeedbackButton";
import SampleDataBanner from "../components/SampleDataBanner";
import CommandPalette from "../components/CommandPalette";
import MaeChat from "../components/MaeChat";

export const metadata: Metadata = {
  title: "Civica Navigator Dashboard",
  description: "SNAP enrollment management for navigators",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <SampleDataBanner />
        <div className="flex-1">{children}</div>
        <footer className="border-t border-hairline bg-surface px-8 py-3 flex items-center justify-end">
          <UATFeedbackButton />
        </footer>
        <Toaster
          theme="light"
          richColors
          position="top-right"
          toastOptions={{
            classNames: {
              success: "!bg-teal/10 !border-teal/30 !text-teal",
              error: "!bg-brick/10 !border-brick/30 !text-brick",
            },
          }}
        />
        <CommandPalette />
        <MaeChat />
      </body>
    </html>
  );
}
