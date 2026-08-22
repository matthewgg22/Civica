// /safety — Safety and How Demeter Answers.
//
// The document with no equivalent in most companies' legal packages, and the
// one most worth having: it describes how an answer is built, when to distrust
// it, and where to reach a person. Content lives in lib/legal/safety.ts.

import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";
import { SAFETY_NOTICE } from "../../lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Safety and How Demeter Answers — Demeter",
  description:
    "Where Demeter's answers come from, how its citations are checked, when to be careful, and where to get help from a person.",
};

export default function SafetyPage() {
  return <LegalPage doc={SAFETY_NOTICE} />;
}
