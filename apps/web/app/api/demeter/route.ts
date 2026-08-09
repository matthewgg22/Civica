// POST /api/demeter — the PUBLIC Demeter chat (anonymous-first, CEO D3.3/T5).
//
// THIN WRAPPER (eng review 5A): the pipeline — PII redaction, state-threaded
// retrieval, incremental citation verification with retry-then-degrade, the
// distress gate, EN/ES answers with the numeric-equivalence check — lives ONCE
// in @civica/demeter-engine. This route supplies what is public-web-specific:
//   - the durable usage gate (per-IP rate window + monthly spend ceiling,
//     Supabase-backed, fail-open — the Console cap is the hard backstop);
//   - spend settle via after() with actual token usage (chars/4 estimate on
//     the abort path where the SDK reports none);
//   - NO auth: anonymous is the product; there are no accounts on this path.
//
// State semantics (T-C): the client sends an explicit verified-state code or
// null. NULL MEANS THE FEDERAL FLOOR — a public user never inherits a default
// state. Unknown/absent state values normalize to null.

import { NextResponse, after, type NextRequest } from "next/server";
import {
  answerQuestion,
  parseMessages,
  warmupEmbeddings,
  STREAM_RECOMPOSE_MARKER,
} from "@civica/demeter-engine";
import { VERIFIED_STATE_CODES } from "@civica/demeter-engine/packs";
import {
  checkUsageGate,
  settleSpend,
  costUsd,
  estimateTokensFromChars,
} from "../../../lib/demeter-usage";
import { publicAuditSink } from "../../../lib/demeter-audit-sink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per-cold-start model warmup: route-module scope only (never the package
// barrel — SSG workers must not pay the 23MB load). Fire-and-forget.
warmupEmbeddings();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : null) || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Demeter is not configured yet.", reason: "unconfigured" },
      { status: 503 },
    );
  }

  // --- Durable usage gate (rate window counts this request) -----------------
  const gate = await checkUsageGate(clientIp(req));
  if (!gate.allowed) {
    if (gate.reason === "rate_limited") {
      return NextResponse.json(
        { error: "Too many questions at once — try again in a minute.", reason: "rate_limited" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    return NextResponse.json(
      {
        error:
          "Demeter is at capacity for the month. For SNAP questions right now, " +
          "call your state SNAP agency or 211.",
        reason: "at_capacity",
      },
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
  const b = body as Record<string, unknown>;
  // Explicit verified state or the federal floor — never a default state.
  const rawState = typeof b.state === "string" ? b.state.toUpperCase() : null;
  const state = rawState && VERIFIED_STATE_CODES.includes(rawState) ? rawState : null;
  const lang: "en" | "es" = b.lang === "es" ? "es" : "en";
  // CBO referral attribution (T-D/D3.6): an opaque code, never identity.
  const rawRef = typeof b.ref === "string" ? b.ref.slice(0, 64) : null;

  // --- Answer, adapting engine frames to a plain-text stream ----------------
  const encoder = new TextEncoder();
  let usageIn = 0;
  let usageOut = 0;
  let emittedChars = 0;

  const frames = answerQuestion({
    messages: parsed.messages,
    audience: "public",
    state, // null = federal floor
    lang,
    apiKey,
    signal: req.signal,
    events: {
      audit: publicAuditSink,
      onUsage: (i, o) => {
        usageIn = i;
        usageOut = o;
      },
    },
    meta: { staffUserId: null, mode: "public", scopeRef: rawRef },
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const enqueue = (text: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          closed = true;
        }
      };
      try {
        for await (const frame of frames) {
          if (frame.type === "delta" || frame.type === "trailer") {
            emittedChars += frame.text.length;
            enqueue(frame.text);
          } else if (frame.type === "recompose") {
            enqueue(STREAM_RECOMPOSE_MARKER);
          }
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("[demeter] public stream error:", err);
          enqueue("Demeter is temporarily unavailable. Please try again in a moment.");
        }
      }
      if (!closed) {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  // Spend settle AFTER the response finishes — via after(), never
  // fire-and-forget (a frozen lambda drops those; eng review T-B). When the
  // engine aborted attempt 1 mid-stream the SDK reports no usage — estimate
  // both directions from characters.
  after(async () => {
    const inTok = usageIn || estimateTokensFromChars(JSON.stringify(parsed.messages).length);
    const outTok = usageOut || estimateTokensFromChars(emittedChars);
    await settleSpend(costUsd(inTok, outTok));
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
