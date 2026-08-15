// Multi-turn conversational eval — drives the REAL answerQuestion() pipeline
// through a whole scripted conversation, turn by turn, exactly as
// apps/web/app/api/demeter/route.ts does: audience "public", full message
// history resent each call, state passed separately from the message array
// (null = federal floor). Requires ANTHROPIC_API_KEY.
//
// WHY THIS EXISTS: answer-eval.ts's ADVERSARIAL_GOLD comment names the gap
// directly — "AnswerExpectation and the live runner are both single-turn...
// Testing crescendo attacks needs the schema and runner extended to carry a
// conversation array; that's a framework change... left open by this pass."
// This is that framework change. It is also this repo's dominant QA lesson
// in code form (see CLAUDE.md's findings ledger and recent commit history):
// consequential defects — a model imitating its own appended trailer, a
// clarifying question repeated verbatim, an acronym used unexplained — show
// up only when a WHOLE rendered transcript is read start to finish. A
// single-turn gold case cannot surface any of the three bugs above; a
// multi-turn one did, on the first live run of this module's runner.
//
// This module intentionally does NOT try to replace human transcript
// reading with automated scoring for every conversational-quality question
// (tone, task continuity, warmth) — those still want a person reading the
// output. What IS automatable, and checked below, is: (1) does any answer
// carry more than one certainty banner / citation checklist / source
// footer — the trailer-imitation shape found and fixed 2026-08-15 — and
// (2) does the exact same bolded ask get repeated verbatim across
// consecutive turns without an intervening answer to it.

import { answerQuestion, STREAM_RECOMPOSE_MARKER, type ChatMessage } from "../orchestrator";
import type { AnswerLang } from "../lang";
import { VERIFIED_STATES } from "../packs";

export interface ConversationTurn {
  /** A user message. Mutually exclusive with `setState`. */
  user?: string;
  /** Simulates the reader picking a state from DemeterChat's picker —
   *  changes what's SENT on the NEXT turn without adding a message. `null`
   *  returns to the federal floor. Mutually exclusive with `user`. */
  setState?: string | null;
  /** Switches answer language starting on this turn (default carries over
   *  from the previous turn; conversation starts "en"). */
  lang?: AnswerLang;
}

export interface ConversationScript {
  id: string;
  /** What this script is probing for — shows up in the report. */
  description: string;
  turns: ConversationTurn[];
}

export interface ConversationTurnResult {
  turnIndex: number;
  state: string | null;
  user: string;
  answer: string;
  outcome: string;
}

export interface ConversationResult {
  id: string;
  description: string;
  turns: ConversationTurnResult[];
  /** Turn indices (1-based) whose answer contains a duplicated trailer —
   *  two-or-more certainty-banner-shaped lines, or two-or-more "Citation:"
   *  headings. Empty when clean. */
  duplicateTrailerTurns: number[];
  /** Turn indices where the CLOSING bolded ask ("**...**") is byte-identical
   *  to the closing ask on the immediately preceding turn — the
   *  repeated-question shape found and fixed 2026-08-15. Only compares the
   *  primary/final ask per turn, not every bolded phrase, so a document
   *  checklist re-bolding the same required item across turns ("**Social
   *  Security numbers**") is not mistaken for a repeated clarifying
   *  question. Empty when clean. */
  repeatedAskTurns: number[];
  /** Turn indices where state was null (no state ever given) but the
   *  answer names a specific state's program alias anyway — see
   *  namesStateProgramAlias. Empty when clean. */
  namedStateWithNoStateSetTurns: number[];
}

// Same signature the model's own trailer uses (see orchestrator.ts
// TRAILER_LINE_MARKERS) — duplicated here as literal detection rather than
// imported, because this module is meant to survive the underlying trailer
// FORMAT changing without silently losing the ability to notice imitation;
// if the format changes, this check's assertions should be revisited
// alongside it, not drift unnoticed via a shared regex.
function countTrailerBanners(answer: string): number {
  return answer.split("\n").filter((l) => /^[✓⚠◑]\s*\*\*/.test(l.trim())).length;
}
function countCitationHeadings(answer: string): number {
  return answer.split("\n").filter((l) => /^\*\*(Citation|Citas|Trích dẫn|引用)[：:]\*\*/.test(l.trim()))
    .length;
}

