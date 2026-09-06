import type { Metadata } from "next";

// Parked Civica applicant portal — kept out of search. See apps/web/app/robots.ts.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StatusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
