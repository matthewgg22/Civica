// answerQuestion() — the ONE answer pipeline (eng review 5A). Both consumers
// (apps/web public chat, apps/dashboard staff chat) are thin wrappers around
// this generator; the product's core policies live here exactly once:
//
//   redact PII → build grounded system (state-threaded) → STREAM with
//   INCREMENTAL citation verification → on first bad citation: abort the
//   stream, retry ONCE buffered, else DEGRADE to verified-quotes-only →
//   citation trailer + freshness footer → audit event.
//
// Streaming × verification (eng review T-A): verification is cheap regex over
// accumulated text, so it runs DURING the stream at checkpoints. ~97% of
// answers stream normally; the moment an unrecognized citation appears the
// stream aborts with a "recompose" frame — the client replaces the partial
// text, so no unverified answer is ever left standing as final.
//
//   frames:  {delta}* → [ {recompose} → {delta} ] → {trailer}
//
// Degraded answers count as verifier FAILURES for the 97% production metric
// (events.verifierOutcome = "degraded") — the metric cannot game itself.

import Anthropic from "@anthropic-ai/sdk";
import { buildMaeSystem, MAE_GENERATION, type Audience } from "./answer";
import { thinkingConfigFor } from "./thinking-config";
import {
  verifyCitations,
  formatCitationTrailer,
  type CitationCheck,
} from "./citation-verifier";
import { redactPii } from "./pii";
import { retrieve, formatRetrievedSources, CORPUS_EFFECTIVE_DATE } from "./retrieval";
import { formatFreshnessFooter } from "./freshness";
import { assessCertainty, formatCertaintyBanner } from "./certainty";
import { isVerifiedState } from "./packs";
import { consoleAuditSink, type MaeAuditRecord, type MaeAuditSink } from "./audit";
import { retrievalMode } from "./embeddings";
import { detectDistress, DISTRESS_SYSTEM_ADDENDUM } from "./distress";
import { verifyNumericEquivalence } from "./numeric-check";
import { answerInstruction, degradeWrapper, degradeLeads, type AnswerLang } from "./lang";
import { classifyQuestionTopic } from "./form-questions";
import {
  shouldAttemptEngineGrounding,
  buildEngineGroundingBlock,
} from "./screening/engine-grounding";

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// Abuse / cost bounds shared by every consumer. Auth/rate-limiting are the
// callers' job; these cap a single request so a pasted wall of text can't run
// up token spend.
export const ANSWER_LIMITS = {
  MAX_MESSAGES: 20,
  MAX_CHARS_PER_MESSAGE: 8_000,
  MAX_TOTAL_CHARS: 40_000,
  MAX_OUTPUT_TOKENS: 4_096,
} as const;

/** Validate a client-supplied conversation. Returns clean messages or an error. */
export function parseMessages(raw: unknown): { messages: ChatMessage[] } | { error: string } {
  const { MAX_MESSAGES, MAX_CHARS_PER_MESSAGE, MAX_TOTAL_CHARS } = ANSWER_LIMITS;
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { messages?: unknown }).messages)) {
    return { error: "Body must be { messages: [{ role, content }] }" };
  }
  const input = (raw as { messages: unknown[] }).messages;
  if (input.length === 0) return { error: "messages must not be empty" };
  if (input.length > MAX_MESSAGES) return { error: `Too many messages (max ${MAX_MESSAGES})` };

  const messages: ChatMessage[] = [];
  let totalChars = 0;
  for (const m of input) {
    if (!m || typeof m !== "object") return { error: "Each message must be an object" };
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") {
      return { error: "message.role must be 'user' or 'assistant'" };
    }
    if (typeof content !== "string" || content.trim().length === 0) {
      return { error: "message.content must be a non-empty string" };
    }
    if (content.length > MAX_CHARS_PER_MESSAGE) {
      return { error: `A message is too long (max ${MAX_CHARS_PER_MESSAGE} characters)` };
    }
    totalChars += content.length;
    messages.push({ role, content });
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    return { error: "Conversation is too long — start a new chat" };
  }

  // A client windowing a long conversation to the last N raw messages (as
  // apps/web does, sending only the tail so the request stays bounded) can
  // land on an even split and hand us an assistant message first — half of
  // a still-valid exchange, not a malformed request. Trimming the dangling
  // leader self-heals that instead of hard-rejecting it: once a real
  // conversation crosses MAX_MESSAGES exchanges, a naive tail-slice on the
  // client hits this on EVERY subsequent turn, permanently, so failing
  // closed here would permanently lock the user out rather than degrade
  // gracefully by losing one extra turn of context (#833).
  while (messages.length > 0 && messages[0]!.role !== "user") {
    messages.shift();
  }
  if (messages.length === 0) {
    return { error: "Conversation must start with a user message" };
  }
  if (messages[messages.length - 1]!.role !== "user") {
    return { error: "The last message must be from the user" };
  }
  return { messages };
}

