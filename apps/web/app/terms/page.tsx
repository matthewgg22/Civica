// /terms — the Demeter Terms of Service.
//
// Content lives in lib/legal/terms.ts.

import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { TERMS_OF_SERVICE } from "../../lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Service: Demeter",
  description:
    "The agreement for using Demeter. Demeter is free, gives information rather than legal advice, and does not decide your SNAP case. Your state agency does.",
};

export default function TermsPage() {
  return <LegalPage doc={TERMS_OF_SERVICE} />;
}
