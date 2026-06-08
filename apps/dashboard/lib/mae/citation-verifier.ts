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
  "PUB L 119-21", // OBBBA / H.R.1
  "OBBBA",
  "FNA", // Food and Nutrition Act
]);

const CFR_RE = /\b(\d+)\s*CFR\s*(\d+\.\d+(?:\([a-z0-9]+\))*)/gi;
const ACL_RE = /\bAC(L|IN)\s+([A-Z]?-?\d{1,3}-\d{2,3})/gi;
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
