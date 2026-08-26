// /screen — 2026-08-09: simplified per the sharpened pivot ("Demeter AI is
// the sole initial launch — a simplified B2C chatbot"; the org/case-file/
// PDF-export screening flow reads as caseworker tooling, not a B2C chatbot,
// so it's no longer the front door). New/anonymous visitors go straight to
// the plain Q&A chat at /screen/ask — same as root's own redirect
// (next.config.ts). The org sign-in → session shortcut is UNCHANGED for
// people who already have an org account: it's an existing convenience for
// a real (if now-secondary) user, not new surface area, and nothing about
// pausing the screening tool's promotion requires breaking it. The landing
// pitch UI (sign in / continue as guest / "Screen a household") is left in
// place as unlinked code — parked, not deleted, matching how the rest of
// the pivot treats out-of-scope surfaces — reachable directly if this needs
// to come back, just no longer where traffic default-lands.
//
// Deliberately calls resolveOrgIdentity(), NOT resolveScreeningIdentity() —
// the latter mints a brand-new guest cookie (and starts that guest's
// lifetime-quota clock) as a side effect of resolving an identity at all.
// Just landing on this page shouldn't do that; only actually starting a
// screening should.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveOrgIdentity } from "../../lib/screening-auth";

export const metadata: Metadata = {
  title: "Demeter AI. Verified SNAP answers",
  description: "Free, verified answers to SNAP questions. For any state.",
  openGraph: {
    title: "Demeter AI. Verified SNAP answers",
    description: "Free, verified answers to SNAP questions. For any state.",
    type: "website",
  },
};

export default async function ScreenLandingPage() {
  const org = await resolveOrgIdentity();
  redirect(org ? "/screen/session" : "/screen/ask");
}
