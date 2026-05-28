// Findings ledger — finding detail (/findings/[id]).
//
// PUBLIC route. Read by:
//   • Partner / county / counsel reader landing on a specific finding
//     via shared link or OG card. URL is stable + cite-able.
//   • Civica team auditing the evidence trail for a past analytical claim.
//
// All data comes from docs/findings/[id].md via lib/findings.ts. Pages are
// pre-rendered via generateStaticParams so every finding maps to a static
// HTML file. No auth, no Supabase round-trip.
//
// Markdown body is rendered with react-markdown + remark-gfm. Two custom
// transforms are applied:
//   (a) [[other-id]] wikilinks → /findings/other-id Next.js links
//   (b) [text](../findings/foo.md) repo-relative links → /findings/foo
// Both keep the canonical markdown source clean (no Next.js coupling)
// while the rendered dashboard version uses real routes.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getAllFindings,
  getFinding,
  getFindingHook,
  getIncomingLinks,
  listFindingIds,
  type Evidence,
  type Finding,
} from "../../../lib/findings";

export const revalidate = 3600;

export async function generateStaticParams() {
  return listFindingIds().map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const finding = getFinding(id);
  if (!finding) return { title: "Finding not found · Civica" };

  const title = `${humanizeId(finding.id)} · Civica findings`;
  const description = getFindingHook(finding, 220);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: finding.date,
    },
  };
}

// ---------------------------------------------------------------------------
// Markdown link transforms — applied to the body before react-markdown.
// ---------------------------------------------------------------------------

const WIKILINK_RE = /\[\[([a-z0-9-]+)\]\]/g;
const REPO_FINDING_LINK_RE = /\]\((?:\.\.\/)+findings\/([a-z0-9-]+)\.md\)/g;
const REPO_DOC_LINK_RE = /\]\((?:\.\.\/)+(?:docs|apps|packages|scripts|tools)\/[^)]+\)/g;

