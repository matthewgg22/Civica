// Shipping copy must be made of sentences.
//
// #1007 replaced every em-dash across the product, correctly, by a rule that
// was also correct: "a clause separator became two sentences, a parenthetical
// became a comma, an appositive became a colon." The automated pass did not
// always pick the right one — 187 dashes became a full stop and 46 became a
// comma, and where a parenthetical got a full stop the result was a fragment.
//
// #1016/#1017 caught that in lib/legal, where it had broken a survival clause
// and an indemnity. #1029 was the follow-up: read the other ~190. Six were
// genuinely broken, including "SNAP. Also called CalFresh, EBT, or food
// stamps. Is monthly money for groceries." on the root layout.
//
// THESE RULES ARE NARROW ON PURPOSE. A grammar checker drowns this file in
// false positives: the product voice legitimately opens sentences with "And",
// UI errors are legitimately elliptical ("Too many requests, try again"), and
// taglines are legitimately fragments ("Verified SNAP answers, with the rule
// attached"). What is pinned is only the shapes a bad substitution PRODUCES
// and a writer never would.
import { describe, expect, it } from "vitest";
import { PAGE_COPY } from "../lib/i18n/snap-page";
import { T as CHAT_COPY } from "../lib/i18n/demeter-chat-copy";
import { snapStrings, welcomeStrings } from "../lib/i18n/snap-copy";
import { DOCUMENTS } from "../lib/legal";
import * as ROOT_METADATA from "../lib/root-metadata-copy";
import {
  formQuestionFaq,
  EN_GENERAL_FAQ,
  EN_TITLE,
  EN_DESCRIPTION,
} from "../app/screen/ask/structured-data";

/** Every string reachable in a copy object, however nested. Functions are
 *  called with placeholder arguments so their output is checked too. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (typeof value === "function") {
    try {
      out.push(String((value as (...a: unknown[]) => unknown)("X", "Y", 1, 2)));
    } catch {
      /* a formatter needing a richer shape is skipped rather than guessed at */
    }
  } else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => strings(v, out));
  return out;
}

// ENGLISH ONLY. These are rules of English grammar, and applied to the other
// locales they fire on perfectly good sentences: Spanish "Has hecho muchas
// preguntas hoy" opens on an auxiliary, and Vietnamese "Do cơ quan…" opens on
// a word that merely looks like one. The other languages need a reader of that
// language, which is noted in #1029 and is not a job a regex can do.
const SOURCES: Record<string, unknown> = {
  "snap-page": PAGE_COPY.en,
  "demeter-chat-copy": CHAT_COPY.en,
  "snap-copy": snapStrings.en,
  "welcome-copy": welcomeStrings.en,
  legal: DOCUMENTS,
  // PAGE-LEVEL STRINGS TOO, and this is the part I got wrong first. Covering
  // only the copy MODULES made every rule below pass while two of the six
  // real breakages sat untouched: "SNAP. Also called CalFresh, EBT, or food
  // stamps. Is monthly money for groceries." is root metadata, and the
  // stranded "Are applied before your income…" is JSON-LD. A guard that
  // cannot see where the bugs were is not a guard.
  "root-metadata": ROOT_METADATA,
  "structured-data": {
    faq: formQuestionFaq("en"),
    general: EN_GENERAL_FAQ,
    title: EN_TITLE,
    description: EN_DESCRIPTION,
  },
};

const sentences = (t: string) =>
  t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);

function offenders(source: unknown, test: (s: string) => boolean): string[] {
  return [
    ...new Set(strings(source).flatMap((t) => sentences(t).filter(test))),
  ].map((s) => s.slice(0, 110));
}

describe.each(Object.entries(SOURCES))("%s", (_name, source) => {
  it("has no sentence ending on a conjunction", () => {
    // What a parenthetical becomes when its OPENING dash is cut but the
    // sentence continues: "…disclose only what that process compels, and."
    const bad = offenders(source, (s) => /[ ,](and|or|but)\.$/i.test(s));
    expect(bad, `sentences ending on a conjunction:\n${bad.join("\n")}`).toEqual([]);
  });

  it("has no sentence opening on a relative pronoun", () => {
    // What "— which generally means very low income —" becomes when both
    // dashes are cut with full stops.
    // Questions are exempt: "Which state are you in?" is a sentence.
    const bad = offenders(
      source,
      (s) => /^(Which|Whose|Whom)\b/.test(s) && !s.endsWith("?"),
    );
    expect(bad, `sentences opening on a relative pronoun:\n${bad.join("\n")}`).toEqual([]);
  });

  it("has no statement opening on a bare finite verb", () => {
    // The layout.tsx shape: "SNAP. Also called CalFresh… Is monthly money for
    // groceries." The subject was inside the parenthetical the dash carried,
    // so cutting it strands the verb. Questions are exempt — "Are you
    // applying?" is a sentence, "Are applied before your income…" is not.
    // Deliberately just the copulas, and never a question. Has/Have/Do/Does
    // were in this list and had to come out: "Do not decide whether to apply
    // based only on what Demeter tells you" is an imperative, and a rule that
    // flags the safety copy is a rule somebody deletes.
    const bad = offenders(
      source,
      (s) => /^(Is|Are|Was|Were)\b/.test(s) && !s.endsWith("?"),
    );
    expect(bad, `sentences opening on a bare verb:\n${bad.join("\n")}`).toEqual([]);
  });
});

// The bare-domain share card is the top of the whole distribution funnel — a
// CBO's Slack, a funder's inbox, a text to someone who needs SNAP. Its metadata
// used to describe the parked Civica apply wizard ("Apply for SNAP food
// benefits" / "walks you through the application"), which contradicted the
// Demeter OG image and over-promised an application flow (launch audit
// 2026-08-29).
describe("root share-card metadata describes the Demeter answers product", () => {
  const rootStrings = strings(ROOT_METADATA);

  it("leads with Demeter, not an application flow", () => {
    expect(ROOT_METADATA.ROOT_TITLE).toMatch(/Demeter/);
    expect(ROOT_METADATA.ROOT_TITLE, "title must not promise an apply flow").not.toMatch(/appl(y|ication)/i);
  });

  it("does not California-center a for-any-state product", () => {
    const calfresh = rootStrings.filter((s) => /calfresh/i.test(s));
    expect(calfresh, `CalFresh in root metadata:\n${calfresh.join("\n")}`).toEqual([]);
  });
});
