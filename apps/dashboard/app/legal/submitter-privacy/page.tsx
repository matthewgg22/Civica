// Public privacy policy for the Civica Submitter Chrome extension. Required as a
// public URL for the Chrome Web Store listing. Served ungated (see
// FULLY_PUBLIC_PREFIXES "/legal/" in lib/roleRouting.ts).
//
// ⚠️ DRAFT — pending Civica counsel review before the extension is published.
// Do not submit to the Chrome Web Store with this URL until counsel signs off.
export const dynamic = "force-dynamic";

const UPDATED = "2026-06-08";

export default function SubmitterPrivacyPage() {
  return (
    <main className="min-h-screen bg-paper">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <p className="text-[11px] uppercase tracking-wider text-warning border border-warning/40 rounded-[2px] px-2 py-1 inline-block">
          Draft — pending counsel review
        </p>
        <h1 className="text-[26px] font-semibold text-ink leading-tight mt-3">
          Civica Submitter — Privacy Policy
        </h1>
        <p className="text-[12px] text-graphite mt-1">Last updated: {UPDATED}</p>

        <div className="mt-6 space-y-5 text-[14px] text-ink leading-relaxed">
          <section>
            <h2 className="section-title">What this extension is</h2>
            <p className="mt-1 text-graphite">
              Civica Submitter is a tool for community-based-organization (CBO) assisters. When an
              assister opens the California BenefitsCal CalFresh application in their own browser, the
              extension pre-fills the form fields from a Civica case the assister selected, and
              highlights what it filled. The assister reviews every field and clicks the portal&rsquo;s
              own Next / Submit. The extension never submits an application.
            </p>
          </section>

          <section>
            <h2 className="section-title">What it accesses, and why</h2>
            <ul className="mt-1 space-y-1 text-graphite list-disc ml-5">
              <li>
                <span className="text-ink">The selected Civica case&rsquo;s application data</span> — fetched
                from the Civica gateway over HTTPS using the assister&rsquo;s authenticated session, solely to
                pre-fill the matching BenefitsCal fields.
              </li>
              <li>
                <span className="text-ink">benefitscal.com pages only</span> — the extension runs only on
                benefitscal.com (enforced by its manifest). It does not read or run on any other site.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="section-title">What it stores</h2>
            <p className="mt-1 text-graphite">
              In your browser (chrome.storage.local) only: the Civica gateway URL, your Civica access
              token, and the ID of the case you selected. This stays on your device. The extension uses
              no analytics or tracking, and sends data to no third parties.
            </p>
          </section>

          <section>
            <h2 className="section-title">What it never does</h2>
            <ul className="mt-1 space-y-1 text-graphite list-disc ml-5">
              <li>It never stores or transmits your BenefitsCal username or password.</li>
              <li>It never submits or advances an application — that is always the assister&rsquo;s action.</li>
              <li>It never sells or shares applicant data.</li>
            </ul>
          </section>

          <section>
            <h2 className="section-title">Data retention &amp; deletion</h2>
            <p className="mt-1 text-graphite">
              Removing the extension clears its local storage. Application data lives in Civica, governed
              by Civica&rsquo;s privacy practices; the extension keeps no separate copy beyond the active
              session.
            </p>
          </section>

          <section>
            <h2 className="section-title">Contact</h2>
            <p className="mt-1 text-graphite">
              Questions about this policy: contact Civica. <span className="text-ink">(Finalize contact
              email + entity before publishing — counsel.)</span>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
