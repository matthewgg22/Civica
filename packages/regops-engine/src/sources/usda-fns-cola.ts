// UsdaFnsColaAdapter — second concrete SourceAdapter.
//
// Polls the USDA FNS COLA landing page for fiscal-year-tagged PDFs
// containing the annual cost-of-living adjustment numbers (max
// allotments, gross/net income limits, standard deductions, excess
// shelter cap). This is the single most important source we cannot
// miss — the August COLA memo drives Oct-1 effective federal
// eligibility math.
//
// v1 scope: DETECTION-ONLY.
//   We fetch the HTML index, extract every PDF link that looks COLA-
//   relevant, and surface them as RawDocs with light fiscal-year +
//   region inference. We do NOT download the PDFs or extract tables
//   from them — PDF table parsing is the drafter's job (E1, LLM-
//   assisted extraction per docs/regops/source-adapters.md "PDF format
//   changed: extract via Claude API; flag for manual review").
//
// What this gets us:
//   - A new FY appearing on the index page produces a Success result
//     and the drafter is triggered to extract the new memo's tables.
//   - A PDF being silently replaced at the same URL (rare; happened
//     2024-08-15) is NOT caught by v1 — the link text + URL would
//     have to change for us to notice. TODO #1 below.
//   - A broken index page (zero plausible COLA links) produces
//     StructuralFailure → page-severity alert.
//
// TODOs (deliberately deferred):
//   1. PDF content hashing: HEAD or partial-GET each PDF on every poll
//      so silent in-place replacements are caught. Adds latency +
//      bandwidth; defer until we have one live silent-replacement
//      false-negative in production to justify the cost.
//   2. FY-refresh hourly cadence override: during the third week of
//      August, override pollIntervalMs to 1h via fy_refresh_active
//      feature flag. Requires the feature-flag plumbing this package
//      doesn't have yet; defer until the flag exists.
//
// References:
//   - https://www.fns.usda.gov/snap/allotment/cola
//   - docs/regops/source-adapters.md §"usda-fns-cola"
//   - docs/snap/fy-rules-refresh-checklist.md (annual cadence)
//   - docs/regops/runbook.md §"Source wedged" (alert response)

import { createHash } from "node:crypto";

import {
  SourceAdapterBase,
  type DomainTag,
  type FetchContext,
  type SourceAdapterBaseDeps,
  type SourceAdapterPolicyOverrides,
} from "./base.js";
import type { FetchLike } from "./federal-register.js";
import type { FetchResult } from "./types.js";

/**
 * Coarse region classification. "us-48" covers the 48 contiguous states
 * + DC and is the dominant case; non-contiguous regions get their own
 * PDFs and historically distinct numbers.
 */
export type UsdaColaRegion = "us-48" | "ak" | "hi" | "guam" | "usvi" | "unknown";

/**
 * Coarse content classification inferred from link text. The drafter
 * uses this as a routing hint — it's not authoritative. "other" covers
 * USDA's occasional supplementary memos (e.g., transition guidance)
 * that show up on the same index page.
 */
export type UsdaColaResourceKind =
  | "max-allotment"
  | "income-limit"
  | "deduction"
  | "shelter-cap"
  | "other";

/**
 * One COLA-relevant link from the index page. We carry the raw href +
 * link text unmodified so the drafter sees what we saw; the inferred
 * fields are convenience signals, not ground truth.
 */
export interface UsdaColaResourceLink {
  readonly href: string;
  readonly linkText: string;
  readonly inferredFiscalYear: number | null;
  readonly inferredRegion: UsdaColaRegion;
  readonly inferredKind: UsdaColaResourceKind;
}

const ENDPOINT_URL = "https://www.fns.usda.gov/snap/allotment/cola";

/**
 * If we extract fewer than this many plausible COLA PDFs from the
 * index, the page layout almost certainly changed. Historical baseline:
 * at any point in time the index lists current FY + 1-2 prior FYs +
 * non-contiguous-region variants = ~3-6 PDFs minimum.
 *
 * Set to 2 to balance "USDA pruned the older years" against "page
 * silently broke and we shipped wrong rules." The runbook alert on
 * StructuralFailure makes the on-call investigate either way.
 */
const MIN_PLAUSIBLE_LINKS = 2;

