// Findings ledger loader — partner-facing route under /findings.
//
// Reads docs/findings/*.md (the canonical evidence-backed claims; see
// docs/findings/README.md for the schema) at build time and exposes a
// typed, sorted view to the App Router pages.
//
// File-system reads happen at module load and are cached in-process for
// the lifetime of the Next.js build / server. Findings rarely change, so
// this is fine; if a finding is added or edited, the next `pnpm build`
// or `revalidate` boundary picks it up.
//
// Server-only — never imported into a Client Component. The `server-only`
// import enforces this at build time.

import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { normalizeFindingDate } from "./findings-date";

// ---------------------------------------------------------------------------
// Types — match the YAML frontmatter schema in docs/findings/README.md.
// ---------------------------------------------------------------------------

export type FindingStatus = "active" | "superseded" | "retracted";
export type FindingConfidence = "high" | "medium" | "low" | "unknown";

export type EvidenceKind =
  | "git"
  | "file"
  | "pr"
  | "url"
  | "dataset"
  | "memory"
  | "external"
  | string; // tolerate unknown kinds without breaking the build

export interface Evidence {
  kind: EvidenceKind;
  ref: string;
  line?: number;
  note?: string;
}

export interface Finding {
  id: string; // slug, must match filename stem
  date: string; // ISO YYYY-MM-DD
  scope: string[];
  confidence: FindingConfidence;
  status: FindingStatus;
  supersedes: string[];
  supersededBy: string[];
  evidence: Evidence[];
  body: string; // raw markdown (not HTML — rendered by react-markdown)
  links: string[]; // [[other-id]] backlinks parsed from body
  filename: string; // e.g. "2026-05-28-test-prefix-empty.md"
}

// ---------------------------------------------------------------------------
// Path resolution — docs/findings/ lives at the monorepo root.
//
// At build time, process.cwd() can be either the repo root (when invoked
// via `pnpm --filter @civica/dashboard build`) or the dashboard directory
// itself (when invoked as `cd apps/dashboard && pnpm build`). Try both.
// ---------------------------------------------------------------------------

const FINDINGS_DIR_CANDIDATES = [
  path.resolve(process.cwd(), "docs/findings"),
  path.resolve(process.cwd(), "../../docs/findings"),
  // Last-resort: walk up from this module looking for the repo root.
  path.resolve(__dirname, "../../../../docs/findings"),
];

function resolveFindingsDir(): string {
  for (const candidate of FINDINGS_DIR_CANDIDATES) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  // Surface a clear build-time error rather than silent emptiness.
  throw new Error(
    `Findings directory not found. Tried: ${FINDINGS_DIR_CANDIDATES.join(", ")}\n` +
      `Run from the monorepo root, or ensure docs/findings/ exists.`,
  );
}

const FINDINGS_DIR = resolveFindingsDir();
const LINK_RE = /\[\[([a-z0-9-]+)\]\]/g;
const NON_FINDING_FILES = new Set(["README.md", "INDEX.md", "_template.md"]);

// ---------------------------------------------------------------------------
// In-process cache. Findings ledger is small (< 100 files realistically),
// fits in memory cheaply, and never changes mid-request.
// ---------------------------------------------------------------------------

let FINDINGS_CACHE: Finding[] | null = null;

function parseFinding(filename: string): Finding | null {
  const filePath = path.join(FINDINGS_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;

  const id = typeof data.id === "string" ? data.id : "";
  if (!id) {
    // Skip findings without an explicit id — these are bugs we want to
    // surface during build (warning to stderr) but not crash the build.
    console.warn(`[findings] skip: ${filename} — missing 'id' frontmatter`);
    return null;
  }

  const body = parsed.content;
  const links = Array.from(
    new Set(Array.from(body.matchAll(LINK_RE)).map((m) => m[1])),
  );

  const toStringArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.map(String);
    if (typeof v === "string") return [v];
    return [];
  };

  return {
    id,
    date: normalizeFindingDate(data.date),
    scope: toStringArray(data.scope),
    confidence: (data.confidence as FindingConfidence) ?? "unknown",
    status: (data.status as FindingStatus) ?? "active",
    supersedes: toStringArray(data.supersedes),
    supersededBy: toStringArray(data.superseded_by),
    evidence: Array.isArray(data.evidence)
      ? (data.evidence as Record<string, unknown>[])
          .filter((e) => e && typeof e === "object")
          .map((e) => ({
            kind: typeof e.kind === "string" ? e.kind : "unknown",
            ref: typeof e.ref === "string" ? e.ref : String(e.ref ?? ""),
            line: typeof e.line === "number" ? e.line : undefined,
            note: typeof e.note === "string" ? e.note : undefined,
          }))
      : [],
    body,
    links,
    filename,
  };
}

function loadAll(): Finding[] {
  if (FINDINGS_CACHE !== null) return FINDINGS_CACHE;

  const files = fs
    .readdirSync(FINDINGS_DIR)
    .filter((f) => f.endsWith(".md") && !NON_FINDING_FILES.has(f));

  const findings: Finding[] = [];
  for (const file of files) {
    const f = parseFinding(file);
    if (f) findings.push(f);
  }

  // Newest first. Date-then-id keeps ordering stable across days.
  findings.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.id.localeCompare(b.id);
  });

  FINDINGS_CACHE = findings;
  return findings;
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/** All findings, including superseded + retracted. Sorted newest first. */
export function getAllFindings(): Finding[] {
  return loadAll();
}

/** Only active findings — what the index page shows by default. */
export function getActiveFindings(): Finding[] {
  return loadAll().filter((f) => f.status === "active");
}

/** Lookup by id (filename stem). Returns null if missing. */
export function getFinding(id: string): Finding | null {
  return loadAll().find((f) => f.id === id) ?? null;
}

/** For generateStaticParams(): every finding id (including superseded). */
export function listFindingIds(): string[] {
  return loadAll().map((f) => f.id);
}

/** Findings grouped by YYYY-MM month for the index page. Active only. */
export function getFindingsByMonth(): { month: string; findings: Finding[] }[] {
  const active = getActiveFindings();
  const byMonth = new Map<string, Finding[]>();
  for (const f of active) {
    const month = f.date.slice(0, 7); // YYYY-MM
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(f);
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, findings]) => ({ month, findings }));
}

/** Findings that link TO this one (incoming backlinks). */
export function getIncomingLinks(targetId: string): Finding[] {
  return loadAll().filter((f) => f.links.includes(targetId));
}

/** First non-empty paragraph of the body — for index hooks + OG descriptions. */
export function getFindingHook(f: Finding, maxLen = 200): string {
  // Skip frontmatter (already stripped by gray-matter), skip markdown
  // headings, take the first prose paragraph.
  const paragraphs = f.body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("#") && !p.startsWith("```"));
  const first = paragraphs[0] ?? "";
  if (first.length <= maxLen) return first;
  // Cut at word boundary near the limit.
  const cut = first.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}