export type VerifierOutcome = "clean" | "recomposed" | "degraded";

export type AnswerFrame =
  | { type: "delta"; text: string }
  | { type: "recompose" } // partial text is unverified — client replaces it
  | { type: "trailer"; text: string };

/** Marker both route adapters emit for a recompose frame in plain-text
 *  transports; clients replace everything before it. */
export const STREAM_RECOMPOSE_MARKER = "\n\n⟲ recomposing with verified sources…\n\n";

export interface AnswerEvents {
  /** Best-effort audit sink; defaults to the structured console sink. */
  audit?: MaeAuditSink;
  /** Fired once per answer with the final verifier verdict (the 97% metric). */
  onVerified?: (outcome: VerifierOutcome, checks: CitationCheck[]) => void;
  /** Fired once with the KNOWN token usage (attempt 1 final + retry, summed).
   *  Zero when attempt 1 was aborted mid-stream (no finalMessage) — callers
   *  settling spend should estimate from emitted characters in that case. */
  onUsage?: (inputTokens: number, outputTokens: number) => void;
}

export interface AnswerRequest {
  /** Validated messages (run parseMessages first). PII is redacted here. */
  messages: ChatMessage[];
  /** Who's asking — "staff" (Civica dashboard) or "public" (apps/web).
   *  REQUIRED, no default: this selects the persona prompt (system-prompt.ts),
   *  and it must be impossible for a caller to forget it and silently get the
   *  wrong one, the way `meta.mode` was set and never consulted before. */
  audience: Audience;
  /** Pack state code, or null for the explicit federal floor (public no-state).
   *  undefined preserves the legacy dashboard default (CA). */
  state?: string | null;
  /** Answer language. The corpus and verification stay ENGLISH; an "es" answer
   *  is composed from verified EN content. Every $ and % in the final answer,
   *  in EITHER language, must appear in the grounding text — see numbersOk. */
  lang?: AnswerLang;
  apiKey: string;
  /** EVAL ONLY — generate with a model other than the pin, so the same gold
   *  set can be scored across candidates (#602). Setting this on a request
   *  whose `meta.mode` is not "eval" THROWS rather than being ignored: a
   *  silently-dropped override would make a comparison run look like it
   *  measured three models when it measured the pin three times, which is
   *  worse than an error because the numbers would look plausible.
   *
   *  Not a production knob. The model that actually ran is recorded on every
   *  audit row, so a misuse is visible in mae_query_log.model rather than
   *  inferred. */
  modelOverride?: string;
  /** Aborts generation (and billing) when the client disconnects. */
  signal?: AbortSignal;
  events?: AnswerEvents;
  /** Audit metadata (already validated by the caller). */
  meta?: {
    staffUserId?: string | null;
    mode?: string;
    scopeRef?: string | null;
    question?: string;
    /** Anonymous per-tab grouping key + turn number, for the drop-off curve. */
    sessionId?: string | null;
    turnIndex?: number | null;
  };
}

// How often the incremental verifier runs over accumulated text. Small enough
// to catch a bad citation within a sentence or two of it appearing; large
// enough that the regex pass is negligible next to token latency.
const VERIFY_INTERVAL_CHARS = 350;

function hasUnrecognized(checks: CitationCheck[]): boolean {
  return checks.some((c) => c.status === "unrecognized");
}

