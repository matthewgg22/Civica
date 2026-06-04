import { ApplyHeader } from "../../components/ApplyHeader";
import { BuddyBanner } from "../../components/BuddyBanner";
import { MaeHelpButton } from "../../components/MaeHelpButton";

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
