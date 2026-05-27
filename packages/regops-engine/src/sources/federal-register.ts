// FederalRegisterAdapter — first concrete SourceAdapter implementation.
//
// Polls the Federal Register API for documents tagged with the
// Food and Nutrition Service (FNS) agency. Each result is a proposed
// rule, final rule, notice, or presidential document that could affect
// SNAP eligibility math, exemption criteria, or required disclosures.
//
// Why this source first:
//   - Documented JSON API (no PDF/HTML scraping fragility)
//   - Stable rate limits (1000/hr — well under our hourly poll cap)
//   - No auth required
//   - `effective_on` field is authoritative, no LLM extraction needed
//     to determine when a change actually takes effect
//
// References:
//   - docs/regops/source-adapters.md §"federal-register-snap"
//   - https://www.federalregister.gov/developers/documentation/api/v1
//   - docs/designs/regops-engine.md §"Source-pluggable polling layer"

import { createHash } from "node:crypto";

import {
  SourceAdapterBase,
  type DomainTag,
  type FetchContext,
  type SourceAdapterBaseDeps,
  type SourceAdapterPolicyOverrides,
} from "./base.js";
import type { FetchResult } from "./types.js";

/**
 * Document types the Federal Register surfaces. We carry this through
 * unchanged so the drafter can route on it (proposed rules go to a
 * lighter-weight review; final rules trigger the ERE gate).
 */
export type FederalRegisterDocumentType =
  | "Rule"
  | "Proposed Rule"
  | "Notice"
  | "Presidential Document";

/**
 * The subset of fields we depend on from the Federal Register API. Any
 * additional fields the API returns are preserved on the raw response
 * but not surfaced here. If we need more fields, extend the interface
 * (additive change; tests will continue to pass).
 */
export interface FederalRegisterDocument {
  /** "2026-12345" — stable identifier from the API. */
  readonly document_number: string;
  readonly title: string;
  readonly type: FederalRegisterDocumentType;
  /** ISO date the doc was published in the Federal Register. */
  readonly publication_date: string;
  /** ISO date the rule takes effect; absent for notices and some proposed rules. */
  readonly effective_on: string | null;
  /** Canonical FR URL for citation. */
  readonly html_url: string;
  /** Agency slugs ("food-and-nutrition-service") for cross-referencing. */
  readonly agencies: readonly string[];
}

/**
 * Shape we expect the API to return. Captures the minimum we need plus
 * pagination — additional fields are ignored. Validated by the parser.
 */
interface FederalRegisterApiResponse {
  readonly results?: readonly unknown[];
  readonly next_page_url?: string | null;
  readonly count?: number;
}

const ENDPOINT_URL =
  "https://www.federalregister.gov/api/v1/documents.json" +
  "?conditions[agencies][]=food-and-nutrition-service" +
  "&per_page=100" +
  "&order=newest";

/**
 * Minimal fetch-like contract the adapter depends on. Lets tests inject
 * a stub without monkey-patching globalThis. In production this defaults
 * to globalThis.fetch (Node 18+ / Workers runtime).
 */
export type FetchLike = (
  input: string,
  init?: { headers?: Readonly<Record<string, string>>; signal?: AbortSignal },
) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly headers: { get(name: string): string | null };
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export interface FederalRegisterAdapterDeps extends SourceAdapterBaseDeps {
  /**
   * Optional fetch override (tests inject a stub). Defaults to the
   * platform `fetch`. We type as `FetchLike` (not the global Fetch)
   * to keep the surface area small and the mock obvious.
   */
  readonly fetch?: FetchLike;
}

export class FederalRegisterAdapter extends SourceAdapterBase<FederalRegisterDocument> {
  readonly id = "federal-register-snap";
  readonly domainTag: DomainTag = "eligibility";
  readonly url = ENDPOINT_URL;

  private readonly fetchImpl: FetchLike;

  /**
   * Hash of the most recent successful payload. If a subsequent fetch
   * returns the same content, the adapter emits `NoChange` instead of
   * `Success`. Stored in memory only — production reconciliation against
   * the last persisted snapshot is the responsibility of the polling
   * loop (and is more durable than per-process memory).
   */
  private lastUrlHash: string | undefined;

