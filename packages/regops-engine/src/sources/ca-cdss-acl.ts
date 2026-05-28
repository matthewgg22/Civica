// California CDSS All County Letters (ACL) adapter.
//
// Source URL pattern:
//   https://www.cdss.ca.gov/inforesources/letters-regulations/
//     letters-and-notices/all-county-letters/<YYYY>-all-county-letters
//
// Each year has its own index page listing every ACL published that
// year. We fetch the current year's index every tick. Letters from
// previous years are stable and don't need re-polling; counsel can
// query historical snapshots from the audit log if needed.
//
// ACL identification format on the page:
//   ACL <YY>-<NN> (<Month> <D>, <YYYY>)
//   <title text>
//
// Example from the live page on 2026-05-28:
//   ACL 26-29 (April 15, 2026)
//   CalFresh Able-Bodied Adults Without Dependents Time Limit Handbook Version 3.0
//
// PDF link href: /Portals/9/Additional-Resources/Letters-and-Notices/
//                ACLs/<YYYY>/<YY-NN>.pdf?ver=<cachebuster>
//
// Domain mapping: source_id `ca-cdss-acl` → CA per the regops_counsel_role
// migration's source_id_to_domain function. Counsel reviewers assigned
// to the CA domain see these snapshots via the existing RLS policy.

import {
  REGOPS_USER_AGENT,
  SourceAdapterBase,
  type DomainTag,
  type FetchContext,
  type SourceAdapterBaseDeps,
  type SourceAdapterPolicyOverrides,
} from "./base.js";
import type { FetchResult } from "./types.js";

/**
 * Cdss ACL document type from the index. Type field corresponds to the
 * three CDSS notice formats:
 *   - ACL = All County Letter (binding policy)
 *   - ACWDL = All County Welfare Director Letter (operational)
 *   - ACIN = All County Information Notice (informational, non-binding)
 *
 * v1 only parses ACL. ACWDL + ACIN are deferred to a follow-up adapter
 * (ca-cdss-acwdl, ca-cdss-acin) so the source-level domain mapping
 * stays clean — each gets its own counsel queue surface.
 */
export type CdssLetterType = "ACL";

export interface CdssAclEntry {
  /** ACL number in the form "YY-NN" (e.g., "26-29"). */
  readonly aclNumber: string;
  /**
   * Publication date as written on the page. We parse it to ISO-8601
   * for snapshot rows. Page format is "Month D, YYYY" with no zero-pad
   * (e.g., "April 15, 2026" or "May 1, 2026").
   */
  readonly publishedDate: string; // ISO date string (YYYY-MM-DD)
  /**
   * Original date text from the page, preserved for downstream
   * verification ("does our parse match what the page actually says").
   */
  readonly publishedDateText: string;
  /** Title text — the human-readable subject line. */
  readonly title: string;
  /** Absolute URL to the ACL PDF on cdss.ca.gov. */
  readonly url: string;
  /** Letter type discriminator. */
  readonly type: CdssLetterType;
}

/**
 * Minimal fetch contract — mirrors the FederalRegisterAdapter pattern so
 * tests can inject a stub without touching globalThis.
 */
export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface CaCdssAclAdapterDeps extends SourceAdapterBaseDeps {
  readonly fetch?: FetchLike;
  /**
   * Override the year used to construct the index URL. Defaults to the
   * current UTC year at fetch time. Tests inject explicit years to keep
   * results deterministic.
   */
  readonly year?: number;
}

const CDSS_BASE = "https://www.cdss.ca.gov";

/**
 * Minimum plausible ACL count on a year-index page. By June of any
 * normal year there are at least ~20 ACLs (CDSS publishes ~50/yr). We
 * use a low floor here to avoid false structural-failures in early
 * January when only a few have been published; combined with the
 * regex-based extraction this is defense-in-depth, not a hard SLA.
 *
 * If a year's page returns fewer than this, we flag StructuralFailure
 * so an operator can inspect (page redesign, JS-loaded content drift,
 * etc.).
 */
const MIN_PLAUSIBLE_ACLS = 1;

export class CaCdssAclAdapter extends SourceAdapterBase<CdssAclEntry> {
  readonly id = "ca-cdss-acl";
  readonly domainTag: DomainTag = "eligibility";

