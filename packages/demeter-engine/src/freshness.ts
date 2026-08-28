// Freshness / expiry monitoring.
//
// Mae's grounding is a dated snapshot: the eCFR corpus is pinned to one issue
// date, the federal dollar figures are FY-bound (COLA renews Oct 1), and each
// state pack carries its own dated facts (e.g. CA's ABAWD waiver window). Those
// WILL go stale — the stale-ABAWD-age catch from the review is the canonical
// example. This surfaces an explicit "sources as of …" line on every answer and
// raises a warning when a source has passed its renewal date, so a caseworker is
// never silently relying on expired rules and the team has a signal to re-pull.
//
// Federal dates live here (one copy — framework §3 layering); state dates live
// in states/<code>/freshness.json and are merged per request.

import { getStatePack } from "./states";
import type { AnswerLang } from "./lang";

// Federal COLA figures (max allotment, deductions, income/asset limits, SUA)
// are FY26 — effective 2025-10-01 through this date. After it, getEngineParams
// must be on FY27 values or every dollar figure is wrong.
const FY_FIGURES_EXPIRE = "2026-09-30";

// eCFR is re-issued frequently; if our pinned snapshot is older than this,
// re-run build-ecfr-corpus.py to catch amendments (esp. OBBBA incorporation).
const CORPUS_MAX_AGE_DAYS = 120;

const DAY_MS = 86_400_000;

export interface Freshness {
  asOf: string;
  /** Safe to render under an answer: short, and about the READER's risk
   *  ("these amounts may be outdated"), never about our build chores. */
  readerWarnings: string[];
  /** Operator signals — re-run a script, re-verify a source, re-pull the
   *  corpus. These go to the server log, NEVER into an answer. #958 was
   *  exactly this line being crossed: Vermont's 809-character "re-verify the
   *  PER before citing" provenance note rendered verbatim under every VT
   *  answer, and six more entries were queued to join it on Oct 1. */
  operatorWarnings: string[];
}

/** Defensive bounds on what may reach a reader. A warning longer than this is
 *  an essay, and an answer wearing three of them is a warning label, not an
 *  answer. Operator warnings have no cap — logs can take it. */
const READER_WARNING_MAX_CHARS = 220;
const READER_WARNINGS_MAX = 2;

/** Assess source freshness for a given "now". Pure (date injected for tests). */
export function assessFreshness(now: Date, corpusDate: string, state?: string | null): Freshness {
  const readerWarnings: string[] = [];
  const operatorWarnings: string[] = [];
  const t = now.getTime();

  if (t > Date.parse(`${FY_FIGURES_EXPIRE}T23:59:59Z`)) {
    // BOTH audiences, DIFFERENT sentences. The reader's risk is "these
    // amounts may be wrong now"; the operator's job is "move the engine to
    // FY27". One sentence cannot serve both without leaking chores at the
    // reader, which is #958.
    readerWarnings.push(READER_STALE_FIGURES.en);
    operatorWarnings.push(
      "Federal FY26 figures expired Oct 1 — confirm the engine is on FY27 COLA values before quoting any dollar amount.",
    );
  }

  // State-pack dated facts. "expires" warns once now is PAST the date
  // (end-of-day); "not-yet-effective" warns while now is BEFORE it (start-of-day)
  // so a pre-launch answer doesn't state a future rule as live.
  //
  // OPERATOR BY DEFAULT. Pack freshness entries are research provenance —
  // "re-verify this against DCF before citing", "the mirror is stale", "this
  // figure is single-sourced" — written by the pack author to the pack's
  // maintainer. An entry only reaches a reader if it opts in with
  // `reader_facing: true`, and none does today.
  for (const e of getStatePack(state)?.freshness ?? []) {
    const fired =
      (e.kind === "expires" && t > Date.parse(`${e.date}T23:59:59Z`)) ||
      (e.kind === "not-yet-effective" && t < Date.parse(`${e.date}T00:00:00Z`));
    if (!fired) continue;
    if (e.reader_facing) {
      readerWarnings.push(
        e.warning.length > READER_WARNING_MAX_CHARS
          ? `${e.warning.slice(0, READER_WARNING_MAX_CHARS - 1)}…`
          : e.warning,
      );
    } else {
      operatorWarnings.push(e.warning);
    }
  }

  const ageDays = corpusDate ? Math.floor((t - Date.parse(`${corpusDate}T00:00:00Z`)) / DAY_MS) : NaN;
  if (Number.isFinite(ageDays) && ageDays > CORPUS_MAX_AGE_DAYS) {
    operatorWarnings.push(
      `The eCFR corpus is ${ageDays} days old — re-run build-ecfr-corpus.py to pick up amendments.`,
    );
  }

  // Terse on purpose: this sits at the foot of EVERY answer, so it is read far
  // more often than it is acted on. "federal figures FY26 (current through
  // 2026-09-30)" became "FY26 figures through 2026-09-30" — same two facts
  // (which fiscal year, when they lapse), fewer words competing with the answer.
  // PLAIN LANGUAGE, NOT A STAMP. This read "eCFR 2026-06-02 · FY26 figures
  // through 2026-09-30" — accurate, and shaped like a filename. Nobody outside
  // the team parses two ISO dates and a fiscal-year abbreviation, and the part
  // that actually builds trust (a named source, and how long the figures hold)
  // was the least legible part of it.
  //
  // The corpus fetch date is GONE from the visible line on purpose. It answers
  // "when did we last pull the regulations", which is our question, not the
  // reader's; when it matters, the staleness warning below fires and says so
  // in words.
  const asOf = "FY2026 figures, valid through Sept 30, 2026";
  return { asOf, readerWarnings: readerWarnings.slice(0, READER_WARNINGS_MAX), operatorWarnings };
}

