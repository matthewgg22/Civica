// Retrieval recall over the gold set (#685) — DOES NOT CALL THE MODEL.
//
// The certainty rule requires that at least one citation in an answer be backed
// by text RETRIEVED for that question: "we recognize this authority" is not the
// same as "we read it". So an answer can be correct, correctly cited, and still
// shown to the reader as uncertain — because retrieval never surfaced the
// passage. The #602 sweep showed Sonnet and Opus landing 2.3 points apart on
// uncertain share while Haiku doubled it, which points at a retrieval floor no
// model choice removes.
//
// That floor is measurable WITHOUT generation. Retrieval is deterministic and
// entirely local (vendored embedding model + vendored corpus), so this probe
// costs nothing and can be run on every corpus or chunking change. Generation
// would only add noise and expense to a question the retriever answers alone.

import { buildMaeSystem } from "../answer";
import { ALL_GOLD } from "./answer-eval";

export interface RecallCase {
  id: string;
  question: string;
  state: string | null | undefined;
  /** The authority the gold case says the answer should cite. */
  expected: string;
  /** Did retrieval surface a chunk citing it? */
  retrieved: boolean;
  /** What retrieval actually returned, for eyeballing near-misses. */
  retrievedCitations: string[];
}

export interface RecallReport {
  cases: RecallCase[];
  /** Cases carrying an expectCitation — the only ones this can score. */
  scored: number;
  hits: number;
  recall: number;
  misses: RecallCase[];
}

/**
 * For every gold case that names an expected authority, ask whether retrieval
 * surfaced it for that question.
 *
 * Matching is SUBSTRING-based in both directions, deliberately generous: gold
 * writes "273.9(d)(6)" while a retrieved citation may read "7 CFR 273.9(d)(6)"
 * or "7 CFR 273.9". A strict equality check would report misses that are really
 * formatting differences, and inflate the problem we are trying to size.
 */
export async function runRetrievalRecall(): Promise<RecallReport> {
  const cases: RecallCase[] = [];

  for (const g of ALL_GOLD) {
    if (!g.expectCitation) continue; // nothing to score against
    const { retrievedCitations } = await buildMaeSystem(
      g.question,
      "staff",
      g.state === undefined ? undefined : g.state,
      g.lang ?? "en",
    );
    const want = g.expectCitation;
    const retrieved = retrievedCitations.some((c) => c.includes(want) || want.includes(c));
    cases.push({
      id: g.id,
      question: g.question,
      state: g.state,
      expected: want,
      retrieved,
      retrievedCitations,
    });
  }

  const hits = cases.filter((c) => c.retrieved).length;
  return {
    cases,
    scored: cases.length,
    hits,
    recall: cases.length === 0 ? 0 : hits / cases.length,
    misses: cases.filter((c) => !c.retrieved),
  };
}

export function formatRecall(r: RecallReport): string {
  const lines = [
    "",
    `  RETRIEVAL RECALL — ${r.hits}/${r.scored} expected authorities surfaced ` +
      `(${(r.recall * 100).toFixed(1)}%)`,
    "",
  ];
  if (r.misses.length) {
    lines.push("  MISSES — answer can still be right, but it will read as UNCERTAIN:");
    for (const m of r.misses) {
      lines.push(`    ✗ ${m.id}  wanted ${m.expected}  [state=${m.state ?? "federal"}]`);
      lines.push(`        q: ${m.question.slice(0, 96)}`);
      lines.push(
        `        got: ${m.retrievedCitations.slice(0, 6).join(", ") || "(nothing retrieved)"}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