  private readonly fetchImpl: FetchLike;
  private readonly yearOverride: number | undefined;
  private lastUrlHash: string | undefined;

  constructor(
    deps: CaCdssAclAdapterDeps,
    overrides: SourceAdapterPolicyOverrides = {},
  ) {
    super(deps, overrides);
    this.fetchImpl =
      deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.yearOverride = deps.year;
    if (typeof this.fetchImpl !== "function") {
      throw new Error(
        "CaCdssAclAdapter: no fetch implementation available. " +
          "Provide deps.fetch (test) or run on a platform with global fetch.",
      );
    }
  }

  /**
   * Exposed for tests + consumers that want to know the URL we'll hit
   * without driving a full fetch.
   */
  get url(): string {
    const year = this.yearOverride ?? new Date().getUTCFullYear();
    return (
      `${CDSS_BASE}/inforesources/letters-regulations/` +
      `letters-and-notices/all-county-letters/${year}-all-county-letters`
    );
  }

  protected async performFetch(
    ctx: FetchContext,
  ): Promise<FetchResult<CdssAclEntry>> {
    const url = this.url;

    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(url, {
        headers: {
          "User-Agent": ctx.userAgent,
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout =
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError");
      return {
        kind: "TransientFailure",
        error: isTimeout
          ? `CDSS ACL index fetch timed out after 30s (${url})`
          : `Network error fetching CDSS ACL index: ${message}`,
      };
    }

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        return {
          kind: "TransientFailure",
          error: `CDSS ACL index returned ${response.status} ${response.statusText}`,
        };
      }
      // 4xx means the year-page URL pattern moved. CDSS has done this
      // before (the /Letters-Regulations vs /letters-regulations swap)
      // so we treat 4xx as a structural alert, not a silent skip.
      const bodySample = await safeReadText(response);
      return {
        kind: "StructuralFailure",
        error:
          `CDSS ACL index returned ${response.status} ${response.statusText}. ` +
          `URL pattern may have moved (last good: ${url}).`,
        rawDocSampleRef: bodySample.slice(0, 2048),
      };
    }

    let html: string;
    try {
      html = await response.text();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        kind: "TransientFailure",
        error: `Failed to read CDSS ACL index body: ${message}`,
      };
    }

    const entries = parseAclIndexHtml(html);
    if (entries.length < MIN_PLAUSIBLE_ACLS) {
      return {
        kind: "StructuralFailure",
        error:
          `Found only ${entries.length} ACL(s) on the year index ` +
          `(expected ≥${MIN_PLAUSIBLE_ACLS}). Page layout likely changed.`,
        rawDocSampleRef: html.slice(0, 2048),
      };
    }

    const fetchedAt = new Date(ctx.attemptStartedAtMs);
    const urlHash = hashAclEntries(entries);

    if (this.lastUrlHash !== undefined && this.lastUrlHash === urlHash) {
      return { kind: "NoChange", fetchedAt, urlHash };
    }
    this.lastUrlHash = urlHash;
    return { kind: "Success", data: entries, fetchedAt, urlHash };
  }
}

// -----------------------------------------------------------------------
// HTML parsing — regex-based to keep the dependency footprint small.
// Exported for tests.
// -----------------------------------------------------------------------

/**
 * Anchor tag pattern for ACL PDFs. Captures both the relative href and
 * the visible text "ACL YY-NN (Month D, YYYY)".
 *
 * Page format observed 2026-05-28:
 *   <a href="/Portals/9/Additional-Resources/Letters-and-Notices/ACLs/
 *           2026/26-29.pdf?ver=...">ACL 26-29 (April 15, 2026)</a>
 *
 * Followed (after some HTML padding) by the title text.
 */
