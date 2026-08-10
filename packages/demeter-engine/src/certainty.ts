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
import type { AnswerLang } from "./lang";

/** "not_applicable" = the answer makes no citation claim to verify, so neither
 *  verdict fits and no banner is shown. See assessCertainty (#685). */
export type CertaintyLevel = "certain" | "uncertain" | "not_applicable";

export interface CertaintyVerdict {
  level: CertaintyLevel;
  /** Machine-readable cause, for analytics and the 97% metric. */
  code:
    | "grounded"
    | "unrecognized_citation"
    | "degraded_to_sources"
    | "authority_not_retrieved"
    | "state_not_verified"
    | "no_claim_to_verify";
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
  vi: {
    certain:
      "Mọi quy định được trích dẫn ở đây đều lấy từ văn bản quy định được truy xuất cho câu hỏi của bạn — hãy tự kiểm tra bên dưới.",
    unrecognized:
      "Câu trả lời này trích dẫn một nguồn chúng tôi không đối chiếu được. Hãy coi là chưa được xác minh và xác nhận với cơ quan SNAP của bạn trước khi dựa vào nó.",
    degraded:
      "Chúng tôi không xác minh được phần tóm tắt, nên chúng tôi trích nguyên văn nguồn thay vì diễn giải lại.",
    notRetrieved:
      "Đây là những căn cứ có thật, nhưng chúng tôi không có nội dung của chúng cho câu hỏi này — nên xác nhận tại nguồn.",
    stateUnverified:
      "Đây là mức cơ bản của liên bang. Quy định riêng của tiểu bang bạn có thể khác, và chúng tôi chưa xác minh chính sách của tiểu bang đó.",
    labelCertain: "CHẮC CHẮN",
    labelUncertain: "CHƯA CHẮC",
    checkHeading: "Tự kiểm tra",
  },
  zh: {
    certain:
      "这里引用的每条规定都来自为您的问题检索到的法规原文——请在下方自行核对。",
    unrecognized:
      "此回答引用了我们无法核对的来源。请视为未经证实，在依赖它之前先与您所在州的 SNAP 机构确认。",
    degraded:
      "我们无法核实摘要内容，因此直接引用来源原文，而不做转述。",
    notRetrieved:
      "这些是真实的法规依据，但我们没有针对此问题调取其原文——建议到来源处确认。",
    stateUnverified:
      "这是联邦最低标准。您所在州的规定可能不同，我们尚未核实该州的政策。",
    labelCertain: "确定",
    labelUncertain: "不确定",
    checkHeading: "自行核对",
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
export function assessCertainty(input: CertaintyInput, lang: AnswerLang = "en"): CertaintyVerdict {
  const t = COPY[lang];
  const bad = input.checks.filter((c) => c.status === "unrecognized").map((c) => c.citation);
  const inSources = input.checks.filter((c) => c.status === "in_sources").map((c) => c.citation);
  const known = input.checks.filter((c) => c.status === "known").map((c) => c.citation);
  const all = [...inSources, ...known, ...bad];

  // NO CITATIONS AT ALL — nothing for this verdict to speak to (#685).
  //
  // A correct off-scope refusal, a PII deflection, or a distress reply that
  // leads with emergency food help cites nothing, because there is no
  // authority to cite when you are declining to answer. Those answers used to
  // fall through to authority_not_retrieved, whose copy — "These are real
  // authorities, but we did not have their text in front of us" — is not merely
  // unhelpful there but FALSE: there are no authorities. Measured on the gold
  // set (#602 run 2026-08-10), all 7 uncertain answers were exactly these
  // cases, so the entire uncertain rate was this bug rather than a retrieval
  // problem.
  //
  // Hedging a correct refusal inverts the signal on the responses we are most
  // sure about, teaches readers to ignore the banner everywhere, and — worst —
  // stamps "we can't be certain" on a reply to someone whose benefits were
  // just cut. This check runs FIRST because it is a statement about the shape
  // of the answer, not a competing quality signal.
  //
  // RESIDUAL RISK, stated plainly: an answer that asserts policy with no
  // citations at all is also silenced here. The pipeline is built so that
  // shouldn't happen — the prompt requires citations for policy claims — but
  // if it does, this hides a warning rather than raising one. That is the
  // trade for not hedging every refusal; worth revisiting if such answers turn
  // up in mae_query_log with code no_claim_to_verify and real policy content.
  if (input.checks.length === 0) {
    return {
      level: "not_applicable",
      code: "no_claim_to_verify",
      reason: "",
      basis: [],
    };
  }

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
export function formatCertaintyBanner(v: CertaintyVerdict, lang: AnswerLang = "en"): string {
  // No claim, no banner. Returning "" rather than a third label keeps the
  // refusal reading as a plain answer — the reader is not asked to evaluate
  // the trustworthiness of a citation that was never made.
  if (v.level === "not_applicable") return "";
  const t = COPY[lang];
  const label = v.level === "certain" ? t.labelCertain : t.labelUncertain;
  const mark = v.level === "certain" ? "✓" : "⚠";
  const lines = [`\n\n---`, `${mark} **${label}** — ${v.reason}`];
  if (v.basis.length) {
    lines.push(`\n_${t.checkHeading}:_ ${v.basis.join(" · ")}`);
  }
  return lines.join("\n");
}
