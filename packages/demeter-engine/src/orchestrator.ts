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
import { buildMaeSystem, MAE_GENERATION } from "./answer";
import {
  verifyCitations,
  formatCitationTrailer,
  type CitationCheck,
} from "./citation-verifier";
import { redactPii } from "./pii";
import { retrieve, formatRetrievedSources, CORPUS_EFFECTIVE_DATE } from "./retrieval";
import { formatFreshnessFooter } from "./freshness";
import { consoleAuditSink, type MaeAuditRecord, type MaeAuditSink } from "./audit";
import { retrievalMode } from "./embeddings";
import { detectDistress, DISTRESS_SYSTEM_ADDENDUM } from "./distress";
import { verifyNumericEquivalence } from "./numeric-check";

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
  if (messages[0]!.role !== "user") return { error: "Conversation must start with a user message" };
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
  /** Pack state code, or null for the explicit federal floor (public no-state).
   *  undefined preserves the legacy dashboard default (CA). */
  state?: string | null;
  /** Answer language. The corpus and verification stay ENGLISH; an "es" answer
   *  is composed from verified EN content and additionally passes the numeric-
   *  equivalence check (every $ and % must appear in the grounding text). */
  lang?: "en" | "es";
  apiKey: string;
  /** Aborts generation (and billing) when the client disconnects. */
  signal?: AbortSignal;
  events?: AnswerEvents;
  /** Audit metadata (already validated by the caller). */
  meta?: { staffUserId?: string | null; mode?: string; scopeRef?: string | null; question?: string };
}

// How often the incremental verifier runs over accumulated text. Small enough
// to catch a bad citation within a sentence or two of it appearing; large
// enough that the regex pass is negligible next to token latency.
const VERIFY_INTERVAL_CHARS = 350;

function hasUnrecognized(checks: CitationCheck[]): boolean {
  return checks.some((c) => c.status === "unrecognized");
}

/** Build the honest fallback when generation can't be verified twice: the
 *  verbatim retrieved sources, clearly framed. Nothing unverified survives. */
function degradedAnswer(retrievedBlock: string, lang: "en" | "es" = "en"): string {
  // The quoted sources stay in English by design (the verified corpus is EN);
  // only the wrapper localizes, and the ES wrapper says so.
  if (lang === "es") {
    return (
      "No pude componer un resumen cuyas citas se verifiquen todas contra las " +
      "fuentes recuperadas para esta pregunta — así que en lugar de adivinar, " +
      "aquí está el texto fuente literal (en inglés):\n\n" +
      retrievedBlock +
      "\nSi esto no responde tu pregunta, intenta reformularla o contacta a la " +
      "agencia SNAP de tu estado para una respuesta definitiva."
    );
  }
  return (
    "I couldn't compose a summary whose citations all check out against the " +
    "sources retrieved for this question — so instead of guessing, here is the " +
    "verbatim source text itself:\n\n" +
    retrievedBlock +
    "\nIf this doesn't answer your question, try rephrasing it, or contact your " +
    "state SNAP agency for a definitive answer."
  );
}

/** The single answer pipeline. Yields frames; the caller adapts them to its
 *  transport (SSE, plain text stream, buffered JSON). */
export async function* answerQuestion(req: AnswerRequest): AsyncGenerator<AnswerFrame> {
  const { apiKey, signal, events, meta } = req;
  const state = req.state; // undefined = legacy CA default; null = federal floor
  const lang = req.lang ?? "en";
  const audit = events?.audit ?? consoleAuditSink;

  // --- Redact PII before anything leaves the process ------------------------
  let piiRedactions = 0;
  const messages = req.messages.map((m) => {
    const { redacted, found } = redactPii(m.content);
    piiRedactions += found;
    return { role: m.role, content: redacted };
  });
  const lastUser = messages[messages.length - 1]!.content;

  // --- Grounded system prompt (state-threaded; shared with the eval) --------
  const { systemBlocks, retrievedCitations } = await buildMaeSystem(lastUser, state);

  // Distress gate (F2): crisis phrasing → the answer LEADS with immediate help.
  const distressed = detectDistress(lastUser);
  if (distressed) {
    systemBlocks.push({ type: "text", text: DISTRESS_SYSTEM_ADDENDUM });
  }
  // Spanish answers: composed from the verified ENGLISH sources; citations stay
  // verbatim; the numeric-equivalence check below guards translated numbers.
  if (req.lang === "es") {
    systemBlocks.push({
      type: "text",
      text:
        "Responde COMPLETAMENTE en español, con calidez y claridad. Mantén las " +
        "citas legales textualmente en su forma original (p. ej. '7 CFR 273.9') " +
        "y NO traduzcas los números — cada cantidad en dólares y porcentaje debe " +
        "copiarse exactamente de las fuentes provistas.",
    });
  }
  const groundingText = systemBlocks.map((b) => b.text).join("\n");
  const numbersOk = (text: string): boolean =>
    req.lang !== "es" || verifyNumericEquivalence(text, groundingText).pass;

  const client = new Anthropic({ apiKey });
  const generation = {
    ...MAE_GENERATION,
    max_tokens: ANSWER_LIMITS.MAX_OUTPUT_TOKENS,
    system: systemBlocks,
  };

  let outcome: VerifierOutcome = "clean";
  let answerText = "";
  let finalChecks: CitationCheck[] = [];
  let usageIn = 0;
  let usageOut = 0;

  // --- Attempt 1: stream with incremental verification ----------------------
  let aborted = false;
  let emittedAny = false;
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
            const checks = verifyCitations(answerText, retrievedCitations, state);
            if (hasUnrecognized(checks) || !numbersOk(answerText)) {
              aborted = true;
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
        finalChecks = verifyCitations(answerText, retrievedCitations, state);
        if (hasUnrecognized(finalChecks) || !numbersOk(answerText)) {
          aborted = true; // failed on the last unverified tail
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
    const corrective =
      "IMPORTANT: your previous draft cited a source that is not in the provided " +
      "source text. Answer again citing ONLY the sources provided above. If the " +
      "sources don't cover the question, say so plainly instead of citing anything else.";
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
    finalChecks = verifyCitations(retryText, retrievedCitations, state);
    if (retryText && !hasUnrecognized(finalChecks) && numbersOk(retryText)) {
      answerText = retryText;
      yield { type: "delta", text: retryText };
    } else {
      outcome = "degraded";
      const chunks = await retrieve(lastUser, { state });
      answerText = degradedAnswer(formatRetrievedSources(chunks, state), lang);
      finalChecks = verifyCitations(answerText, retrievedCitations, state);
      yield { type: "delta", text: answerText };
    }
  }

  // --- Trailer: citation verdicts + freshness -------------------------------
  // Surface, never silently strip — honesty over a tidy-looking answer.
  const trailer = formatCitationTrailer(finalChecks, lang);
  const freshness = formatFreshnessFooter(new Date(), CORPUS_EFFECTIVE_DATE, state, lang);
  const trailerText = [trailer, freshness].filter(Boolean).join("");
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
    model: MAE_GENERATION.model,
    corpusDate: CORPUS_EFFECTIVE_DATE,
    mode: meta?.mode,
    scopeState: state ?? null,
    scopeRef: meta?.scopeRef ?? null,
    verifierOutcome: outcome,
    retrievalMode: retrievalMode(),
    distress: distressed,
  };
  try {
    await audit(record);
  } catch {
    consoleAuditSink(record);
  }
}
