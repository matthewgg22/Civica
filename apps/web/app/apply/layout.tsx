import type { Metadata } from "next";
import { ApplyHeader } from "../../components/ApplyHeader";
import { BuddyBanner } from "../../components/BuddyBanner";
import { MaeHelpButton } from "../../components/MaeHelpButton";

// Parked Civica applicant portal — kept out of search (Demeter is the live
// product; this SNAP enrollment flow is not linked from it). robots.ts also
// disallows /apply; this meta is the backstop for any inbound-linked route.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="apply-shell">
      <ApplyHeader />
      <div className="apply-shell__content">
        <BuddyBanner />
        <div className="apply-shell__card">{children}</div>
      </div>
      <MaeHelpButton />
    </div>
  );
}
