// POST /api/mae — caseworker "Ask Mae" SNAP policy Q&A.
//
// Staff-auth-gated (same gate as /api/uat-feedback: Supabase session + a staff
// role in app_metadata). Streams an Opus 4.8 answer back as plain text. The
// system prompt (lib/mae/system-prompt.ts) scopes Mae to SNAP/CalFresh, makes
// it cite 7 CFR 273, refuse non-SNAP + PII, and frame answers as guidance.
//
// Why a Next route handler (not the enrollment-api gateway): this is a same-
// origin, cookie-authed dashboard surface. Going through the Workers gateway
// would mean minting/forwarding a JWT for an LLM call that only staff inside the
// dashboard make. Co-locating keeps auth trivial (the existing cookie session)
// and the API key server-side in the dashboard's own env.
//
// Activation gate: ANTHROPIC_API_KEY must be set in the dashboard's environment
// (Vercel project env). Until then the route returns 503 and the UI shows a
// "not configured" message rather than crashing.

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClientFromCookies } from "../../../lib/supabase";
import { isStaff } from "../../../lib/roleRouting";
import { buildMaeSystem, MAE_GENERATION } from "../../../lib/mae/answer";
import { verifyCitations, formatCitationTrailer } from "../../../lib/mae/citation-verifier";
import { redactPii } from "../../../lib/mae/pii";
import { logMaeQuery } from "../../../lib/mae/audit";
import { CORPUS_EFFECTIVE_DATE } from "../../../lib/mae/retrieval";
import { formatFreshnessFooter } from "../../../lib/mae/freshness";

// The Anthropic SDK requires the Node runtime (not edge). Auth + LLM call are
// inherently dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Abuse / cost bounds. Staff-gating is the primary control; these cap a single
// request so a stuck client or a pasted wall of text can't run up token spend.
const MAX_MESSAGES = 20;
const MAX_CHARS_PER_MESSAGE = 8_000;
const MAX_TOTAL_CHARS = 40_000;
const MAX_OUTPUT_TOKENS = 4_096;

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

/** Validate the client-supplied conversation. Returns a clean array or an error string. */
function parseMessages(raw: unknown): { messages: ChatMessage[] } | { error: string } {
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
  // The Messages API requires the first turn to be from the user and the last
  // (the turn we're answering) to be from the user as well.
  if (messages[0].role !== "user") return { error: "Conversation must start with a user message" };
  if (messages[messages.length - 1].role !== "user") {
    return { error: "The last message must be from the user" };
  }
  return { messages };
}

export async function POST(req: NextRequest) {
  // --- Auth: staff only, UNLESS public-preview mode is explicitly enabled ----
  // NEXT_PUBLIC_MAE_PREVIEW=true opens Mae on the public /cbo-preview demo for
  // anonymous visitors. Default OFF → prod stays staff-gated. Even when on, PII
  // is redacted, per-request caps apply, and the system prompt scopes/refuses.
  // (No per-IP rate limit on this route yet — add one before enabling in prod.)
  const previewPublic = process.env.NEXT_PUBLIC_MAE_PREVIEW === "true";
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!previewPublic) {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = (user.app_metadata as { role?: unknown } | null)?.role;
    if (!isStaff(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // --- Config gate ----------------------------------------------------------
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Mae is not configured yet (ANTHROPIC_API_KEY is unset)." },
      { status: 503 },
    );
  }

  // --- Validate input -------------------------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseMessages(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // --- Redact applicant PII before anything leaves the server ---------------
  // Scrub structured identifiers (SSN/phone/email/DOB/account numbers) from
  // every message BEFORE retrieval, the API call, and the audit log. Mae answers
  // policy questions; a specific person's identifiers add nothing to them.
  let piiRedactions = 0;
  const messages = parsed.messages.map((m) => {
    const { redacted, found } = redactPii(m.content);
    piiRedactions += found;
    return { role: m.role, content: redacted };
  });

  // --- Assemble the grounded system prompt (shared with the eval) -----------
  const lastUser = messages[messages.length - 1].content;
  const { systemBlocks, retrievedCitations } = await buildMaeSystem(lastUser);

  // --- Stream the answer ----------------------------------------------------
  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let emittedAny = false;
      let closed = false;
      const safeEnqueue = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true; // controller cancelled by a disconnected client
        }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };
      let answerText = "";
      try {
        const mae = client.messages.stream(
          {
            ...MAE_GENERATION,
            max_tokens: MAX_OUTPUT_TOKENS,
            // Frozen system prompt as a cached block + per-question source text.
            system: systemBlocks,
            messages, // PII already redacted
          },
          // Stop generating (and stop billing) if the caseworker closes the panel.
          { signal: req.signal },
        );

        mae.on("text", (delta) => {
          emittedAny = true;
          answerText += delta;
          safeEnqueue(delta);
        });

        const final = await mae.finalMessage();

        // Safety refusal with no surfaced text — give the caseworker something.
        if (!emittedAny) {
          safeEnqueue(
            final.stop_reason === "refusal"
              ? "I can't help with that request. I'm scoped to SNAP/CalFresh policy questions."
              : "Mae couldn't generate a response. Please try rephrasing.",
          );
        }

        // Citation check: classify every citation Mae wrote against the text we
        // actually retrieved for this question, and append the result so the
        // caseworker sees which cites are source-backed vs. unrecognized. We
        // surface, never silently strip — honesty over a tidy-looking answer.
        const checks = verifyCitations(answerText, retrievedCitations);
        const trailer = formatCitationTrailer(checks);
        if (trailer) safeEnqueue(trailer);
        // Freshness: an explicit "sources as of …" line (+ staleness warnings)
        // on every substantive answer, so no one relies on expired rules.
        if (emittedAny) safeEnqueue(formatFreshnessFooter(new Date(), CORPUS_EFFECTIVE_DATE));
        safeClose();

        // Audit (best-effort, never blocks the answer): a PII-scrubbed record of
        // the query, citations + their verifier status, and versions.
        void logMaeQuery({
          staffUserId: user?.id ?? null,
          questionRedacted: lastUser,
          answer: answerText,
          citations: checks,
          unrecognizedCount: checks.filter((c) => c.status === "unrecognized").length,
          piiRedactions,
          model: MAE_GENERATION.model,
          corpusDate: CORPUS_EFFECTIVE_DATE,
        });
      } catch (err) {
        // Client aborted — not an error worth surfacing.
        if (err instanceof Error && err.name === "AbortError") {
          safeClose();
          return;
        }
        console.error("[mae] stream error:", err);
        // If we haven't sent anything yet, the client treats a short error
        // string as the answer body. Once mid-stream, just close.
        if (!emittedAny) {
          safeEnqueue("Mae is temporarily unavailable. Please try again in a moment.");
        }
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
