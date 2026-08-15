// /supporters — the public supporter wall (CEO D3.6; MODERATED per eng F1:
// only approved rows render; text-only names v1). ISR every 5 minutes — new
// approvals appear without a deploy; a Supabase outage renders the page with
// the sign-on form and no wall rather than erroring.

import type { Metadata } from "next";
import Link from "next/link";
import { supabaseAdmin } from "../../lib/supabase-server";
import { SupporterSignOn } from "../../components/SupporterSignOn";
import { DemeterFooter } from "../../components/DemeterFooter";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Demeter Supporters",
  description:
    "Community organizations endorsing free, accurate SNAP guidance. Join them — sign on as a Demeter Supporter.",
};

interface SupporterRow {
  org_name: string;
  website: string | null;
  founding: boolean;
}

async function approvedSupporters(): Promise<SupporterRow[]> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .schema("snap_enrollment")
      .from("demeter_supporters")
      .select("org_name, website, founding")
      .eq("status", "approved")
      .order("founding", { ascending: false })
      .order("approved_at", { ascending: true });
    if (error) throw error;
    return (data as SupporterRow[]) ?? [];
  } catch {
    return [];
  }
}

export default async function SupportersPage() {
  const supporters = await approvedSupporters();
  return (
    <>
      <main className="spage">
      <header className="spage__head">
        <h1 className="spage__title">Demeter Supporters</h1>
        <p className="spage__definition">
          A Demeter Supporter is a community organization that endorses free, accurate
          SNAP guidance and shares Demeter with the people it serves.
        </p>
        <p className="spage__sub">
          Supporting is free. Founding organizations additionally back the work with a
          $20/month commitment — which may qualify as an allowable outreach cost under
          your state&apos;s SNAP outreach plan (50% federal share today; 25% from FY2027)
          — and get first access to the partner dashboard when it ships.
        </p>
      </header>

      {supporters.length > 0 ? (
        <section className="spage__wall" aria-label="Supporting organizations">
          <p className="spage__count">
            {supporters.length} organization{supporters.length === 1 ? "" : "s"} — and
            growing.
          </p>
          <ul className="spage__list">
            {supporters.map((s) => (
              <li key={s.org_name} className={`spage__org ${s.founding ? "is-founding" : ""}`}>
                {s.website ? (
                  <a href={s.website} rel="noopener noreferrer" target="_blank">
                    {s.org_name}
                  </a>
                ) : (
                  s.org_name
                )}
                {s.founding && <span className="spage__founding">Founding</span>}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="spage__wall">
          <p className="spage__count">
            The founding cohort is signing on now — your organization can be among the
            first.
          </p>
        </section>
      )}

      <SupporterSignOn />

      <footer className="spage__foot">
        <p>
          See <Link href="/verify">how Demeter verifies its answers</Link> or{" "}
          <Link href="/screen/ask">try the chat</Link>. Questions? Email{" "}
          <a href="mailto:supporters@civica.app">supporters@civica.app</a>.
        </p>
      </footer>
    </main>
      <DemeterFooter />
    </>
  );
}