const ACL_ANCHOR_RX =
  /<a\b[^>]*href=["'](\/Portals\/9\/[^"']*\/ACLs\/(\d{4})\/(\d{2}-\d+)\.pdf[^"']*)["'][^>]*>\s*ACL\s+(\d{2}-\d+)\s*\(([^)]+)\)\s*<\/a>/gi;

/**
 * Title extraction: after an ACL anchor closes, the next chunk of plain
 * text before any subsequent <a or block tag is the title. We strip
 * HTML tags from a forward-looking window and take the first
 * non-empty line.
 */
const TITLE_LOOKAHEAD_BYTES = 600;

export function parseAclIndexHtml(html: string): CdssAclEntry[] {
  const entries: CdssAclEntry[] = [];
  const seen = new Set<string>();

  // We need to find each anchor's match end so we can look forward for
  // the title. matchAll doesn't expose end-index directly, but exec
  // with global state does.
  const rx = new RegExp(ACL_ANCHOR_RX.source, ACL_ANCHOR_RX.flags);
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    const relUrl = m[1] ?? "";
    const yearStr = m[2] ?? "";
    const aclNumber = m[3] ?? "";
    const aclNumberRepeat = m[4] ?? "";
    const dateText = (m[5] ?? "").trim();

    // Sanity: the two ACL numbers in the match should agree.
    if (aclNumber !== aclNumberRepeat) {
      continue;
    }

    // Dedup — the same anchor can appear multiple times if the page
    // has redundant layout sections.
    const dedupKey = `${yearStr}|${aclNumber}`;
    if (seen.has(dedupKey)) {
      continue;
    }
    seen.add(dedupKey);

    const absUrl = relUrl.startsWith("http")
      ? relUrl
      : `${CDSS_BASE}${relUrl}`;

    // Title lookahead from the anchor's end.
    const lookaheadStart = m.index + m[0].length;
    const lookaheadWindow = html.slice(
      lookaheadStart,
      lookaheadStart + TITLE_LOOKAHEAD_BYTES,
    );
    const title = extractFirstNonEmptyTextLine(lookaheadWindow);

    const publishedDate = parseCdssDateToIso(dateText);

    entries.push({
      aclNumber,
      publishedDate,
      publishedDateText: dateText,
      title,
      url: absUrl,
      type: "ACL",
    });
  }

  return entries;
}

/**
 * Extract the first non-empty text line from a chunk of HTML, stripping
 * tags. We stop at the next <a or <h block tag to avoid greedy title
 * capture from neighboring entries.
 *
 * Exported for tests.
 */
export function extractFirstNonEmptyTextLine(htmlChunk: string): string {
  // Cut at the next <a or <h to stay within this entry's bounds.
  const cutMatch = htmlChunk.search(/<a\b|<h[1-6]\b/i);
  const bounded = cutMatch >= 0 ? htmlChunk.slice(0, cutMatch) : htmlChunk;

  // Strip remaining tags, decode &amp; etc. minimally, collapse whitespace.
  const stripped = bounded
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  return stripped;
}

/**
 * Parse CDSS date text ("April 15, 2026") to ISO date ("2026-04-15").
 * Returns empty string if the date is unparseable — the publishedDateText
 * field preserves the original.
 *
 * Exported for tests.
 */
export function parseCdssDateToIso(dateText: string): string {
  const months: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  const m = dateText.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/);
  if (m === null) return "";
  const monthName = (m[1] ?? "").toLowerCase();
  const day = parseInt(m[2] ?? "", 10);
  const year = parseInt(m[3] ?? "", 10);
  const month = months[monthName];
  if (month === undefined || !Number.isInteger(day) || !Number.isInteger(year)) {
    return "";
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Stable content hash of the parsed entries. Used by the adapter's
 * NoChange detection. Includes only the fields that semantically matter
 * (ACL number + url + title) so a CDN cache-buster query param change
 * doesn't flip the hash.
 */
function hashAclEntries(entries: readonly CdssAclEntry[]): string {
  const stable = entries
    .map((e) => `${e.aclNumber}|${stripQueryString(e.url)}|${e.title}`)
    .sort()
    .join("\n");
  return cheapHash(stable);
}

function stripQueryString(url: string): string {
  const q = url.indexOf("?");
  return q < 0 ? url : url.slice(0, q);
}

/**
 * Non-crypto FNV-1a style hash. Cheap, stable, well-distributed enough
 * for "did the content change" detection. Matches the cheapHash used
 * by other adapters in this package.
 */
function cheapHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function safeReadText(
  response: Awaited<ReturnType<FetchLike>>,
): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

// Suppress unused-import lint by re-using the user-agent constant in a
// comment-friendly way: the parent class injects it via FetchContext.
void REGOPS_USER_AGENT;
