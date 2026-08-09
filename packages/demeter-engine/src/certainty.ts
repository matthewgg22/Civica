// Answer certainty — one legible verdict, plus the rationale and the citations
// needed to double-check it.
//
// The pipeline already knows how much it trusts an answer: whether every
// citation was backed by regulation text actually retrieved for THIS question,
// whether the verifier had to recompose or fall back to quoting sources, and
// whether the question was scoped to a state we've adversarially verified. But
// it only ever expressed that as a "◑" in a footer, which no applicant reads
// and no funder can evaluate.
//
// This collapses those signals into CERTAIN / UNCERTAIN and says WHY, so a
// caseworker or applicant knows when to go check the source themselves. It is
// deliberately hard to earn CERTAIN: this is benefits information, and a
// confident wrong answer costs someone food.

import type { CitationCheck } from "./citation-verifier";

export type CertaintyLevel = "certain" | "uncertain";

export interface CertaintyVerdict {
  level: CertaintyLevel;
  /** Machine-readable cause, for analytics and the 97% metric. */
  code:
    | "grounded"
    | "unrecognized_citation"
    | "degraded_to_sources"
    | "authority_not_retrieved"
    | "state_not_verified";
  /** One sentence a non-expert can act on. */
  reason: string;
  /** The citations to double-check, most authoritative first. */
  basis: string[];
}

const COPY = {
  en: {
    certain:
      "Every rule cited here comes from regulation text pulled for your question — check it yourself below.",
    unrecognized:
      "This answer cited a source we could not match. Treat it as unverified and confirm with your SNAP agency before relying on it.",
    degraded:
      "We could not verify a summary of this, so we are quoting the source text directly rather than paraphrasing it.",
    notRetrieved:
      "These are real authorities, but we did not have their text in front of us for this question — worth confirming at the source.",
    stateUnverified:
      "This is the federal baseline. Your state's own rules may differ, and we have not verified that state's policy yet.",
    labelCertain: "CERTAIN",
    labelUncertain: "UNCERTAIN",
    checkHeading: "Check it yourself",
  },
  es: {
    certain:
      "Cada regla citada aquí proviene del texto regulatorio recuperado para tu pregunta — compruébalo tú mismo abajo.",
    unrecognized:
      "Esta respuesta citó una fuente que no pudimos verificar. Trátala como no verificada y confirma con tu agencia de SNAP antes de confiar en ella.",
    degraded:
      "No pudimos verificar un resumen de esto, así que estamos citando el texto fuente directamente en vez de parafrasearlo.",
    notRetrieved:
      "Estas son autoridades reales, pero no teníamos su texto a la vista para esta pregunta — conviene confirmarlo en la fuente.",
    stateUnverified:
      "Esta es la base federal. Las reglas de tu estado pueden diferir, y todavía no hemos verificado la política de ese estado.",
    labelCertain: "SEGURO",
    labelUncertain: "NO CONFIRMADO",
    checkHeading: "Compruébalo tú mismo",
  },
} as const;

export interface CertaintyInput {
  checks: CitationCheck[];
  /** "clean" | "recomposed" | "degraded" from the verifier ladder. */
  outcome: string;
  /** null = federal floor (always answerable); a code = state-scoped. */
  state: string | null | undefined;
  /** Whether `state` has an adversarially verified pack. */
  stateVerified: boolean;
}

/**
 * Collapse the pipeline's signals into a verdict.
 *
 * CERTAIN requires ALL of:
 *   - the verifier did not fall back to quoting sources (degrade = FAIL);
 *   - no citation went unrecognized;
 *   - at least one citation is backed by text retrieved for this question —
 *     "we recognize this authority" is not the same as "we read it";
 *   - the scope is answerable: the federal floor, or a verified state.
 *
 * A recomposed answer CAN be certain: its first draft failed the citation
 * check and was discarded before the reader saw it, and the replacement
 * cleared the same bar. That is the machinery working, not a weaker answer.
 */
export function assessCertainty(input: CertaintyInput, lang: "en" | "es" = "en"): CertaintyVerdict {
  const t = COPY[lang];
  const bad = input.checks.filter((c) => c.status === "unrecognized").map((c) => c.citation);
  const inSources = input.checks.filter((c) => c.status === "in_sources").map((c) => c.citation);
  const known = input.checks.filter((c) => c.status === "known").map((c) => c.citation);
  const all = [...inSources, ...known, ...bad];

  // Worst signal wins, in order of how badly it could mislead someone.
  if (bad.length) {
    return { level: "uncertain", code: "unrecognized_citation", reason: t.unrecognized, basis: bad };
  }
  if (input.outcome === "degraded") {
    return { level: "uncertain", code: "degraded_to_sources", reason: t.degraded, basis: all };
  }
  if (input.state && !input.stateVerified) {
    return { level: "uncertain", code: "state_not_verified", reason: t.stateUnverified, basis: all };
  }
  if (inSources.length === 0) {
    return { level: "uncertain", code: "authority_not_retrieved", reason: t.notRetrieved, basis: all };
  }
  return { level: "certain", code: "grounded", reason: t.certain, basis: [...inSources, ...known] };
}

/**
 * Render the verdict as the FIRST thing in the answer's trailer: a label, the
 * reason, and the citations to check. Deliberately plain — this has to read
 * the same to an applicant on a phone and to a program officer.
 */
export function formatCertaintyBanner(v: CertaintyVerdict, lang: "en" | "es" = "en"): string {
  const t = COPY[lang];
  const label = v.level === "certain" ? t.labelCertain : t.labelUncertain;
  const mark = v.level === "certain" ? "✓" : "⚠";
  const lines = [`\n\n---`, `${mark} **${label}** — ${v.reason}`];
  if (v.basis.length) {
    lines.push(`\n_${t.checkHeading}:_ ${v.basis.join(" · ")}`);
  }
  return lines.join("\n");
}