// Regression guard for a real production transcript (2026-08-15, #833's
// companion finding): asked "is SNAP available to me?" with NO state ever
// given, the answer opened "SNAP (called CalFresh in California) is
// available to most people..." — singling out one state's program name is
// the same "reached for California as if it were the rule" error the
// system prompt already forbade for income-limit figures, just in program-
// naming form instead. A live 4-run reproduction found it in 1/4 runs
// before the prompt fix (system-prompt.ts's "WHEN NO STATE IS SET" rule)
// and 0/4 after. This regexes every VERIFIED_STATES program alias
// ("CalFresh", "Basic Food", ...) so the check generalizes to any state's
// name being reached for, not just California's.
const STATE_PROGRAM_NAMES = VERIFIED_STATES.map((s) => s.program).filter(
  // "SNAP" itself, and any state's plain generic label, is the correct
  // no-state answer — only a DISTINCTIVE alias (one that isn't just "SNAP")
  // is evidence a specific state was named.
  (p) => p.trim().toUpperCase() !== "SNAP",
);
const STATE_PROGRAM_NAME_RE = new RegExp(
  `\\b(${STATE_PROGRAM_NAMES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i",
);
function namesStateProgramAlias(answer: string): boolean {
  return STATE_PROGRAM_NAME_RE.test(answer);
}

// Only bolded spans long enough to be a genuine clarifying-question ASK
// ("**Which state are you in**"), not a short re-bolded term that
// legitimately recurs across turns for a different reason.
const MIN_ASK_LENGTH = 20;

/** The primary ask of a turn, per the prompt's own convention ("Bold the
 *  ASK... on the FINAL line of your answer") — the LAST bolded span, not
 *  every bolded phrase. A document checklist can legitimately re-bold the
 *  same required item ("**Social Security numbers**") across two turns
 *  without that being the repeated-clarifying-question failure this exists
 *  to catch; comparing only the closing ask avoids flagging that as a false
 *  positive while still catching the real shape (the SAME closing question
 *  asked again after going unanswered). Returns "" when the turn has no
 *  bolded ask at all (a plain answer with no follow-up question), which
 *  never equals another turn's "" comparison — see repeatedAskTurns below,
 *  which skips empty asks explicitly. */
function primaryAsk(answer: string): string {
  const matches = answer.match(/\*\*[^*]+\*\*/g) ?? [];
  const long = matches.map((m) => m.slice(2, -2).trim()).filter((a) => a.length >= MIN_ASK_LENGTH);
  return long[long.length - 1] ?? "";
}

/** Run one scripted conversation against the real pipeline, turn by turn.
 *  Mirrors DemeterChat.tsx's send(): each call resends the full history
 *  (last 20 messages), and a `recompose` frame REPLACES the draft so far
 *  rather than appending to it — accumulating through it would glue an
 *  aborted partial onto the retry with no separator, which is a harness
 *  artifact, not a real product behavior. */
export async function runConversation(
  script: ConversationScript,
  apiKey: string,
): Promise<ConversationResult> {
  const messages: ChatMessage[] = [];
  const turns: ConversationTurnResult[] = [];
  let state: string | null = null;
  let lang: AnswerLang = "en";
  let turnIndex = 0;

  for (const t of script.turns) {
    if (t.setState !== undefined) {
      state = t.setState;
      continue;
    }
    if (t.lang) lang = t.lang;
    if (!t.user) continue;

    messages.push({ role: "user", content: t.user });
    turnIndex++;

    let answer = "";
    let outcome = "clean";
    for await (const frame of answerQuestion({
      messages: messages.slice(-20),
      audience: "public",
      state,
      lang,
      apiKey,
      meta: { staffUserId: null, mode: "public", sessionId: null, turnIndex },
      events: { onVerified: (o) => (outcome = o) },
    })) {
      if (frame.type === "recompose") answer = "";
      else if (frame.type === "delta" || frame.type === "trailer") answer += frame.text;
    }
    // Belt-and-suspenders: a plain-text-transport adapter (like route.ts)
    // would see the literal marker instead of a typed frame; strip it the
    // same way if it ever shows up here.
    const markerAt = answer.lastIndexOf(STREAM_RECOMPOSE_MARKER);
    if (markerAt >= 0) answer = answer.slice(markerAt + STREAM_RECOMPOSE_MARKER.length);

    turns.push({ turnIndex, state, user: t.user, answer, outcome });
    messages.push({ role: "assistant", content: answer });
  }

  const duplicateTrailerTurns = turns
    .filter((t) => countTrailerBanners(t.answer) > 1 || countCitationHeadings(t.answer) > 1)
    .map((t) => t.turnIndex);

  const repeatedAskTurns: number[] = [];
  for (let i = 1; i < turns.length; i++) {
    const prevAsk = primaryAsk(turns[i - 1]!.answer);
    const thisAsk = primaryAsk(turns[i]!.answer);
    if (thisAsk && thisAsk === prevAsk) repeatedAskTurns.push(turns[i]!.turnIndex);
  }

  const namedStateWithNoStateSetTurns = turns
    .filter((t) => t.state === null && namesStateProgramAlias(t.answer))
    .map((t) => t.turnIndex);

  return {
    id: script.id,
    description: script.description,
    turns,
    duplicateTrailerTurns,
    repeatedAskTurns,
    namedStateWithNoStateSetTurns,
  };
}

export async function runConversations(
  scripts: ConversationScript[],
  apiKey: string,
): Promise<ConversationResult[]> {
  const results: ConversationResult[] = [];
  for (const s of scripts) results.push(await runConversation(s, apiKey));
  return results;
}

/** Render a transcript exactly the way a human should read it — the whole
 *  point of this module, per this repo's dominant QA lesson: consequential
 *  defects are found by reading full transcripts, not by scoring alone. */
export function formatTranscript(r: ConversationResult): string {
  const lines = [`=== ${r.id} — ${r.description} ===`, ""];
  for (const t of r.turns) {
    lines.push(`### USER (turn ${t.turnIndex}, state=${t.state ?? "null"}):`, t.user, "");
    lines.push(`### ASSISTANT (outcome=${t.outcome}):`, t.answer, "");
  }
  if (r.duplicateTrailerTurns.length) {
    lines.push(`⚠ duplicate trailer apparatus on turn(s): ${r.duplicateTrailerTurns.join(", ")}`);
  }
  if (r.repeatedAskTurns.length) {
    lines.push(`⚠ repeated bolded ask on turn(s): ${r.repeatedAskTurns.join(", ")}`);
  }
  if (r.namedStateWithNoStateSetTurns.length) {
    lines.push(
      `⚠ named a state's program alias with no state set on turn(s): ${r.namedStateWithNoStateSetTurns.join(", ")}`,
    );
  }
  return lines.join("\n");
}

