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
import { VERIFIED_STATE_CODES, napJurisdiction, isAnswerLang, type AnswerLang } from "@civica/demeter-engine/packs";
import { napHandoff } from "../../../lib/nap-handoff";
import {
  checkUsageGate,
  settleSpend,
  costUsd,
  estimateTokensFromChars,
} from "../../../lib/demeter-usage";
import { publicAuditSink } from "../../../lib/demeter-audit-sink";
import { recordDemeterEvent } from "../../../lib/demeter-events";

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
    // EVERY REFUSAL IS RECORDED FROM HERE DOWN (#1049 follow-on). These
    // returns all happen before the audit sink exists, so someone who hit a
    // wall and left used to be invisible — and "how often does a real person
    // hit a wall" could not be asked at all.
    //
    // NO session_id ON THE GATE FAILURES, deliberately. The body has not been
    // parsed yet, and parsing it before the abuse gate would mean doing work
    // for exactly the traffic the gate exists to refuse. The COUNT is the
    // number that matters here; session linkage resumes below, once the body
    // is in hand.
    after(() => recordDemeterEvent({ kind: "failure", event: "unconfigured", status: 503 }));
    return NextResponse.json(
      { error: "Demeter is not configured yet.", reason: "unconfigured" },
      { status: 503 },
    );
  }

  // --- Durable usage gate (rate window counts this request) -----------------
  const ip = clientIp(req);
  const gate = await checkUsageGate(ip);
  if (!gate.allowed) {
    if (gate.reason === "rate_limited") {
      after(() => recordDemeterEvent({ kind: "failure", event: "rate_limited", status: 429 }));
      return NextResponse.json(
        { error: "Too many questions at once, try again in a minute.", reason: "rate_limited" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    if (gate.reason === "ip_daily_cap") {
      // Distinct from at_capacity ON PURPOSE. "The service is full" and
      // "you personally have used a lot today" are different facts, and
      // telling someone the service is down when it isn't would send a real
      // applicant away for no reason. Names 211 either way so the message is
      // never a dead end.
      after(() => recordDemeterEvent({ kind: "failure", event: "ip_daily_cap", status: 429 }));
      return NextResponse.json(
        {
          error:
            "You've asked a lot of questions today, this resets tomorrow. " +
            "If you need help now, call your state SNAP agency or 211.",
          reason: "ip_daily_cap",
        },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }
    after(() => recordDemeterEvent({ kind: "failure", event: "at_capacity", status: 503 }));
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
    after(() => recordDemeterEvent({ kind: "failure", event: "bad_request", status: 400, detail: { cause: "invalid_json" } }));
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = parseMessages(body);
  if ("error" in parsed) {
    // The reason CODE, never the message — parseMessages echoes limits, not
    // content, but this table takes no free text on principle.
    after(() =>
      recordDemeterEvent({
        kind: "failure",
        event: "bad_request",
        status: 400,
        detail: { cause: "invalid_messages" },
      }),
    );
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  // Explicit verified state or the federal floor — never a default state.
  const rawState = typeof b.state === "string" ? b.state.toUpperCase() : null;
  const state = rawState && VERIFIED_STATE_CODES.includes(rawState) ? rawState : null;
  // All four answer languages, not en|es. This clamp predated Vietnamese and
  // Simplified Chinese (added to the engine "end to end" the day after #603
  // shipped this line) and silently narrowed every vi/zh reader's answer to
  // English — the localized UI sent lang:"vi"/"zh", the model got "en". The
  // engine answers in all of ANSWER_LANGS; validate against that set instead
  // (launch audit 2026-08-28).
  const lang: AnswerLang = isAnswerLang(b.lang) ? b.lang : "en";

  // NAP TERRITORIES SHORT-CIRCUIT, BEFORE THE MODEL.
  //
  // Puerto Rico, American Samoa and the Northern Mariana Islands do not run
  // SNAP. USDA: NAP block grants provide food assistance there "in lieu of"
  // SNAP, and "the U.S. territories establish eligibility and benefit levels"
  // themselves. Federal SNAP rules are not a floor in those places — they do
  // not apply at all.
  //
  // So there is nothing for the model to be right about, and every incentive
  // for it to be confidently wrong: it has a corpus full of SNAP income limits
  // and deductions and no reason to know they are inapplicable here. Answering
  // deterministically costs no tokens and cannot fabricate. Falling through to
  // the federal floor, which is correct for any unverified STATE, is precisely
  // the wrong behaviour for these three.
  //
  // NOT audited. mae_query_log is the accuracy record — one row per MODEL
  // answer, carrying citations, a verifier outcome and a certainty code. This
  // is none of those, and writing a synthetic row would put non-answers into
  // the dataset the accuracy work is measured on. How many people arrive from a
  // NAP territory is a real and useful number, and it deserves its own counter
  // rather than a fake row in this one. Filed separately.
  const nap = napJurisdiction(rawState);
  if (nap) {
    // napHandoff is en|es only (the three NAP territories are a tiny,
    // non-SNAP population); a vi/zh reader there gets the English handoff until
    // that message is translated. Narrow here rather than widen napHandoff.
    return new Response(napHandoff(nap, lang === "es" ? "es" : "en"), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  // CBO referral attribution (T-D/D3.6): an opaque code, never identity.
  const rawRef = typeof b.ref === "string" ? b.ref.slice(0, 64) : null;
  // Anonymous funnel grouping. Validated as a UUID rather than trusted: this
  // reaches a uuid column, and an arbitrary client string would either error
  // the insert or become a free-text field nobody sanctioned.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sessionId =
    typeof b.sessionId === "string" && UUID_RE.test(b.sessionId) ? b.sessionId : null;
  const turnIndex =
    typeof b.turnIndex === "number" && Number.isInteger(b.turnIndex) && b.turnIndex > 0
      ? Math.min(b.turnIndex, 1000)
      : null;

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
    meta: {
      staffUserId: null,
      mode: "public",
      scopeRef: rawRef,
      sessionId,
      turnIndex,
      // ask | estimate. Clamped to the two labels — this is client input
      // headed for an analytics column, and the events table's no-free-text
      // rule applies in spirit here too.
      worksheetMode:
        (body as { worksheetMode?: unknown }).worksheetMode === "estimate"
          ? "estimate"
          : (body as { worksheetMode?: unknown }).worksheetMode === "ask"
            ? "ask"
            : null,
    },
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
    // Same ip the gate used, so the per-IP daily bucket actually accumulates.
    await settleSpend(costUsd(inTok, outTok), new Date(), ip);
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
