// /cbo/setup — officer-facing walkthrough for installing + using the BenefitsCal
// autofill helper (the Civica Submitter extension). Gated under /cbo, so visible
// to staff (and cbo_assister once that role is enabled). Server component; the
// install path branches on whether the unlisted Chrome Web Store URL is set.
import Link from "next/link";
import { submitterExtensionUrl } from "../../../lib/cbo/extension";

export const dynamic = "force-dynamic";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-pine text-white text-[12px] font-bold"
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink">{title}</p>
        <div className="text-[13px] text-graphite mt-0.5 leading-relaxed space-y-1">{children}</div>
      </div>
    </li>
  );
}

export default function CboSetupPage() {
  const installUrl = submitterExtensionUrl();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline bg-surface">
        <div className="max-w-2xl mx-auto px-6 py-3">
          <Link href="/cbo" className="text-[13px] font-medium text-pine hover:underline">
            ← Back to cases
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <header>
          <p className="eyebrow">Civica · CBO workspace</p>
          <h1 className="text-[26px] font-semibold text-ink leading-tight">
            Set up the BenefitsCal autofill helper
          </h1>
          <p className="section-sub mt-1">
            A Civica browser extension that fills the BenefitsCal application with a
            case&rsquo;s approved answers, highlighted in yellow. You review and click
            Next / Accept yourself — Civica never submits for you.
          </p>
        </header>

        <ol className="bg-surface border border-hairline rounded-[4px] p-6 space-y-5">
          <Step n={1} title="Install the extension">
            {installUrl ? (
              <>
                <p>One click — it installs and keeps itself up to date.</p>
                <a
                  href={installUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 px-4 py-2 text-[13px] font-semibold rounded-[3px] bg-pine text-white hover:bg-pine/90 transition-colors"
                >
                  Add to Chrome
                </a>
                <p className="mt-1">You&rsquo;ll see the Civica Submitter icon in your Chrome toolbar.</p>
              </>
            ) : (
              <>
                <p>
                  <span className="text-[11px] uppercase tracking-wider text-warning border border-warning/40 rounded-[2px] px-1.5 py-0.5">
                    Pilot build
                  </span>{" "}
                  The one-click store version is coming. For now, load the build your Civica
                  contact sent you:
                </p>
                <ol className="list-decimal ml-5 space-y-0.5">
                  <li>Unzip the build your Civica contact sent.</li>
                  <li>
                    Open <code className="font-mono text-ink">chrome://extensions</code> and turn on{" "}
                    <span className="text-ink">Developer mode</span> (top-right).
                  </li>
                  <li>
                    Click <span className="text-ink">Load unpacked</span> and select the unzipped{" "}
                    <code className="font-mono text-ink">dist</code> folder.
                  </li>
                </ol>
              </>
            )}
          </Step>

          <Step n={2} title="Connect it to your Civica account">
            <p>
              Click the Civica Submitter icon → <span className="text-ink">Connect with Civica</span>.
              Sign in once; the extension remembers it on this browser.
            </p>
          </Step>

          <Step n={3} title="Pick the case you're working on">
            <p>
              In the extension popup, choose the applicant. That tells the helper which approved
              answers to fill.
            </p>
          </Step>

          <Step n={4} title="Open BenefitsCal and review the yellow fields">
            <p>
              Log into BenefitsCal and open that applicant&rsquo;s CalFresh application. The helper
              fills each field it recognizes and highlights it <span className="text-ink">yellow</span>.
              Review them, fix anything flagged for manual review, then click the portal&rsquo;s own{" "}
              <span className="text-ink">Next / Continue / Submit</span>. The helper never advances or
              submits on its own.
            </p>
          </Step>
        </ol>

        <section className="bg-surface border border-hairline rounded-[4px] p-6">
          <h2 className="section-title">Troubleshooting</h2>
          <dl className="mt-2 space-y-2 text-[13px]">
            <div>
              <dt className="font-semibold text-ink">&ldquo;No packet selected&rdquo;</dt>
              <dd className="text-graphite">Open the popup and pick a case (step 3).</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">&ldquo;Could not load packet&rdquo;</dt>
              <dd className="text-graphite">
                Re-connect in the popup (step 2) and confirm you&rsquo;re online.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Nothing highlights on a page</dt>
              <dd className="text-graphite">
                That page may not be mapped yet, or it hadn&rsquo;t finished loading — use{" "}
                <span className="text-ink">Re-fill</span> in the helper&rsquo;s panel. Some fields are
                left for you on purpose (counted as &ldquo;needs review&rdquo;), never guessed.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">It does nothing on other sites</dt>
              <dd className="text-graphite">By design — it only runs on benefitscal.com.</dd>
            </div>
          </dl>
        </section>
      </main>
    </div>
  );
}