  constructor(deps: FederalRegisterAdapterDeps, overrides: SourceAdapterPolicyOverrides = {}) {
    super(deps, overrides);
    this.fetchImpl = deps.fetch ?? (globalThis.fetch as unknown as FetchLike);
    if (typeof this.fetchImpl !== "function") {
      throw new Error(
        "FederalRegisterAdapter: no fetch implementation available. " +
          "Provide deps.fetch (test) or run on a platform with global fetch (Node 18+ / Workers).",
      );
    }
  }

  protected async performFetch(
    ctx: FetchContext,
  ): Promise<FetchResult<FederalRegisterDocument>> {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.fetchImpl(this.url, {
        headers: {
          "User-Agent": ctx.userAgent,
          Accept: "application/json",
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        kind: "TransientFailure",
        error: `Network error fetching Federal Register: ${message}`,
      };
    }

    // 429 / 5xx → transient. Honor Retry-After if present.
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterMs = parseRetryAfter(retryAfterHeader);
        const transient: FetchResult<FederalRegisterDocument> = {
          kind: "TransientFailure",
          error: `Federal Register returned ${response.status} ${response.statusText}`,
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        };
        return transient;
      }
      // 4xx (non-429) means we're asking for the wrong thing — schema or
      // URL drift. Treat as structural so a human investigates.
      const bodySample = await safeReadText(response);
      return {
        kind: "StructuralFailure",
        error: `Federal Register returned ${response.status} ${response.statusText}`,
        rawDocSampleRef: bodySample.slice(0, 2048),
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        kind: "StructuralFailure",
        error: `Federal Register JSON parse failed: ${message}`,
        rawDocSampleRef: "",
      };
    }

    const parsed = parseApiResponse(payload);
    if (!parsed.ok) {
      return {
        kind: "StructuralFailure",
        error: parsed.error,
        rawDocSampleRef: JSON.stringify(payload).slice(0, 2048),
      };
    }

    const fetchedAt = new Date(ctx.attemptStartedAtMs);
    const urlHash = hashDocuments(parsed.documents);

    if (this.lastUrlHash !== undefined && this.lastUrlHash === urlHash) {
      return { kind: "NoChange", fetchedAt, urlHash };
    }

    this.lastUrlHash = urlHash;
    return {
      kind: "Success",
      data: parsed.documents,
      fetchedAt,
      urlHash,
    };
  }
}

// -----------------------------------------------------------------------
// Pure helpers (exported for tests; keeps the adapter class small)
// -----------------------------------------------------------------------

/**
 * Validate the API envelope + each result row. Rejects anything that
 * doesn't carry the fields we promised in FederalRegisterDocument — a
 * missing field upstream is a schema-drift signal, not something to
 * paper over with `??`.
 */
export function parseApiResponse(
  raw: unknown,
):
  | { readonly ok: true; readonly documents: readonly FederalRegisterDocument[] }
  | { readonly ok: false; readonly error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "Federal Register response is not a JSON object" };
  }
  const envelope = raw as FederalRegisterApiResponse;
  if (envelope.results === undefined) {
    // Empty result set is legitimate (no SNAP/FNS docs today). The API
    // returns an empty array in that case, not a missing field.
    return { ok: false, error: "Federal Register response missing 'results' array" };
  }
  if (!Array.isArray(envelope.results)) {
    return { ok: false, error: "Federal Register 'results' is not an array" };
  }
  const documents: FederalRegisterDocument[] = [];
  for (let i = 0; i < envelope.results.length; i++) {
    const row = envelope.results[i];
    const validated = validateDocument(row);
    if (!validated.ok) {
      return { ok: false, error: `results[${i}]: ${validated.error}` };
    }
    documents.push(validated.document);
  }
  return { ok: true, documents };
}