/** The one warning a reader should see after the COLA rollover, in the
 *  reader's own language. Short on purpose: it repeats under every answer
 *  until the engine moves to FY27, so it has to wear well. */
const READER_STALE_FIGURES = {
  en: "Federal benefit figures changed on Oct 1 and this service may not reflect them yet. Double-check any dollar amount with your state agency.",
  es: "Las cifras federales cambiaron el 1 de octubre y es posible que este servicio aún no las refleje. Verifica cualquier monto con tu agencia estatal.",
  vi: "Các con số liên bang đã thay đổi từ ngày 1 tháng 10 và dịch vụ này có thể chưa cập nhật. Hãy kiểm tra lại mọi số tiền với cơ quan tiểu bang của bạn.",
  zh: "联邦标准已于10月1日调整，本服务可能尚未更新。请与您所在州的机构核实所有金额。",
} as const;

/** Render the "sources as of" footer (always) plus READER staleness
 * warnings only. Operator warnings are returned by assessFreshness for the
 * server log and never rendered into an answer (#958). */
export function formatFreshnessFooter(
  now: Date,
  corpusDate: string,
  state?: string | null,
  lang: AnswerLang = "en",
): string {
  const { asOf, readerWarnings } = assessFreshness(now, corpusDate, state);
  // All four languages, not two: this line is the apparatus that carries the
  // product's promise, and a zh reader was getting it in English.
  const asOfLocalized =
    lang === "es"
      ? "Cifras del año fiscal 2026, vigentes hasta el 30 de septiembre de 2026"
      : lang === "vi"
        ? "Số liệu năm tài khóa 2026, có hiệu lực đến ngày 30 tháng 9 năm 2026"
        : lang === "zh"
          ? "2026 财年数据，有效期至 2026 年 9 月 30 日"
          : asOf;
  // "Source", not "Sources as of". It sits at the foot of every answer, so it
  // is read hundreds of times more often than it is acted on, and the shorter
  // it is the less it competes with the answer above it.
  //
  // AND IT LINKS. A citation the reader cannot go and check is a claim about
  // having checked, which is the opposite of this product's argument. eCFR
  // Title 7 Part 273 is where every federal figure in an answer comes from.
  // THE LINK IS ON THE SOURCE'S NAME, not the whole line. Underlining the
  // dates gave a footnote more visual pull than a citation deserves.
  const lead =
    lang === "es"
      ? "Según las reglas federales de SNAP"
      : lang === "vi"
        ? "Dựa trên quy định SNAP liên bang"
        : lang === "zh"
          ? "依据联邦 SNAP 规定"
          : "Based on federal SNAP rules";
  const lines = [
    `\n\n*${lead} ([eCFR](https://www.ecfr.gov/current/title-7/part-273)). ${asOfLocalized}.*`,
  ];
  // READER warnings only. Operator warnings never render here — the
  // orchestrator logs them server-side, where the person who can act on
  // "re-run build-ecfr-corpus.py" actually is.
  for (const w of readerWarnings) {
    lines.push(`\n> ⚠️ ${w === READER_STALE_FIGURES.en ? READER_STALE_FIGURES[lang] : w}`);
  }
  return lines.join("");
}