// Trailer apparatus the pipeline appends AFTER a model's answer — the
// certainty banner, "Check it yourself" line, "Citation:" checklist, and
// freshness/source footer (see formatCertaintyBanner/certainty.ts,
// formatCitationTrailer/citation-verifier.ts, formatFreshnessFooter/
// freshness.ts). Matched line-by-line rather than as one trailing block,
// because production has seen the model reproduce these lines individually,
// not only as a copied suffix — see stripAppendedTrailer below.
//
// The mark characters (✓ ⚠ ◑) are language-invariant by design (certainty.ts:
// "the mark is the same in every language"); the small set of headings is
// enumerated across the four supported languages, mirroring the client's own
// dropDuplicateTrailerLines/dropDuplicateFooter (DemeterChat.tsx), which
// exists for the identical reason on the display side.
const TRAILER_LINE_MARKERS: RegExp[] = [
  // The horizontal rule that always opens the trailer (formatCertaintyBanner
  // / formatCitationTrailer). Real answer prose has no reason to write one —
  // the prompt tells the model this apparatus is appended for it.
  /^-{3,}$/,
  // Certainty banner: "✓ **CERTAIN** — …" / "⚠ **UNCERTAIN** — …" — and any
  // mark-shaped line a model improvises in the same visual language. Live QA
  // caught an invented "◑ **HIGH CONFIDENCE**" that matches NEITHER real
  // label; the shape (mark, then a bolded word) is itself the tell.
  /^[✓⚠◑]\s*\*\*/,
  // "_Check it yourself:_" and its localizations (certainty.ts COPY).
  /^_?(Check it yourself|Compruébalo tú mismo|Tự kiểm tra|自己核对)/i,
  // "**Citation:**" heading, all four languages (citation-verifier.ts
  // TRAILER_STRINGS).
  /^\*\*(Citation|Citas|Trích dẫn|引用)[：:]\*\*/,
  // Citation checklist bullets: "- ✓ …", "- ◑ …", "- ⚠️ …".
  /^-\s*(✓|◑|⚠️)/,
  // Freshness/source footer — both the current "Source" label and the
  // retired "Sources as of" one (a saved conversation can still hold it).
  /^\*?(Sources? as of|Source|Fuentes? al|Fuente|Nguồn|来源)\b/i,
  // Freshness warning line (formatFreshnessFooter).
  /^>\s*⚠️/,
];

/** Strip the pipeline-appended trailer from an assistant turn before it goes
 *  back into the NEXT call's conversation history.
 *
 *  Live conversational QA (2026-08-15) found the model reproducing its own
 *  prior-turn trailer — a second certainty banner, a duplicate "Citation:"
 *  checklist, even an invented banner label matching neither real verdict —
 *  inside a LATER answer. The cause: the pipeline's own appended trailer is
 *  exactly what a caller stores as that turn's rendered content and exactly
 *  what gets resent as conversation history on the next call (apps/web
 *  stores and resends the full streamed text, delta and trailer frames
 *  alike). The model seeing its own "past turn" already wearing the house
 *  citation-apparatus format is what taught it to reproduce the format — a
 *  system-prompt instruction not to write this section cannot survive its
 *  own violation sitting in the transcript as an example to follow.
 *
 *  The client already de-duplicates this for DISPLAY (DemeterChat.tsx's
 *  dropDuplicateTrailerLines/dropDuplicateFooter), which hides the symptom
 *  on screen but leaves the cause untouched — this removes the example
 *  itself, at the one place ALL callers' history passes through.
 *
 *  Only ever applied to ASSISTANT history. Civica's real trailer for the
 *  CURRENT turn is computed and yielded separately, downstream in this file,
 *  after this function has already run on the messages sent to the model. */
export function stripAppendedTrailer(text: string): string {
  const stripped = text
    .split("\n")
    .filter((line) => !TRAILER_LINE_MARKERS.some((re) => re.test(line.trim())))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // A message that is ENTIRELY trailer is pathological, not the case this
  // exists for — never hand the SDK an empty message; keep the original
  // rather than error the whole turn over a history-hygiene fix.
  return stripped || text;
}

