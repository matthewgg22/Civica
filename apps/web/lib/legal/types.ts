// Legal document model — the shared shape for the Privacy Policy, Terms of
// Service and Safety & Grounding Notice.
//
// WHY A STRUCTURE AND NOT MARKDOWN FILES. These documents have two audiences
// that need two formats: counsel redlines Markdown, and the site renders React.
// Keeping prose in one typed structure and GENERATING the Markdown (see
// scripts/generate-legal-md.ts) means there is exactly one copy of every
// sentence. The alternative — a .md file beside a .tsx page — drifts the first
// time someone edits one and not the other, and a privacy policy that disagrees
// with itself is worse than one that is merely late.
//
// WHY `status` IS LOAD-BEARING. It gates the retention-window check in
// legal-claims.test.ts: a document may only claim a retention window it can
// enforce. The placeholder check no longer keys off status (#1056) — every
// document renders publicly regardless of it, so NO document may render an
// unfilled [PLACEHOLDER], draft or not. `status` stays "draft" as the
// not-finished signal until counsel sign-off; flip to "published" only after.
//
// IT NO LONGER RENDERS A BANNER. Until 2026-08-26 a "draft" document showed a
// visible notice saying it had not been reviewed by counsel; that was removed
// by owner decision. The status here is unchanged and still says draft, so the
// page and the data now disagree about what a reader is told. #1013 tracks the
// counsel review that resolves it.

/** A block of document content. Deliberately small — these documents need
 *  paragraphs, lists, tables and emphasis, and nothing else. */
export type Block =
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  /** Set off from the body — used for the plain-language promises at the top
   *  and for the all-caps disclaimers the law wants conspicuous. */
  | { kind: "callout"; text: string; tone: "promise" | "warning" }
  | { kind: "table"; columns: string[]; rows: string[][] };

export type Section = {
  /** Stable anchor. Referenced by other documents and by external links (the
   *  CCPA do-not-sell link must be addressable), so treat these as an API:
   *  renaming one breaks inbound links. */
  id: string;
  heading: string;
  blocks: Block[];
};

export type LegalDocument = {
  /** URL path this document is published at. */
  slug: "privacy" | "terms" | "safety";
  title: string;
  /** One line under the title saying what the document is for. */
  lede: string;
  lastUpdated: string;
  /** "draft" renders the unreviewed-document banner. See note above. */
  status: "draft" | "published";
  sections: Section[];
};

/** The legal entity behind Demeter. Referenced by every document, so a rename
 *  is one edit and the claims test can assert no document names anything else. */
export const ENTITY = "Civica Technologies LLC" as const;

/** Contact addresses. THESE MAILBOXES MUST EXIST BEFORE PUBLISH — a privacy
 *  contact that bounces is not merely unhelpful, it defeats the rights request
 *  process that CCPA §1798.130 requires us to provide. */
export const CONTACT = {
  privacy: "privacy@civica.app",
  legal: "legal@civica.app",
} as const;

/** Retention windows, in days, for the public chat's accuracy record
 *  (snap_enrollment.mae_query_log).
 *
 *  PINNED HERE AND ASSERTED BY lib/legal/__tests__/legal-claims.test.ts so the
 *  published number cannot drift from the number the purge job enforces. When
 *  the purge job is built it MUST NOT restate these numbers unchecked — a
 *  policy promising 7 days over a job that deletes at 90 is a false statement
 *  about privacy, which is the one kind of error this product cannot afford.
 *
 *  The job now lives in SQL (20260824), which cannot import a TS constant. So
 *  the check moved rather than lapsed: demeter-retention.pg.test.ts runs the
 *  real function against a real database and asserts the OBSERVED cutoff is
 *  the value below, on both sides of the boundary. */
export const RETENTION_DAYS = {
  /** Question and answer text on an ordinary row. */
  questionText: 7,
  /** Rows flagged for accuracy review (unrecognized citation, thumbs-down). */
  flaggedRow: 30,
} as const;

/** Whether the job that actually enforces RETENTION_DAYS exists AND RUNS.
 *
 *  THE JOB NOW EXISTS (#926), as a database function on the pg_cron schedule
 *  this project already runs: snap_enrollment.purge_mae_query_log_retention(),
 *  scheduled daily at 04:10 UTC by migration 20260824.
 *
 *  It was previously a Vercel cron calling a TypeScript route, which could not
 *  begin working until an operator set CRON_SECRET — the route failed closed
 *  without it. Moving enforcement next to the data removed that step: pasting
 *  the migration is the whole install.
 *
 *  TRUE SINCE 2026-08-22, on observed behaviour rather than on merged code —
 *  which is the distinction this constant exists to hold. What was checked, in
 *  prod, over the read-only connection:
 *
 *    - migration 20260824 applied, and the LIVE function definition is
 *      byte-identical to the repo's copy (this project has a history of
 *      migrations being hand-edited at paste time and the repo never
 *      learning — see 20260569 and 20260570);
 *    - `demeter-purge-query-log-daily` registered, `10 4 * * *`, active;
 *    - the first sweep RAN: 12 ordinary rows blanked, 0 flagged;
 *    - afterwards 12 rows carry the tombstone, 0 of them still hold answer
 *      text, and all 13 rows are still present — the text expired, the row
 *      did not, which is the whole design;
 *    - a dry run now returns 0 for both tiers, so the job is caught up and
 *      idempotent.
 *
 *  Flipping this back to false is the correct move if that job is ever paused
 *  or unscheduled — the promise is about the running system, not the code. */
export const RETENTION_JOB_LIVE = true;
