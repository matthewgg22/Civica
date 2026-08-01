// Inference-time citation verifier.
//
// Mae's answers carry legal citations; crisp citations make an answer LOOK
// authoritative whether or not it's correct ("authority laundering"). This
// checks every citation Mae emits against what we actually gave it and what we
// recognize, and surfaces the result to the caseworker — it does NOT silently
// edit the answer (honesty: show the check, don't hide the doubt).
//
// Three tiers:
//   in_sources   — backed by the verbatim text retrieved for THIS question
//                  (strongest; the model had the words in front of it).
//   known        — a recognized authority (a corpus section, a cited CA ACL/ACIN,
//                  a statute, or a curated cross-title cite) but NOT in the text
//                  retrieved for this question — plausible, confirm against source.
//   unrecognized — neither. Likely invented or mistyped → flag loudly.

import corpusJson from "./corpus/ecfr-snap.json";

export type CitationStatus = "in_sources" | "known" | "unrecognized";
export interface CitationCheck {
  citation: string; // display form, e.g. "7 CFR 273.9(d)(2)"
  status: CitationStatus;
}

// Every citation in the vendored corpus at subsection granularity, e.g.
// "7 CFR 273.9(d)(2)". Checked by LINEAGE (not just section), so an invented
// subsection of a real section — "7 CFR 273.9(z)(99)" — is caught as
// unrecognized rather than passed off as "known".
const CORPUS_CITATIONS: string[] = (
  corpusJson as { chunks: { citation: string }[] }
).chunks.map((c) => c.citation);

// Authorities Mae is legitimately allowed to cite from its authority map / curated
// notes even when they aren't in a given request's retrieved text. Keep in sync
// with engine-citations.ts + retrieval.ts curated authorities.
const KNOWN_EXTRA: Set<string> = new Set([
  "8 CFR 212.21",
  "8 CFR 212.22",
  "7 CFR 271.2",
  "7 CFR 274",
  "ACL 25-68",
  "ACL 25-93",
  "ACIN I-46-25",
  // Verification-limits cluster — the authorities CDSS Management Evaluation reviewers
  // actually cite when marking over-verification errors (FOIA 2026-07-23 ME corpus).
  // NOTE: ACL 21-58 was previously listed here as "the" over-verification authority; the
  // ME corpus shows it appearing once, on a STUDENT-EXEMPTION finding — it is kept below
  // under its real subject, not as the verification cite.
  "ACL 20-48", // verification limits; last-30-days income window
  "ACL 21-24", // don't limit the household to one verification type
  "ACIN I-45-11", // verification standards
  "ACL 23-53", // The Work Number — confirm with household before use
  "ACL 16-14", // expedited service
  "ACL 14-20", // interview contact attempts
  "ACL 17-80", // interview method preference
  "ACL 20-135", // student exemptions / verification limits
  "ACL 21-58", // student eligibility exemptions must be explored
  "ACL 22-74", // consolidated work-rules notice (CF 886) + oral explanation
  "ACIN I-33-21", // NOA reason accuracy
  "ACIN I-14-11", // expedited service
  "PUB L 119-21", // OBBBA / H.R.1
  "OBBBA",
  "FNA", // Food and Nutrition Act
]);

// California Manual of Policies and Procedures sections Mae may legitimately cite.
// Matched at SECTION granularity (e.g. "MPP 63-300.5(j)" → "MPP 63-300").
const KNOWN_MPP: Set<string> = new Set([
  "MPP 63-300", // application / verification — the most-cited authority in the ME corpus
  "MPP 63-301", // eligibility determinations
  "MPP 63-402", // authorized representatives
  "MPP 63-407", // work registration
  "MPP 63-410", // ABAWD
  "MPP 63-502", // issuance
  "MPP 63-503", // issuance / BDA
  "MPP 63-504", // notices of action / denial timing
  "MPP 63-508", // SAR 7 / NA 960X
  "MPP 63-201", // office access
  "MPP 63-202", // language access
  "MPP 20-006", // IEVS
  "MPP 19-002", // identity / PII confirmation
  "MPP 21-115", // written-language preference
  "MPP 11-601", // drop boxes
]);

// FNS handbooks Mae may legitimately cite. 310 = QC Review (the negative-action
// validity standard + the FNS-380 element codes); 311 = QC Sampling.
const KNOWN_HANDBOOKS: Set<string> = new Set(["310", "311"]);

