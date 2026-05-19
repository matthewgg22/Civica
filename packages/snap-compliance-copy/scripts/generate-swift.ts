import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BannedPhrasesFileSchema,
  PendingRevisionsFileSchema,
  type BannedPhrase,
  type PendingCopyRevision,
} from "../src/schemas";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = resolve(__dirname, "..");
const repoRoot = resolve(packageRoot, "..", "..");

const DATA_DIR = resolve(packageRoot, "data");
const DEFAULT_OUT = resolve(
  repoRoot,
  "Civica/Features/SNAP/Generated/SNAPComplianceCopyRegistry+Generated.swift",
);

const HEADER = `// SNAPComplianceCopyRegistry+Generated.swift
//
// AUTO-GENERATED — DO NOT EDIT.
// Regenerate with: pnpm --filter @civica/snap-compliance-copy generate:swift
// Source of truth: packages/snap-compliance-copy/data/
//
// Parity contract (T6): the symbols and string values emitted here must
// match the hand-authored SNAPComplianceCopyRegistry.swift byte-for-byte
// at the value level (whitespace and comments are normalised). The
// parity test in packages/snap-compliance-copy/test/parity.test.ts
// asserts this; CI re-runs the generator and \`git diff --exit-code\`
// catches drift.

import Foundation

`;

// Swift double-quoted string escaping that matches the source literals
// in SNAPComplianceCopyRegistry.swift today (backslash, double quote,
// newline, carriage return, tab). Em-dashes and other Unicode pass
// through unchanged, as they did in the original.
function escapeSwift(s: string): string {
  let out = "";
  for (const ch of s) {
    switch (ch) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      default:
        out += ch;
    }
  }
  return out;
}

function quote(s: string): string {
  return `"${escapeSwift(s)}"`;
}

function quoteOpt(s: string | null): string {
  return s === null ? "nil" : quote(s);
}

function renderBannedPhrase(p: BannedPhrase): string {
  return [
    "        BannedPhrase(",
    `            id: ${quote(p.id)},`,
    `            phrase: ${quote(p.phrase)},`,
    `            auditReference: ${quote(p.audit_reference)},`,
    `            rationale: ${quote(p.rationale)}`,
    "        )",
  ].join("\n");
}

function renderStatus(s: "pending_signoff" | "approved"): string {
  return s === "approved" ? ".approved" : ".pendingSignoff";
}

function renderRevision(r: PendingCopyRevision): string {
  return [
    "        PendingCopyRevision(",
    `            id: ${quote(r.id)},`,
    `            surfaceFile: ${quote(r.surface_file)},`,
    `            stringID: ${quote(r.string_id)},`,
    `            currentEnglish: ${quote(r.current_english)},`,
    `            approvedEnglish: ${quoteOpt(r.approved_english)},`,
    `            approvedSpanish: ${quoteOpt(r.approved_spanish)},`,
    `            auditReference: ${quote(r.audit_reference)},`,
    `            rationale: ${quote(r.rationale)},`,
    `            status: ${renderStatus(r.status)}`,
    "        )",
  ].join("\n");
}

export function renderSwift(
  banned: BannedPhrase[],
  revisions: PendingCopyRevision[],
): string {
  const bannedBody = banned.map(renderBannedPhrase).join(",\n");
  const revisionsBody = revisions.map(renderRevision).join(",\n");

  return (
    HEADER +
    `extension SNAPComplianceCopyRegistry {

    static let bannedPhrasesGenerated: [BannedPhrase] = [
${bannedBody}
    ]

    static let pendingCopyRevisionsGenerated: [PendingCopyRevision] = [
${revisionsBody}
    ]
}
`
  );
}

export function loadData(): {
  banned: BannedPhrase[];
  revisions: PendingCopyRevision[];
} {
  const bannedRaw = JSON.parse(
    readFileSync(resolve(DATA_DIR, "_banned-phrases.json"), "utf8"),
  );
  const revisionsRaw = JSON.parse(
    readFileSync(resolve(DATA_DIR, "_pending-revisions.json"), "utf8"),
  );
  const banned = BannedPhrasesFileSchema.parse(bannedRaw).entries;
  const revisions = PendingRevisionsFileSchema.parse(revisionsRaw).entries;
  return { banned, revisions };
}

export function generate(outPath: string = DEFAULT_OUT): string {
  const { banned, revisions } = loadData();
  const swift = renderSwift(banned, revisions);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, swift, "utf8");
  return swift;
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const out = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : DEFAULT_OUT;
  const swift = generate(out);
  process.stderr.write(
    `wrote ${swift.length} bytes to ${out}\n`,
  );
}
