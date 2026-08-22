// /privacy — the Demeter Privacy Policy.
//
// REPLACES A PLACEHOLDER THAT WAS ALSO WRONG. The previous page said the policy
// was "being finalized" and that information is "only shared with the agency
// processing your application" — but no agency is involved anywhere in the
// Demeter chat path, so the one substantive sentence on the page described a
// data flow that does not exist here.
//
// Content lives in lib/legal/privacy.ts. Static: it is a document, not a view.

import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { PRIVACY_POLICY } from "../../lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy Policy — Demeter",
  description:
    "What Demeter collects when you ask a question, and what it does not. No advertising, no data sales, no reporting to any agency.",
};

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY_POLICY} />;
}
