// /screen — the screening tool's landing page (mockup frame 01).
//
// A returning, already-signed-in org member skips straight to their
// session — no reason to make them click through the pitch every visit.
// A first-time or signed-out visitor sees the landing and picks a path:
// sign in (frame 02) or continue as a guest (straight to /screen/session,
// same as the mockup's own "Continue as a guest" link).
//
// Deliberately calls resolveOrgIdentity(), NOT resolveScreeningIdentity() —
// the latter mints a brand-new guest cookie (and starts that guest's
// lifetime-quota clock) as a side effect of resolving an identity at all.
// Just landing on this page shouldn't do that; only actually starting a
// screening should.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveOrgIdentity } from "../../lib/screening-auth";
import { DemeterMark } from "../../components/DemeterMark";

export const metadata: Metadata = {
  title: "Demeter Screening",
  description: "SNAP eligibility screening for caseworkers — cited, exportable, state-aware.",
};

export default async function ScreenLandingPage() {
  const org = await resolveOrgIdentity();
  if (org) redirect("/screen/session");

  return (
    <div className="screen-landing">
      <header className="screen-landing__head">
        <div className="screen-landing__brand">
          <DemeterMark size={32} />
          <span className="screen-landing__brand-name">Demeter</span>
        </div>
      </header>

      <main className="screen-landing__main">
        <div className="screen-landing__card">
          <h1 className="screen-landing__title">Screen a household in minutes</h1>
          <p className="screen-landing__subtitle">
            Ask about the household, and Demeter builds the case file as you go — a live benefit
            calculation, a cited screening result, and a checklist of what&apos;s still needed.
            Estimate only; the county agency makes the final determination.
          </p>

          <div className="screen-landing__actions">
            <a className="screen-landing__cta screen-landing__cta--primary" href="/screen/sign-in">
              Sign in
            </a>
            <a className="screen-landing__cta screen-landing__cta--secondary" href="/screen/session">
              Continue as a guest →
            </a>
          </div>
          <p className="screen-landing__guest-note">
            Guest screenings aren&apos;t saved to an organization and are capped at 5. Sign in to
            keep a case file, export it, and pick up where you left off.
          </p>
        </div>
      </main>
    </div>
  );
}