export interface UsdaFnsColaAdapterDeps extends SourceAdapterBaseDeps {
  readonly fetch?: FetchLike;
}

export class UsdaFnsColaAdapter extends SourceAdapterBase<UsdaColaResourceLink> {
  readonly id = "usda-fns-cola";
  readonly domainTag: DomainTag = "eligibility";
  readonly url = ENDPOINT_URL;

  private readonly fetchImpl: FetchLike;
  private lastUrlHash: string | undefined;

  constructor(deps: UsdaFnsColaAdapterDeps, overrides: SourceAdapterPolicyOverrides = {}) {
    super(deps, overrides);
    this.fetchImpl = deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
    if (typeof this.fetchImpl !== "function") {
      throw new Error(
        "UsdaFnsColaAdapter: no fetch implementation available. " +
          "Provide deps.fetch (test) or run on a platform with global fetch.",
      );
    }
  }

  protected async performFetch(
    ctx: FetchContext,
  ): Promise<FetchResult<UsdaColaResourceLink>> {
    // 30s fetch timeout. USDA FNS is on a CDN that occasionally
    // takes a long time to first byte; without an abort the cron's
    // overall 10-minute budget could be burned by one slow source.
    // AbortSignal.timeout requires Node 18.17+ / Bun / Workers — all
    // of our runtime targets.
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(this.url, {
        headers: {
          "User-Agent": ctx.userAgent,
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout =
        err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      return {
        kind: "TransientFailure",
        error: isTimeout
          ? `USDA FNS COLA index fetch timed out after 30s`
          : `Network error fetching USDA FNS COLA index: ${message}`,
      };
    }

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        return {
          kind: "TransientFailure",
          error: `USDA FNS COLA index returned ${response.status} ${response.statusText}`,
        };
      }
      // 4xx (non-429) means the URL or path changed. Historical incident
      // 2024-08-15: pattern moved from /fy{NN} to /fy-{YYYY}; the index
      // URL itself is fairly stable but defense-in-depth in case it moves.
      const bodySample = await safeReadText(response);
      return {
        kind: "StructuralFailure",
        error: `USDA FNS COLA index returned ${response.status} ${response.statusText}`,
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
        error: `Failed to read USDA FNS COLA index body: ${message}`,
      };
    }

    const links = parseColaIndexHtml(html);
    if (links.length < MIN_PLAUSIBLE_LINKS) {
      return {
        kind: "StructuralFailure",
        error:
          `Found only ${links.length} plausible COLA PDF link(s) on the index ` +
          `(expected ≥${MIN_PLAUSIBLE_LINKS}). Page layout likely changed.`,
        rawDocSampleRef: html.slice(0, 2048),
      };
    }

    const fetchedAt = new Date(ctx.attemptStartedAtMs);
    const urlHash = hashColaLinks(links);

    if (this.lastUrlHash !== undefined && this.lastUrlHash === urlHash) {
      return { kind: "NoChange", fetchedAt, urlHash };
    }
    this.lastUrlHash = urlHash;
    return { kind: "Success", data: links, fetchedAt, urlHash };
  }
}

// -----------------------------------------------------------------------
// HTML parsing (exported for tests; deliberately regex-based to keep
// the dependency footprint small. If USDA's page grows enough JS-driven
// content that this stops working, we add a real DOM dep then.)
// -----------------------------------------------------------------------

/**
 * Capture every <a href="...pdf">...</a> tag's href + inner text. We
 * intentionally over-match here (capture every PDF link) and filter
 * downstream — false positives are cheap (drafter ignores them), while
 * missing a real COLA link is expensive.
 */
const ANCHOR_PDF_RX = /<a\b[^>]*href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

const COLA_KEYWORDS_RX =
  /\b(cola|cost.of.living|maximum.allotment|max.allotment|income.limit|standard.deduction|shelter|excess.shelter|snap|food.stamp)\b/i;