/** What a reader gets when generation cannot be verified twice.
 *
 *  The guardrail is WORKING when this fires — it has stopped the model asserting
 *  a figure it could not source. This used to then paste the entire retrieved
 *  block: someone who typed "four people, $4k, Boston" received several hundred
 *  words of 7 CFR 273.8 on vehicle resource exclusions, under an
 *  internal-sounding apology. Refusing to guess was right; that was not how to
 *  say so.
 *
 *  `retrievedBlock` is deliberately NOT rendered. The citation trailer already
 *  carries the sources as links, which is what "read it yourself" should always
 *  have meant — the parameter stays so the caller keeps passing it and the
 *  retrieval is still what decides whether we got here.
 */
function degradedAnswer(
  _retrievedBlock: string,
  lang: AnswerLang = "en",
  priorDegrades = 0,
): string {
  const { lead, tail } = degradeWrapper(lang, priorDegrades);
  return `${lead}\n\n${tail}`;
}

/** The single answer pipeline. Yields frames; the caller adapts them to its
 *  transport (SSE, plain text stream, buffered JSON). */
export async function* answerQuestion(req: AnswerRequest): AsyncGenerator<AnswerFrame> {
  const { apiKey, signal, events, meta, audience } = req;
  const state = req.state; // undefined = legacy CA default; null = federal floor
  const lang = req.lang ?? "en";
  const audit = events?.audit ?? consoleAuditSink;

  // --- Redact PII before anything leaves the process ------------------------
  // Assistant history is stripped of the appended trailer FIRST — see
  // stripAppendedTrailer — so the model's own past answers, as sent back to
  // it, never contain the citation apparatus it is being asked not to write.
  let piiRedactions = 0;
  const messages = req.messages.map((m) => {
    const source = m.role === "assistant" ? stripAppendedTrailer(m.content) : m.content;
    const { redacted, found } = redactPii(source);
    piiRedactions += found;
    return { role: m.role, content: redacted };
  });
  const lastUser = messages[messages.length - 1]!.content;

  // --- Grounded system prompt (state-threaded; shared with the eval) --------
  const { systemBlocks, retrievedCitations, retrievedText } = await buildMaeSystem(
    lastUser,
    audience,
    state,
    lang,
  );

  // Distress gate (F2): crisis phrasing → the answer LEADS with immediate help.
  const distressed = detectDistress(lastUser);
  if (distressed) {
    systemBlocks.push({ type: "text", text: DISTRESS_SYSTEM_ADDENDUM });
  }
  // Non-English answers are composed from the verified ENGLISH sources;
  // citations stay verbatim. The numeric-equivalence gate below then applies
  // to EVERY language, which is what keeps a translated answer from inventing
  // a figure the sources never contained.
  const langInstruction = answerInstruction(lang);
  if (langInstruction) {
    systemBlocks.push({ type: "text", text: langInstruction });
  }

  // Engine grounding (#895) — the synthesis step. When the user has stated
  // money figures and a state is set, extract the household facts from the
  // visible conversation and run them through the verified snap-rules engine
  // (via the same classification layer the worksheet trusts). The resulting
  // block is self-describing (carries its own use-these-figures-verbatim
  // instructions) and joins systemBlocks BEFORE numericSource is built below,
  // so engine-computed figures pass the numeric gate with no gate changes.
  // Soft in every direction: the cheap trigger keeps non-numeric chats at
  // zero extra cost, and any extraction/engine failure returns a null block
  // rather than costing the reader their answer. Extraction tokens are
  // tracked so the caller's spend settle sees them.
  let groundingUsageIn = 0;
  let groundingUsageOut = 0;
  if (shouldAttemptEngineGrounding(messages, state === undefined ? "CA" : state)) {
    const grounding = await buildEngineGroundingBlock(
      messages,
      state === undefined ? "CA" : (state as string),
      apiKey,
      signal,
    );
    groundingUsageIn = grounding.usage.inputTokens;
    groundingUsageOut = grounding.usage.outputTokens;
    if (grounding.text) {
      systemBlocks.push({ type: "text", text: grounding.text });
    }
  }

  // Numbers the answer may legitimately carry: the verified sources PLUS the
  // user's own figures (an answer that echoes "with $1,500/month income…" is
  // repeating the question, not inventing data — live eval caught the gate
  // degrading exactly that).
  //
  // Applies to EVERY language, not just Spanish. This used to be ES-only —
  // built to catch a number surviving citation verification in English but
  // getting altered in translation. But citation verification only checks
  // that a CITED SECTION was actually retrieved; it says nothing about
  // whether a specific dollar figure next to that citation is the real one
  // or a fabrication wearing a real citation's credibility. Gating this to
  // "es" left English — the majority-language, default surface — with no
  // mechanical check on numbers at all, just the prompt asking nicely. Same
  // failure mode the Beeck Center/Digital Benefits Network study found:
  // plain prompting hits 0% accuracy on numerical rules even when the
  // structural/citation stuff is fine.
  //
  // The person's own turns go in SEPARATELY. They were already inside this
  // blob, but only as literal strings, and someone typing "74 k a year" does
  // not produce the "$74,000" an answer would write back — so their own income
  // was scored as an invented figure and every useful answer had to degrade.
  // One real conversation got the same dead paragraph five times over that.
  // See numeric-check.ts on why this is a second channel and not just more
  // text on the pile.
  const numericSource =
    systemBlocks.map((b) => b.text).join("\n") +
    "\n" +
    messages.map((m) => m.content).join("\n");
  const askedByUser = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");
  const numbersOk = (text: string): boolean =>
    verifyNumericEquivalence(text, numericSource, askedByUser).pass;

  // Eval-only model override. Refuses rather than ignores when the caller
  // hasn't declared an eval run — see the field's doc on AnswerRequest.
  if (req.modelOverride && meta?.mode !== "eval") {
    throw new Error(
      `modelOverride is eval-only (got mode=${meta?.mode ?? "undefined"}). ` +
        "Production requests generate with the pinned model.",
    );
  }
  const modelUsed = req.modelOverride ?? MAE_GENERATION.model;

  const client = new Anthropic({ apiKey });
  const generation = {
    ...MAE_GENERATION,
    model: modelUsed,
    // Thinking configuration is MODEL-GATED, so it cannot be pinned alongside
    // the model string. Adaptive thinking is rejected outright by older-family
    // models (Haiku 4.5 returns 400 "adaptive thinking is not supported on
    // this model"), which meant a comparison run could never have scored them
    // — every case would have errored, not scored badly. Found by a 2-case
    // smoke run before it cost a full sweep.
    thinking: thinkingConfigFor(modelUsed),
    max_tokens: ANSWER_LIMITS.MAX_OUTPUT_TOKENS,
    system: systemBlocks,
  };

  let outcome: VerifierOutcome = "clean";
  let answerText = "";
  let finalChecks: CitationCheck[] = [];
  let usageIn = groundingUsageIn;
  let usageOut = groundingUsageOut;

  // --- Attempt 1: stream with incremental verification ----------------------
  let aborted = false;
  let emittedAny = false;
  // WHICH check failed, not just that one did. The retry below used to send a
  // single corrective prompt written for citation failures ("cite only the
  // sources provided") regardless of which gate actually aborted the stream —
  // so a NUMERIC mismatch retried with guidance about an unrelated problem,
  // and predictably tried the same unverifiable figure again. Tracked as two
  // booleans (not exclusive) because a single draft can legitimately trip
  // both in the same checkpoint.
  let abortedOnCitation = false;
  let abortedOnNumeric = false;
  {
    const stream = client.messages.stream({ ...generation, messages }, { signal });
    let sinceVerify = 0;
    let buffered = "";
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const delta = event.delta.text;
          answerText += delta;
          buffered += delta;
          sinceVerify += delta.length;
          if (sinceVerify >= VERIFY_INTERVAL_CHARS) {
            sinceVerify = 0;
            const checks = verifyCitations(answerText, retrievedCitations, state, retrievedText);
            const citationBad = hasUnrecognized(checks);
            const numericBad = !numbersOk(answerText);
            if (citationBad || numericBad) {
              aborted = true;
              abortedOnCitation ||= citationBad;
              abortedOnNumeric ||= numericBad;
              stream.abort();
              break;
            }
            // Only text that has passed a checkpoint is released downstream.
            emittedAny = true;
            yield { type: "delta", text: buffered };
            buffered = "";
          }
        }
      }
      if (!aborted) {
        const final = await stream.finalMessage();
        usageIn += final.usage.input_tokens;
        usageOut += final.usage.output_tokens;
        finalChecks = verifyCitations(answerText, retrievedCitations, state, retrievedText);
        const citationBadFinal = hasUnrecognized(finalChecks);
        const numericBadFinal = !numbersOk(answerText);
        if (citationBadFinal || numericBadFinal) {
          aborted = true; // failed on the last unverified tail
          abortedOnCitation ||= citationBadFinal;
          abortedOnNumeric ||= numericBadFinal;
        } else {
          if (buffered) {
            emittedAny = true;
            yield { type: "delta", text: buffered };
          }
          if (!emittedAny) {
            // Safety refusal with no surfaced text — say something honest.
            yield {
              type: "delta",
              text:
                final.stop_reason === "refusal"
                  ? "I can't help with that request. I'm scoped to SNAP policy questions."
                  : "I couldn't generate a response. Please try rephrasing.",
            };
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && (err.name === "AbortError" || signal?.aborted)) return;
      if (!aborted) throw err;
    }
  }

  // --- Attempt 2 (buffered) + degrade ---------------------------------------
  if (aborted) {
    yield { type: "recompose" };
    outcome = "recomposed";
    // FAILURE-SPECIFIC, not one generic message for both gates. This used to
    // be a single citation-shaped corrective sent regardless of which check
    // actually failed — a numeric mismatch got told to "cite only the
    // sources provided", advice that doesn't address a bad number at all, so
    // the retry had no real information to correct itself with and
    // predictably reached for the same unverifiable figure again. Real
    // finding, 2026-08-16: a cash-paid housekeeper's weekly income
    // conversion aborted attempt 1 AND attempt 2 for this exact reason
    // before the numeric-check gate itself was fixed to accept it.
    const correctiveParts: string[] = [];
    if (abortedOnCitation) {
      correctiveParts.push(
        "your previous draft cited a source that is not in the provided source text. " +
          "Answer again citing ONLY the sources provided above. If the sources don't " +
          "cover the question, say so plainly instead of citing anything else.",
      );
    }
    if (abortedOnNumeric) {
      correctiveParts.push(
        "your previous draft stated a dollar amount or percentage that could not be " +
          "verified — it did not appear in the provided source text or the engine's " +
          "live parameters, and it was not something the person themselves stated, a " +
          "straightforward restatement or sum/difference of their own figures, or the " +
          "standard weekly-to-monthly (×4.3) or biweekly-to-monthly (×2.15) conversion " +
          "(7 CFR 273.10(c)(2)). Answer again using ONLY a figure you can trace to one " +
          "of those. If you cannot state a specific number this way, do not compute " +
          "one — describe what you can determine in words instead, or ask for the exact " +
          "figure you need.",
      );
    }
    const corrective = "IMPORTANT: " + correctiveParts.join(" SEPARATELY: ");
    const retrySystem = [...systemBlocks, { type: "text" as const, text: corrective }];
    let retryText = "";
    try {
      const retry = await client.messages.create(
        { ...generation, system: retrySystem, messages, stream: false },
        { signal },
      );
      retryText = retry.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      usageIn += retry.usage.input_tokens;
      usageOut += retry.usage.output_tokens;
    } catch (err) {
      if (err instanceof Error && (err.name === "AbortError" || signal?.aborted)) return;
      retryText = "";
    }
    finalChecks = verifyCitations(retryText, retrievedCitations, state, retrievedText);
    if (retryText && !hasUnrecognized(finalChecks) && numbersOk(retryText)) {
      answerText = retryText;
      yield { type: "delta", text: retryText };
    } else {
      outcome = "degraded";
      // lang matters MOST here: this is the verbatim-sources fallback, and an
      // unexpanded Spanish query retrieves thin sources exactly when the
      // answer has already lost its summary.
      const chunks = await retrieve(lastUser, { state, lang });
      answerText = degradedAnswer(
        formatRetrievedSources(chunks, state),
        lang,
        // HOW MANY TIMES, not just whether. A boolean could only ever pick
        // between DEGRADE and DEGRADE_AGAIN — so a THIRD (or fourth, fifth…)
        // degrade in the same conversation kept getting DEGRADE_AGAIN's
        // reworded refusal verbatim again, which is exactly the "still not
        // listening" failure DEGRADE_AGAIN itself exists to avoid, just one
        // repeat later. See DEGRADE_ESCALATE in lang.ts.
        messages.filter(
          (m) => m.role === "assistant" && degradeLeads(lang).some((l) => m.content.includes(l)),
        ).length,
      );
      finalChecks = verifyCitations(answerText, retrievedCitations, state, retrievedText);
      yield { type: "delta", text: answerText };
    }
  }

  // --- Trailer: citation verdicts + freshness -------------------------------
  // Surface, never silently strip — honesty over a tidy-looking answer.
  // The verdict leads: CERTAIN/UNCERTAIN + why + what to check. The detailed
  // citation breakdown follows for anyone who wants it.
  const verdict = assessCertainty(
    {
      checks: finalChecks,
      outcome,
      state,
      stateVerified: isVerifiedState(state ?? null),
      // Threaded from the distress gate above, so a crisis reply is not
      // hedged for lacking a regulation it was never making a claim about.
      distress: distressed,
    },
    lang,
  );
  // A DEGRADED ANSWER GETS NO APPARATUS. The whole content of one is "I could
  // not check this against the rules I have" — so a certainty banner, a list of
  // sections we checked, and a dated source line attached underneath are
  // citations for a claim that was never made. In a real transcript the same
  // person received that furniture five times in a row beneath five identical
  // refusals, which is most of what made it read as a machine going through
  // motions rather than a thing that had run out of road.
  //
  // The freshness line stays: it is one short sentence, it is true of the
  // conversation rather than of this answer, and it carries the source link.
  const degraded = outcome === "degraded";
  const banner = degraded ? "" : formatCertaintyBanner(verdict, lang);
  // Both open with a horizontal rule; only the first one should keep it.
  const trailer = degraded
    ? ""
    : formatCitationTrailer(finalChecks, lang).replace(/^\n\n---\n/, "");
  const freshness = formatFreshnessFooter(new Date(), CORPUS_EFFECTIVE_DATE, state, lang);
  const trailerText = [banner, trailer ? `\n\n${trailer}` : "", freshness].filter(Boolean).join("");
  if (trailerText) yield { type: "trailer", text: trailerText };

  events?.onVerified?.(outcome, finalChecks);
  events?.onUsage?.(usageIn, usageOut);

  // --- Audit (best-effort; the sink must never throw) -----------------------
  const bareQuestion = meta?.question ? redactPii(meta.question.slice(0, 4000)).redacted : "";
  const record: MaeAuditRecord = {
    staffUserId: meta?.staffUserId ?? null,
    questionRedacted: bareQuestion || lastUser,
    answer: answerText,
    citations: finalChecks,
    unrecognizedCount: finalChecks.filter((c) => c.status === "unrecognized").length,
    piiRedactions,
    // The model that ACTUALLY generated this answer, not the pin — otherwise a
    // comparison run would write the pin's name onto every row and the audit
    // log would disagree with what happened.
    model: modelUsed,
    corpusDate: CORPUS_EFFECTIVE_DATE,
    mode: meta?.mode,
    scopeState: state ?? null,
    scopeRef: meta?.scopeRef ?? null,
    sessionId: meta?.sessionId ?? null,
    turnIndex: meta?.turnIndex ?? null,
    verifierOutcome: outcome,
    // Which FORM question stopped them, not what they typed. Aggregating
    // topics is how we learn where people get stuck without retaining text.
    questionTopic: classifyQuestionTopic(lastUser),
    certainty: verdict.level,
    certaintyCode: verdict.code,
    retrievalMode: retrievalMode(),
    distress: distressed,
    // Summed over the whole answer, retry included — see MaeAuditRecord. Until
    // this landed, spend could not be attributed to a turn, a state, the retry
    // path, or the separate extraction call.
    inputTokens: usageIn,
    outputTokens: usageOut,
  };
  try {
    await audit(record);
  } catch {
    consoleAuditSink(record);
  }
}