function validateDocument(
  raw: unknown,
):
  | { readonly ok: true; readonly document: FederalRegisterDocument }
  | { readonly ok: false; readonly error: string } {
  if (!isPlainObject(raw)) {
    return { ok: false, error: "row is not an object" };
  }
  const r = raw as Record<string, unknown>;
  const document_number = expectString(r, "document_number");
  if (!document_number.ok) return document_number;
  const title = expectString(r, "title");
  if (!title.ok) return title;
  const type = expectDocType(r);
  if (!type.ok) return type;
  const publication_date = expectString(r, "publication_date");
  if (!publication_date.ok) return publication_date;
  const html_url = expectString(r, "html_url");
  if (!html_url.ok) return html_url;
  const agencies = expectAgencies(r);
  if (!agencies.ok) return agencies;

  // effective_on is nullable in the Federal Register API.
  let effective_on: string | null = null;
  if (r["effective_on"] !== undefined && r["effective_on"] !== null) {
    if (typeof r["effective_on"] !== "string") {
      return { ok: false, error: "effective_on is neither string nor null" };
    }
    effective_on = r["effective_on"];
  }

  return {
    ok: true,
    document: {
      document_number: document_number.value,
      title: title.value,
      type: type.value,
      publication_date: publication_date.value,
      effective_on,
      html_url: html_url.value,
      agencies: agencies.value,
    },
  };
}

const VALID_DOC_TYPES: ReadonlySet<FederalRegisterDocumentType> = new Set([
  "Rule",
  "Proposed Rule",
  "Notice",
  "Presidential Document",
]);

function expectDocType(
  r: Record<string, unknown>,
):
  | { readonly ok: true; readonly value: FederalRegisterDocumentType }
  | { readonly ok: false; readonly error: string } {
  const v = r["type"];
  if (typeof v !== "string") {
    return { ok: false, error: "type is missing or not a string" };
  }
  if (!VALID_DOC_TYPES.has(v as FederalRegisterDocumentType)) {
    return { ok: false, error: `type '${v}' is not a recognized Federal Register document type` };
  }
  return { ok: true, value: v as FederalRegisterDocumentType };
}

function expectString(
  r: Record<string, unknown>,
  key: string,
):
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly error: string } {
  const v = r[key];
  if (typeof v !== "string") {
    return { ok: false, error: `${key} is missing or not a string` };
  }
  return { ok: true, value: v };
}

function expectAgencies(
  r: Record<string, unknown>,
):
  | { readonly ok: true; readonly value: readonly string[] }
  | { readonly ok: false; readonly error: string } {
  const v = r["agencies"];
  if (!Array.isArray(v)) {
    return { ok: false, error: "agencies is missing or not an array" };
  }
  const slugs: string[] = [];
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    if (typeof a === "string") {
      slugs.push(a);
      continue;
    }
    // The FR API returns agencies as either strings or {slug, ...} objects
    // depending on the endpoint. Accept both shapes.
    if (isPlainObject(a)) {
      const slug = (a as Record<string, unknown>)["slug"];
      if (typeof slug === "string") {
        slugs.push(slug);
        continue;
      }
    }
    return { ok: false, error: `agencies[${i}] is neither string nor {slug}` };
  }
  return { ok: true, value: slugs };
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Stable content hash for change detection. Sorts by document_number
 * before hashing so reordering by the API doesn't produce a spurious
 * "change." Hashes only the identity-relevant subset of fields — title
 * edits at the API source are real changes worth surfacing.
 */
export function hashDocuments(
  documents: readonly FederalRegisterDocument[],
): string {
  const sorted = [...documents].sort((a, b) =>
    a.document_number.localeCompare(b.document_number),
  );
  const canonical = sorted.map((d) => ({
    document_number: d.document_number,
    title: d.title,
    type: d.type,
    publication_date: d.publication_date,
    effective_on: d.effective_on,
    html_url: d.html_url,
    agencies: [...d.agencies].sort(),
  }));
  return createHash("sha256").update(JSON.stringify(canonical), "utf8").digest("hex");
}

/**
 * Parse a Retry-After header. The Federal Register API uses delta-seconds;
 * we also accept HTTP-date format for robustness.
 */
export function parseRetryAfter(header: string | null): number | undefined {
  if (header === null || header === "") return undefined;
  const asNum = Number(header);
  if (Number.isFinite(asNum)) {
    // If the header parses cleanly as a number we treat it as delta-seconds
    // and don't fall through to Date.parse (Date.parse("-1") returns a valid
    // year-1 timestamp on some platforms, which would silently turn a
    // malformed header into a clamped 0).
    if (asNum < 0) return undefined;
    return Math.round(asNum * 1000);
  }
  const asDate = Date.parse(header);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return undefined;
}

async function safeReadText(response: Awaited<ReturnType<FetchLike>>): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
