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
//   known        — a recognized authority (a corpus section, a state policy
//                  instrument from the active state pack, a statute, or a curated
//                  cross-title cite) but NOT in the text retrieved for this
//                  question — plausible, confirm against source.
//   unrecognized — neither. Likely invented or mistyped → flag loudly.

import corpusJson from "./corpus/ecfr-snap.json";
import type { AnswerLang } from "./lang";
import { getStatePack, type CompiledAuthorityPattern } from "./states";

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

// FEDERAL authorities Mae is legitimately allowed to cite from its authority
// map / curated notes even when they aren't in a given request's retrieved
// text. State policy instruments (CA's ACL/ACIN/MPP, and their analogs in
// future states) live in each state pack's authorities.json — the ME-corpus
// citation-frequency lineage for CA is recorded in states/ca/PROVENANCE.md.
const KNOWN_EXTRA: Set<string> = new Set([
  "8 CFR 212.21",
  "8 CFR 212.22",
  "7 CFR 271.2",
  "7 CFR 274",
  "PUB L 119-21", // OBBBA / H.R.1
  "OBBBA",
  "FNA", // Food and Nutrition Act
]);

// FNS handbooks Mae may legitimately cite. 310 = QC Review (the negative-action
// validity standard + the FNS-380 element codes); 311 = QC Sampling.
const KNOWN_HANDBOOKS: Set<string> = new Set(["310", "311"]);

const CFR_RE = /\b(\d+)\s*CFR\s*(\d+\.\d+(?:\([a-z0-9]+\))*)/gi;
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

/** Render a pack authority-pattern match in display form ("AC$1 $2" → "ACL 25-68"). */
function applyTemplate(template: string, m: RegExpMatchArray, normalize: "upper" | "none"): string {
  return template.replace(/\$(\d)/g, (_, n) => {
    const g = m[Number(n)] ?? "";
    return normalize === "upper" ? g.toUpperCase() : g;
  });
}

/** Extract the distinct citations Mae wrote, in display form.
 *  Federal patterns (CFR, FNS handbooks, statute) always apply; the state
 *  pack's authority patterns (e.g. CA's ACL/ACIN and MPP) apply per state. */
export function extractCitations(text: string, state?: string | null): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(CFR_RE)) out.add(`${m[1]} CFR ${m[2]}`);
  for (const p of getStatePack(state)?.authorities ?? []) {
    for (const m of text.matchAll(p.compiled)) out.add(applyTemplate(p.template, m, p.normalize));
  }
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

/** Status of a displayed citation under one pack authority pattern. */
function packAuthorityStatus(citation: string, p: CompiledAuthorityPattern): CitationStatus {
  if (p.match === "second-word-base") {
    // Section granularity: "MPP 63-300.5(j)" → check "MPP 63-300".
    const words = citation.split(/\s+/);
    const base = `${words[0]} ${(words[1] ?? "").split(/[.(]/)[0]}`;
    return p.known.has(base) ? "known" : "unrecognized";
  }
  return p.known.has(citation) ? "known" : "unrecognized";
}

