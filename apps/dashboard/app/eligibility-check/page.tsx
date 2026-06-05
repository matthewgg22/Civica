// Navigator quick-check (staff). Enter an applicant's facts → verdict +
// estimated benefit + recommendations, computed live by the rules engine
// (snap-rules) and Component R (snap-recommendation) via /api/eligibility-check.
//
// This is the surface that makes the eligibility + recommendation engines live
// without waiting on the apply-wizard schema or the packet→Facts adapter (#504):
// the navigator supplies the facts directly.

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClientFromCookies } from "../../lib/supabase";
import EligibilityCheck from "../../components/eligibility/EligibilityCheck";

export const dynamic = "force-dynamic";

export default async function EligibilityCheckPage() {
  // Keep auth consistent with other staff surfaces (also primes the session).
  const cookieStore = await cookies();
  createServerClientFromCookies(cookieStore);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <nav className="mb-6 text-sm">
        <Link href="/dashboard" className="text-graphite underline-offset-2 hover:text-pine hover:underline">
          ← Dashboard
        </Link>
      </nav>

      <header className="mb-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite">Navigator tool</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Eligibility quick-check</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-graphite">
          Enter what you know about an applicant. The rules engine returns a likely verdict and an
          estimated monthly benefit; Component R returns the actions most likely to improve the
          outcome. Estimates are for counseling — the county sets the final amount.
        </p>
      </header>

      <EligibilityCheck state="CA" />
    </main>
  );
}