const CFR_RE = /\b(\d+)\s*CFR\s*(\d+\.\d+(?:\([a-z0-9]+\))*)/gi;
const ACL_RE = /\bAC(L|IN)\s+([A-Z]?-?\d{1,3}-\d{2,3})/gi;
// CDSS Manual of Policies and Procedures, e.g. "MPP 63-300", "MPP 63-300.5(j)".
const MPP_RE = /\bMPP\s+(\d{2}-\d{3}(?:\.\d+)?(?:\([a-z0-9]+\))*)/gi;
// FNS Handbook 310 (QC Review) / 311 (QC Sampling), optionally with a section:
// "FNS Handbook 310", "FNS Handbook 310 §1350.2". Matched at HANDBOOK
// granularity — the section is captured for display but not separately verified.
const HANDBOOK_RE = /\bFNS\s+Handbook\s+(3\d{2})(?:\s*(?:§|section)\s*([\d.]+))?/gi;
const STATUTE_RE = /\b(Pub\.?\s*L\.?\s*(?:No\.?\s*)?119-21|P\.?L\.?\s*119-21|OBBBA|Food and Nutrition Act|\bFNA\b)/gi;

/** Two citations share a subsection lineage if one contains the other — Mae may
 *  cite a parent ("273.9(d)") or a deeper child ("273.10(e)(2)(ii)(A)") of a
 *  known/retrieved citation. */
function lineage(a: string, b: string): boolean {
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/** Extract the distinct citations Mae wrote, in display form. */
export function extractCitations(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(CFR_RE)) out.add(`${m[1]} CFR ${m[2]}`);
  for (const m of text.matchAll(ACL_RE)) out.add(`AC${m[1].toUpperCase()} ${m[2].toUpperCase()}`);
  for (const m of text.matchAll(MPP_RE)) out.add(`MPP ${m[1]}`);
  for (const m of text.matchAll(HANDBOOK_RE)) {
    out.add(m[2] ? `FNS Handbook ${m[1]} §${m[2]}` : `FNS Handbook ${m[1]}`);
  }
  for (const m of text.matchAll(STATUTE_RE)) {
    const t = m[0].toUpperCase();
    if (t.includes("119-21") || t.includes("OBBBA")) out.add("Pub. L. 119-21");
    else out.add("Food and Nutrition Act");
  }
  return [...out];
}

function statuteKey(display: string): string {
  return display.toUpperCase().includes("119-21") ? "PUB L 119-21" : "FNA";
}

/** Classify each citation in the answer against this request's retrieved sources. */
export function verifyCitations(answer: string, retrievedCitations: string[]): CitationCheck[] {
  return extractCitations(answer).map((citation) => {
    if (/CFR/i.test(citation)) {
      const title = citation.split(" ")[0];
      const sectionWithTitle = `${title} CFR ${citation.split("CFR ")[1].split("(")[0]}`;
      if (retrievedCitations.some((r) => lineage(citation, r))) {
        return { citation, status: "in_sources" as const };
      }
      if (CORPUS_CITATIONS.some((c) => lineage(citation, c)) || KNOWN_EXTRA.has(sectionWithTitle)) {
        return { citation, status: "known" as const };
      }
      return { citation, status: "unrecognized" as const };
    }
    if (/^AC/i.test(citation)) {
      return { citation, status: KNOWN_EXTRA.has(citation) ? "known" : "unrecognized" };
    }
    if (/^FNS Handbook/i.test(citation)) {
      const num = citation.match(/(3\d{2})/)?.[1] ?? "";
      return { citation, status: KNOWN_HANDBOOKS.has(num) ? "known" : "unrecognized" };
    }
    if (/^MPP/i.test(citation)) {
      // Match at section granularity so "MPP 63-300.5(j)" resolves to "MPP 63-300".
      const section = `MPP ${citation.split(/\s+/)[1].split(/[.(]/)[0]}`;
      return { citation, status: KNOWN_MPP.has(section) ? "known" : "unrecognized" };
    }
    // statute
    return { citation, status: KNOWN_EXTRA.has(statuteKey(citation)) ? "known" : "unrecognized" };
  });
}

/** Render a transparency trailer for the caseworker. Empty if no citations. */
export function formatCitationTrailer(checks: CitationCheck[]): string {
  if (checks.length === 0) return "";
  const inSrc = checks.filter((c) => c.status === "in_sources").map((c) => c.citation);
  const known = checks.filter((c) => c.status === "known").map((c) => c.citation);
  const bad = checks.filter((c) => c.status === "unrecognized").map((c) => c.citation);

  const lines: string[] = ["\n\n---", "**Citation:**"];
  if (bad.length) {
    lines.push(`- ⚠️ **NOT recognized — likely an error, verify before relying:** ${bad.join(", ")}`);
  }
  if (inSrc.length) lines.push(`- ✓ regulatory text retrieved for this question: ${inSrc.join(", ")}`);
  if (known.length) {
    lines.push(`- ◑ recognized authority, but not in the retrieved text — confirm against source: ${known.join(", ")}`);
  }
  return lines.join("\n");
}
