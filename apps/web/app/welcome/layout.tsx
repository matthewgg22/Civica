import type { Metadata } from "next";

// Parked Civica applicant portal — kept out of search. See apps/web/app/robots.ts.
// The page is a client component and cannot export metadata itself, so this
// pass-through server layout carries the noindex. It adds no DOM.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