/** Classify each citation in the answer against this request's retrieved sources. */
export function verifyCitations(
  answer: string,
  retrievedCitations: string[],
  state?: string | null,
  /** The retrieved source TEXT. Regulations cross-reference each other, and a
   *  citation the retrieved text ITSELF quotes is a real authority the model
   *  read there — not an invention.
   *
   *  This is the bug it fixes, from production: asked "four people in my
   *  household; I make 4 k a month and im in boston", the answer cited
   *  45 CFR 260.31 — which appears verbatim inside 7 CFR 273.8(e)(19)
   *  ("as defined by 45 CFR 260.31 (a)(1) and (a)(2)"). 45 CFR is not SNAP
   *  corpus, so it scored `unrecognized`, the draft was rejected, the retry was
   *  rejected, and the turn degraded. The model had done exactly the right
   *  thing: cited what its source cited.
   *
   *  `known`, deliberately, not `in_sources` — the trailer renders that as
   *  "recognized authority, but not in the retrieved text; confirm against
   *  source", which is precisely the right thing to tell a reader about a
   *  cross-reference we did not retrieve and cannot vouch for. */
  retrievedText?: string,
): CitationCheck[] {
  const packPatterns = getStatePack(state)?.authorities ?? [];
  const haystack = retrievedText ?? "";
  /** Quoted by the sources we actually put in front of the model. */
  const crossReferenced = (citation: string): boolean => {
    if (!haystack) return false;
    // Normalise spacing only — never a fuzzy match. "45 CFR 260.31" must be
    // present as such for this to fire.
    const needle = citation.replace(/\s+/g, " ").trim();
    if (needle.length < 8) return false;
    return haystack.replace(/\s+/g, " ").includes(needle);
  };
  return extractCitations(answer, state).map((citation) => {
    if (/CFR/i.test(citation)) {
      const title = citation.split(" ")[0];
      const sectionWithTitle = `${title} CFR ${(citation.split("CFR ")[1] ?? "").split("(")[0]}`;
      if (retrievedCitations.some((r) => lineage(citation, r))) {
        return { citation, status: "in_sources" as const };
      }
      if (CORPUS_CITATIONS.some((c) => lineage(citation, c)) || KNOWN_EXTRA.has(sectionWithTitle)) {
        return { citation, status: "known" as const };
      }
      if (crossReferenced(citation)) return { citation, status: "known" as const };
      return { citation, status: "unrecognized" as const };
    }
    if (/^FNS Handbook/i.test(citation)) {
      const num = citation.match(/(3\d{2})/)?.[1] ?? "";
      return { citation, status: KNOWN_HANDBOOKS.has(num) ? "known" : "unrecognized" };
    }
    for (const p of packPatterns) {
      // Non-global probe: a shared global regex would carry lastIndex state.
      const probe = new RegExp(p.regex, p.flags.replace("g", ""));
      if (probe.test(citation)) return { citation, status: packAuthorityStatus(citation, p) };
    }
    // statute
    return { citation, status: KNOWN_EXTRA.has(statuteKey(citation)) ? "known" : "unrecognized" };
  });
}

const TRAILER_STRINGS = {
  en: {
    header: "**Citation:**",
    bad: "⚠️ **NOT recognized — likely an error, verify before relying:**",
    inSrc: "✓ regulatory text retrieved for this question:",
    known: "◑ recognized authority, but not in the retrieved text — confirm against source:",
  },
  es: {
    header: "**Citas:**",
    bad: "⚠️ **NO reconocida — probablemente un error, verifica antes de confiar:**",
    inSrc: "✓ texto regulatorio recuperado para esta pregunta:",
    known: "◑ autoridad reconocida, pero no está en el texto recuperado — confirma contra la fuente:",
  },
  vi: {
    header: "**Trích dẫn:**",
    bad: "⚠️ **KHÔNG nhận dạng được — có thể là lỗi, hãy xác minh trước khi dựa vào:**",
    inSrc: "✓ văn bản quy định đã truy xuất cho câu hỏi này:",
    known: "◑ văn bản có thật, nhưng không nằm trong nội dung đã truy xuất — hãy đối chiếu với nguồn:",
  },
  zh: {
    header: "**引用：**",
    bad: "⚠️ **无法识别——可能有误，依赖前请先核实：**",
    inSrc: "✓ 为此问题检索到的法规原文：",
    known: "◑ 已知的法规依据，但不在检索到的原文中——请与来源核对：",
  },
} as const;

/** Render a transparency trailer for the caseworker. Empty if no citations. */
export function formatCitationTrailer(checks: CitationCheck[], lang: AnswerLang = "en"): string {
  if (checks.length === 0) return "";
  const t = TRAILER_STRINGS[lang];
  const inSrc = checks.filter((c) => c.status === "in_sources").map((c) => c.citation);
  const known = checks.filter((c) => c.status === "known").map((c) => c.citation);
  const bad = checks.filter((c) => c.status === "unrecognized").map((c) => c.citation);

  const lines: string[] = ["\n\n---", t.header];
  if (bad.length) lines.push(`- ${t.bad} ${bad.join(", ")}`);
  if (inSrc.length) lines.push(`- ${t.inSrc} ${inSrc.join(", ")}`);
  if (known.length) lines.push(`- ${t.known} ${known.join(", ")}`);
  return lines.join("\n");
}
