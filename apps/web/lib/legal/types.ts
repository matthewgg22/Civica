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
// WHY `status` IS LOAD-BEARING. A document with status "draft" renders a visible
// banner saying so. An unreviewed policy that silently reads as live policy is
// the specific failure this guards against: these are written against the code
// but they are not yet counsel-approved, and a reader cannot tell the difference
// from the prose alone. Flip to "published" only after sign-off.

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
 *  the purge job is built it MUST import these constants rather than restating
 *  them — a policy promising 7 days over a job that deletes at 90 is a false
 *  statement about privacy, which is the one kind of error this product cannot
 *  afford. */
export const RETENTION_DAYS = {
  /** Question and answer text on an ordinary row. */
  questionText: 7,
  /** Rows flagged for accuracy review (unrecognized citation, thumbs-down). */
  flaggedRow: 30,
} as const;

/** Whether the job that actually enforces RETENTION_DAYS exists and runs.
 *
 *  IT DOES NOT, TODAY. lib/demeter-audit-sink.ts says retention is "enforced by
 *  the retention job, not here" — and there is no such job anywhere in the repo.
 *  Nothing has ever been deleted from mae_query_log; every question and answer
 *  written since the public chat launched is still there.
 *
 *  That makes the retention section of the Privacy Policy a statement of INTENT
 *  rather than of fact, which is exactly the kind of privacy claim a product
 *  serving this population must not publish. So the claims test refuses to let
 *  any document reach status "published" while this is false. Build the job,
 *  point it at RETENTION_DAYS, flip this to true, and the gate opens. */
export const RETENTION_JOB_LIVE = false;