function rewriteMarkdownLinks(body: string): string {
  return body
    .replace(WIKILINK_RE, (_m, id) => `[${humanizeId(id)}](/findings/${id})`)
    .replace(REPO_FINDING_LINK_RE, (_m, id) => `](/findings/${id})`)
    // Repo-relative non-finding doc links (e.g. README.md) → leave them
    // but point at the GitHub mirror so partners can actually open them.
    .replace(REPO_DOC_LINK_RE, (match) => {
      const pathStart = match.indexOf("(") + 1;
      const relPath = match.slice(pathStart, -1).replace(/^(?:\.\.\/)+/, "");
      return `](https://github.com/matthewgg22/Civica/blob/codex/rebuild-feb18/${relPath})`;
    });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function FindingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const finding = getFinding(id);
  if (!finding) notFound();

  const incomingLinks = getIncomingLinks(finding.id);
  const supersededByFindings = finding.supersededBy
    .map((sid) => getFinding(sid))
    .filter((f): f is Finding => f !== null);
  const supersedesFindings = finding.supersedes
    .map((sid) => getFinding(sid))
    .filter((f): f is Finding => f !== null);
  // Outgoing references are intentionally NOT surfaced as a structured group:
  // the body already carries a hand-written "Related:" prose line that names
  // them AND explains *why* they relate (context this footer can't). The
  // footer is reserved for relationships the prose can't express — the
  // supersession chain and incoming backlinks (who references THIS finding).

  const transformedBody = rewriteMarkdownLinks(finding.body);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
      {/* ----------------------------------------------------------------- */}
      {/* Breadcrumb back to index                                          */}
      {/* ----------------------------------------------------------------- */}
      <nav className="mb-8 text-sm">
        <Link
          href="/findings"
          className="text-graphite underline-offset-2 hover:text-pine hover:underline"
        >
          ← All findings
        </Link>
      </nav>

      {/* ----------------------------------------------------------------- */}
      {/* Header — id, date, status, confidence, scope tags                 */}
      {/* ----------------------------------------------------------------- */}
      <header className="mb-10">
        <div className="flex flex-wrap items-baseline gap-3">
          <time className="font-mono text-sm text-graphite">{finding.date}</time>
          <StatusBadge status={finding.status} />
          <ConfidenceBadge confidence={finding.confidence} />
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {humanizeId(finding.id)}
        </h1>
        <p className="mt-2 font-mono text-xs text-graphite">id: {finding.id}</p>
        {finding.scope.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {finding.scope.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-ink/5 px-2 py-0.5 font-mono text-xs text-graphite"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* Supersession banner — flag retracted / superseded findings        */}
      {/* up-front so partners don't cite stale claims.                     */}
      {/* ----------------------------------------------------------------- */}
      {finding.status === "superseded" && supersededByFindings.length > 0 && (
        <div className="mb-8 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-semibold text-warning">Superseded</p>
          <p className="mt-1 text-graphite">
            This finding was replaced by{" "}
            {supersededByFindings.map((f, i) => (
              <span key={f.id}>
                {i > 0 && ", "}
                <Link
                  href={`/findings/${f.id}`}
                  className="text-pine underline-offset-2 hover:underline"
                >
                  {humanizeId(f.id)}
                </Link>
              </span>
            ))}
            . Kept for lineage; do not cite.
          </p>
        </div>
      )}
      {finding.status === "retracted" && (
        <div className="mb-8 rounded-lg border border-brick/30 bg-brick/5 p-4 text-sm">
          <p className="font-semibold text-brick">Retracted</p>
          <p className="mt-1 text-graphite">
            This claim turned out to be wrong. Body preserved for the record.
          </p>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Body — markdown rendered with GFM tables, custom link transforms. */}
      {/* ----------------------------------------------------------------- */}
      <article className="markdown-finding prose prose-sm max-w-none sm:prose-base">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Internal /findings/* links go through Next.js routing; external
            // links open in a new tab.
            a: ({ href, children, ...props }) => {
              const hrefStr = href ?? "";
              if (hrefStr.startsWith("/findings/")) {
                return (
                  <Link
                    href={hrefStr}
                    className="text-pine underline-offset-2 hover:underline"
                  >
                    {children}
                  </Link>
                );
              }
              const isExternal = /^https?:\/\//.test(hrefStr);
              return (
                <a
                  href={hrefStr}
                  className="text-pine underline-offset-2 hover:underline"
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noreferrer noopener" : undefined}
                  {...props}
                >
                  {children}
                </a>
              );
            },
          }}
        >
          {transformedBody}
        </ReactMarkdown>
      </article>

      {/* ----------------------------------------------------------------- */}
      {/* Evidence — the substrate that makes a finding citable.            */}
      {/* ----------------------------------------------------------------- */}
      {finding.evidence.length > 0 && (
        <section className="mt-12 border-t border-graphite/15 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-graphite">
            Evidence ({finding.evidence.length})
          </h2>
          <ol className="mt-4 space-y-3">
            {finding.evidence.map((ev, i) => (
              <li
                key={i}
                className="rounded-md border border-graphite/15 bg-surface-secondary p-3 text-sm"
              >
                <div className="flex items-baseline gap-2">
                  <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-graphite">
                    {ev.kind}
                  </span>
                  <EvidenceRef evidence={ev} />
                </div>
                {ev.note && (
                  <p className="mt-1.5 text-graphite">{ev.note}</p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Supersession chain + backlinks                                    */}
      {/* ----------------------------------------------------------------- */}
      {(supersedesFindings.length > 0 || incomingLinks.length > 0) && (
        <section className="mt-12 border-t border-graphite/15 pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-graphite">
            Related
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            {supersedesFindings.length > 0 && (
              <RelatedGroup label="Supersedes" findings={supersedesFindings} />
            )}
            {incomingLinks.length > 0 && (
              <RelatedGroup label="Referenced by" findings={incomingLinks} />
            )}
          </dl>
        </section>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Source pointer — link to the canonical markdown on GitHub.        */}
      {/* ----------------------------------------------------------------- */}
      <footer className="mt-16 border-t border-graphite/15 pt-6 text-xs text-graphite">
        <p>
          Source:{" "}
          <a
            href={`https://github.com/matthewgg22/Civica/blob/codex/rebuild-feb18/docs/findings/${finding.filename}`}
            className="text-pine underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer noopener"
          >
            docs/findings/{finding.filename}
          </a>
        </p>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers / sub-components
// ---------------------------------------------------------------------------

function humanizeId(id: string): string {
  const withoutDate = id.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  const words = withoutDate.split("-");
  if (words.length === 0) return id;
  return [words[0][0]?.toUpperCase() + words[0].slice(1), ...words.slice(1)]
    .join(" ");
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-pine/10 text-pine",
    superseded: "bg-warning/10 text-warning",
    retracted: "bg-brick/10 text-brick",
  };
  const style = styles[status] ?? "bg-ink/5 text-graphite";
  return (
    <span
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide ${style}`}
    >
      {status}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
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
      conf: {confidence}
    </span>
  );
}

function EvidenceRef({ evidence }: { evidence: Evidence }) {
  const { kind, ref, line } = evidence;
  // PR + URL kinds get clickable links; others render the ref as monospace.
  if (kind === "pr" || kind === "url" || kind === "external") {
    if (/^https?:\/\//.test(ref)) {
      return (
        <a
          href={ref}
          className="break-all font-mono text-xs text-pine underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer noopener"
        >
          {ref}
        </a>
      );
    }
  }
  if (kind === "file" && ref) {
    const url = `https://github.com/matthewgg22/Civica/blob/codex/rebuild-feb18/${ref}${
      line ? `#L${line}` : ""
    }`;
    return (
      <a
        href={url}
        className="break-all font-mono text-xs text-pine underline-offset-2 hover:underline"
        target="_blank"
        rel="noreferrer noopener"
      >
        {ref}
        {line ? `:${line}` : ""}
      </a>
    );
  }
  return (
    <code className="break-all font-mono text-xs text-graphite">{ref}</code>
  );
}

function RelatedGroup({
  label,
  findings,
}: {
  label: string;
  findings: Finding[];
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-graphite">
        {label}
      </dt>
      <dd className="mt-1 space-y-1">
        {findings.map((f) => (
          <Link
            key={f.id}
            href={`/findings/${f.id}`}
            className="block text-pine underline-offset-2 hover:underline"
          >
            {humanizeId(f.id)}{" "}
            <span className="font-mono text-xs text-graphite">{f.date}</span>
          </Link>
        ))}
      </dd>
    </div>
  );
}

// Required by Next.js to silence "unused import" when the linter is strict
// — getAllFindings is exported by the loader but not referenced here yet.
// Reference it in a way the bundler tree-shakes cleanly.
void getAllFindings;