export function parseColaIndexHtml(html: string): readonly UsdaColaResourceLink[] {
  const out: UsdaColaResourceLink[] = [];
  const seenHrefs = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = ANCHOR_PDF_RX.exec(html)) !== null) {
    const href = match[1] ?? "";
    const inner = match[2] ?? "";
    if (href === "" || seenHrefs.has(href)) continue;

    const linkText = stripTags(inner).replace(/\s+/g, " ").trim();
    // The COLA keyword filter is what turns this from "every PDF on
    // the page" into "every PDF that plausibly carries COLA numbers."
    // If the keyword shows up in either the link text OR the href,
    // include the link.
    if (!COLA_KEYWORDS_RX.test(linkText) && !COLA_KEYWORDS_RX.test(href)) {
      continue;
    }

    seenHrefs.add(href);
    out.push({
      href,
      linkText,
      inferredFiscalYear: inferFiscalYear(linkText, href),
      inferredRegion: inferRegion(linkText, href),
      inferredKind: inferKind(linkText),
    });
  }

  return out;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

/**
 * Pull a fiscal year out of either the link text or the URL. Accepts
 * FY 2024, FY2024, FY24, fy-2024, fy24 — the formats USDA has used
 * across years. Returns null if nothing plausible matches.
 */
export function inferFiscalYear(linkText: string, href: string): number | null {
  const candidates = [linkText, href];
  for (const s of candidates) {
    // FY 2024 / FY2024 / fy-2024
    const m4 = s.match(/\bFY[\s_-]?(20\d{2})\b/i);
    if (m4) {
      const year = Number(m4[1]);
      if (year >= 2015 && year <= 2100) return year;
    }
    // FY24 / fy-24 — 2-digit, assume 20xx
    const m2 = s.match(/\bFY[\s_-]?(\d{2})\b/i);
    if (m2) {
      const yy = Number(m2[1]);
      const year = 2000 + yy;
      if (year >= 2015 && year <= 2100) return year;
    }
    // Bare 20xx near the word "fiscal" or "FY"
    const mNear = s.match(/(20\d{2})\s*(?:cola|allotment|fiscal)|(?:fiscal\s+year\s+)(20\d{2})/i);
    if (mNear) {
      const year = Number(mNear[1] ?? mNear[2]);
      if (year >= 2015 && year <= 2100) return year;
    }
  }
  return null;
}

const REGION_PATTERNS: ReadonlyArray<readonly [RegExp, UsdaColaRegion]> = [
  [/\b(48\s*(contiguous|states?)|continental|lower\s*48)\b/i, "us-48"],
  [/\balaska\b|\bak\b/i, "ak"],
  [/\bhawaii\b|\bhi\b/i, "hi"],
  [/\bguam\b/i, "guam"],
  [/\b(u\.?s\.?\s*virgin\s*islands|usvi|virgin\s*islands)\b/i, "usvi"],
];

export function inferRegion(linkText: string, href: string): UsdaColaRegion {
  const haystack = `${linkText} ${href}`;
  for (const [rx, region] of REGION_PATTERNS) {
    if (rx.test(haystack)) return region;
  }
  return "unknown";
}

const KIND_PATTERNS: ReadonlyArray<readonly [RegExp, UsdaColaResourceKind]> = [
  [/\b(max(imum)?\s+allotment|allotments?\b)/i, "max-allotment"],
  [/\bincome\s+(eligibility\s+)?(limits?|standards?)\b|\b(gross|net)\s+income\b/i, "income-limit"],
  [/\bstandard\s+deduction(s)?\b/i, "deduction"],
  [/\b(excess\s+)?shelter\s+(cap|deduction)\b/i, "shelter-cap"],
];

export function inferKind(linkText: string): UsdaColaResourceKind {
  for (const [rx, kind] of KIND_PATTERNS) {
    if (rx.test(linkText)) return kind;
  }
  return "other";
}

/**
 * Stable content hash for change detection. Sorted by href; preserves
 * link text changes (USDA sometimes edits the visible label of an
 * existing PDF link, which is a real change worth surfacing).
 */
export function hashColaLinks(links: readonly UsdaColaResourceLink[]): string {
  const sorted = [...links].sort((a, b) => a.href.localeCompare(b.href));
  const canonical = sorted.map((l) => ({
    href: l.href,
    linkText: l.linkText,
    inferredFiscalYear: l.inferredFiscalYear,
    inferredRegion: l.inferredRegion,
    inferredKind: l.inferredKind,
  }));
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

async function safeReadText(response: Awaited<ReturnType<FetchLike>>): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