// Gold conversations — mirror real transcripts, not synthetic edge cases.
// Each probes a different way a multi-turn conversation actually goes
// wrong: task abandonment mid-conversation, distress without over-hedging,
// self-employment/irregular-income deadlocks, and state-switch fact
// carryover with a bare-facts reply (#766). Authored 2026-08-15; the first
// live run of this exact battery found and fixed three real defects (see
// git log: the appended-trailer imitation, unexplained BBCE, and the
// repeated-clarifying-question shape) — kept here so the same battery can
// be re-run after future prompt/orchestrator changes rather than
// re-invented per session.
export const CONVERSATION_GOLD: ConversationScript[] = [
  {
    id: "mixed-status-household",
    description:
      "undocumented parents applying for citizen children only — public-charge fear, cash self-employment income, task continuity through to drafting the application",
    turns: [
      {
        user:
          "My husband and I are undocumented but our two kids were born here. I'm scared applying for food stamps for them will get us deported or hurt his case later. Can I even apply for just them?",
      },
      {
        user:
          "We're in Texas. There's 4 of us in the house - me, my husband, and our 2 kids (5 and 8). Only the kids would apply.",
      },
      {
        user:
          "I make about $2,600 a month doing house cleaning, cash, no paystubs. My husband makes about $1,800 landscaping, also cash. Does that count as income even though it's not on the books?",
      },
      { user: "What documents do I need for the kids if we don't have SSNs ourselves?" },
      { user: "If we get approved will ICE find out our address?" },
      { user: "Can you just help me start filling out the application for the kids?" },
    ],
  },
  {
    id: "self-employed-rideshare",
    description:
      "gig-income self-employment deductions, irregular week-to-week income averaging, mid-certification change reporting",
    turns: [
      {
        user:
          "I drive for Uber and Lyft full time. How do I even figure out my income for a SNAP application? It's different every week.",
      },
      { user: "I'm in California. Just me, no dependents." },
      {
        user:
          "Last month I grossed $4,200 but I spent like $1,100 on gas, my car payment, and insurance. What actually counts as my income?",
      },
      { user: "I don't track mileage separately - is there a standard deduction, or do I need receipts for everything?" },
      { user: "My income varies a lot week to week - some weeks $600, some $1,400. How do they even average that out?" },
      { user: "If I have a slow month right after I apply, can I report the change?" },
    ],
  },
  {
    id: "resident-plus-student-veteran-partner",
    description:
      "unmarried-partner household-composition test, ineligible-student exclusion, VA education benefits as income, an unanswered clarifying question across several turns",
    turns: [
      {
        user:
          "I'm a medical resident making $63k a year, and my partner is in grad school full-time with no job. We might actually be eligible for SNAP because residents get paid so little for the hours we work - is that a real thing?",
      },
      { user: "We're in New York. Just the two of us, not married, and we split rent." },
      {
        user:
          "My partner also gets $1,400 a month in VA education benefits, GI Bill stuff, they're a veteran. Does that count as income?",
      },
      { user: "Since my partner is a full-time grad student, does that disqualify us or change our household size?" },
      { user: "Does it matter that I get free on-call meals at the hospital some nights?" },
      { user: "Is this actually worth applying for? Can you help me figure out roughly what we'd get?" },
    ],
  },
  {
    id: "zero-knowledge-full-application",
    description:
      "someone with no prior SNAP knowledge asking for a fully drafted application, a mid-conversation new income fact (child support), task continuity turn to turn",
    turns: [
      {
        user:
          "I don't know anything about food stamps, I've never applied for anything like this before. Can you help me write out the whole application?",
      },
      { user: "I'm in Ohio. It's just me and my two kids, ages 3 and 7. I'm not working right now, no income at all." },
      { user: "What documents do I need to gather before I start?" },
      { user: "Okay I found my ID and the kids' birth certificates. What's next?" },
      { user: "Oh wait, I do get $400 a month in child support from my ex. Does that count?" },
      { user: "Can you just walk me through filling out the actual form now, step by step?" },
    ],
  },
  {
    id: "bare-facts-then-state-switch",
    description:
      "a bare-facts reply to the bot's own orientation question (#766 shape), then a live state switch mid-conversation to verify gathered facts (household size, income, an elderly relative) carry forward correctly",
    turns: [
      { user: "How much SNAP would a family of 3 get a month?" },
      { user: "three people in my household; we make 3,200 a month and we're in Boston" },
      { setState: "MA" },
      { user: "okay so does that change anything you just told me?" },
      {
        user:
          "one of the three is my mother, she's 68 and lives with us but doesn't buy or cook her own food separately",
      },
      { user: "does she count toward the household or not" },
    ],
  },
  {
    id: "no-state-set-program-naming",
    description:
      "no state ever given (real transcript shape, 2026-08-15) — the model must not reach for one state's program alias (e.g. \"CalFresh\") as if it were the answer; guards the fix for a real production failure the reader had to call out three times before it stopped",
    turns: [{ user: "is snap available to me?" }],
  },
];
