// Findings ledger — index page (/findings).
//
// PUBLIC route. Read by:
//   • Civica team auditing the analytical claim history.
//   • Partner / counsel / county readers landing on a finding via a
//     shared link; index gives them a way to browse the broader corpus.
//
// Public access is enforced in middleware.ts via FULLY_PUBLIC_PREFIXES
// (see apps/dashboard/lib/roleRouting.ts). No AppHeader (public route),
// no Supabase round-trip — all data comes from docs/findings/*.md at
// build time via apps/dashboard/lib/findings.ts.
//
// Schema + rationale: docs/findings/README.md and finding
// 2026-05-28-evidence-ledger-architecture (the meta-finding that
// motivates this route).

import type { Metadata } from "next";
import Link from "next/link";
import { getFindingHook, getFindingsByMonth } from "../../lib/findings";

// Re-render hourly. Findings rarely change; the hourly window lets new
// findings appear in the index without a redeploy.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Findings · Civica",
  description:
    "Evidence-backed analytical claims tracking what Civica knows about SNAP enrollment, county exposure, error rates, and program design. Every claim cites a primary source.",
  openGraph: {
    title: "Civica findings — evidence-backed analytical ledger",
    description:
      "Cited claims tracking what Civica knows about SNAP enrollment, county exposure, and program design.",
    type: "website",
  },
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function formatMonth(yyyyMM: string): string {
  // yyyyMM = "2026-05" — append a day so Date parses without TZ weirdness.
  const d = new Date(`${yyyyMM}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return yyyyMM;
  return MONTH_FORMATTER.format(d);
}

export default function FindingsIndex() {
  const groups = getFindingsByMonth();
  const total = groups.reduce((n, g) => n + g.findings.length, 0);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      {/* ----------------------------------------------------------------- */}
      {/* Header                                                            */}
      {/* ----------------------------------------------------------------- */}
      <header className="mb-12">
        <p className="text-sm font-medium uppercase tracking-wider text-graphite">
          Civica
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">
          Findings
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-graphite">
          Evidence-backed analytical claims tracking what Civica knows about
          SNAP enrollment, county exposure, error rates, and program design.
          Every claim cites a primary source.
        </p>
        <p className="mt-3 text-sm text-graphite">
          {total} active finding{total === 1 ? "" : "s"}. Schema and rationale
          live in{" "}
          <a
            href="https://github.com/matthewgg22/Civica/blob/codex/rebuild-feb18/docs/findings/README.md"
            className="text-pine underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            docs/findings/README.md
          </a>
          .
        </p>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Featured analysis — the flagship pre-registered regression. Lives */}
      {/* at its own static route (/findings/regression), surfaced here so   */}
      {/* it is the first thing a partner sees.                              */}
      {/* ----------------------------------------------------------------- */}
      <Link
        href="/findings/regression"
        className="group mb-12 block rounded-lg border border-pine/25 bg-pine/[0.04] p-5 transition hover:border-pine/40 hover:bg-pine/[0.07]"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-pine">
          Flagship analysis
        </p>
        <h2 className="mt-1.5 text-xl font-semibold text-ink group-hover:text-pine">
          Does Civica cut the error rate?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          A pre-registered regression — five outcomes, each with a confidence
          interval, the plan locked before the data. Synthetic today; one
          command swaps in the FOIA CDSS data.
        </p>
        <span className="mt-2 inline-block text-sm font-medium text-pine">
          View the analysis →
        </span>
      </Link>

      {/* ----------------------------------------------------------------- */}
      {/* Live credibility one-pager — the truth point rendered as a page.  */}
      {/* ----------------------------------------------------------------- */}
      <Link
        href="/findings/error-rate"
        className="group mb-12 block rounded-lg border border-pine/25 bg-pine/[0.04] p-5 transition hover:border-pine/40 hover:bg-pine/[0.07]"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-pine">
          Live credibility one-pager
        </p>
        <h2 className="mt-1.5 text-xl font-semibold text-ink group-hover:text-pine">
          Why you can audit our error-rate claims
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-graphite">
          The method, the live truth-point reading, and the published reference
          layer in one place — with a guardrail that flags a non-signal instead
          of overclaiming.
        </p>
        <span className="mt-2 inline-block text-sm font-medium text-pine">
          View the page →
        </span>
      </Link>

      {/* ----------------------------------------------------------------- */}
      {/* Empty state — should never happen in practice, but guard for it.  */}
      {/* ----------------------------------------------------------------- */}
      {total === 0 && (
        <div className="rounded-lg border border-graphite/20 bg-surface-secondary p-8 text-center">
          <p className="text-graphite">
            No findings yet. Add one with{" "}
            <code className="rounded bg-ink/5 px-1 py-0.5 text-sm">
              /finding new &lt;slug&gt;
            </code>{" "}
            from a Civica session.
          </p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Grouped by month, newest first.                                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-12">
        {groups.map(({ month, findings }) => (
          <section key={month}>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-graphite">
              {formatMonth(month)}
            </h2>
            <ul className="space-y-6 border-l-2 border-graphite/15 pl-6">
              {findings.map((f) => (
                <li key={f.id} className="group">
                  <Link
                    href={`/findings/${f.id}`}
                    className="block transition hover:opacity-80"
                  >
                    <div className="flex items-baseline gap-3">
                      <time className="font-mono text-xs text-graphite">
                        {f.date}
                      </time>
                      <ConfidenceBadge confidence={f.confidence} />
                    </div>
                    <h3 className="mt-1 text-lg font-semibold text-ink group-hover:text-pine">
                      {humanizeId(f.id)}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-graphite">
                      {getFindingHook(f, 240)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.scope.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-xs text-graphite"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Footer — pointer to README for context.                           */}
      {/* ----------------------------------------------------------------- */}
      <footer className="mt-16 border-t border-graphite/15 pt-6 text-sm text-graphite">
        <p>
          Findings are append-only. Superseded findings stay readable but drop
          off this index — see the supersession chain on each detail page.
        </p>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanizeId(id: string): string {
  // 2026-05-28-test-prefix-empty → "Test prefix empty"
  // Drop the leading date, hyphen-split, title-case the first word.
  const withoutDate = id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const words = withoutDate.split("-");
  if (words.length === 0) return id;
  return [words[0][0]?.toUpperCase() + words[0].slice(1), ...words.slice(1)]
    .join(" ");
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  // Confidence semantics from docs/findings/README.md:
  //   high   — primary-source evidence, reproducible, recent
  //   medium — multiple supporting sources, some inference
  //   low    — exploratory; audit candidate
  const styles: Record<string, string> = {
    high: "bg-pine/10 text-pine",
    medium: "bg-graphite/10 text-graphite",
    low: "bg-warning/10 text-warning",
    unknown: "bg-ink/5 text-graphite",
  };
  const style = styles[confidence] ?? styles.unknown;
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${style}`}
    >
      {confidence}
    </span>
  );
}
