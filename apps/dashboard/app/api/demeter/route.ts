// POST /api/demeter — staff "Ask Demeter" SNAP policy Q&A (formerly /api/mae).
//
// THIN WRAPPER (eng review 5A): the whole answer pipeline — PII redaction,
// state-threaded retrieval, incremental citation verification with
// retry-then-degrade, trailers, audit — lives ONCE in
// @civica/demeter-engine's answerQuestion(). This route supplies only what is
// dashboard-specific: the staff cookie-auth gate, the Supabase audit sink, and
// the plain-text stream adaptation MaeChat expects.
//
// Why a Next route handler (not the enrollment-api gateway): same-origin,
// cookie-authed dashboard surface; co-locating keeps auth trivial and the API
// key server-side in the dashboard's own env.
//
// Activation gate: ANTHROPIC_API_KEY must be set (Vercel project env). Until
// then the route returns 503 and the UI shows "not configured".

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { answerQuestion, parseMessages, STREAM_RECOMPOSE_MARKER } from "@civica/demeter-engine";
import { createServerClientFromCookies } from "../../../lib/supabase";
import { isStaff } from "../../../lib/roleRouting";
import { supabaseAuditSink } from "../../../lib/mae-audit-sink";

// The Anthropic SDK requires the Node runtime (not edge). Auth + LLM call are
// inherently dynamic.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Re-exported for the route test + MaeChat; the marker itself lives in the engine.
export const RECOMPOSE_MARKER = STREAM_RECOMPOSE_MARKER;

export async function POST(req: NextRequest) {
  // --- Auth: staff only, UNLESS public-preview mode is explicitly enabled ---
  const previewPublic = process.env.NEXT_PUBLIC_MAE_PREVIEW === "true";
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!previewPublic) {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = (user.app_metadata as { role?: unknown } | null)?.role;
    if (!isStaff(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Demeter is not configured yet (ANTHROPIC_API_KEY is unset)." },
      { status: 503 },
    );
  }

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

  // Scope metadata for the audit log (optional + defensively parsed).
  const rawMeta = body && typeof body === "object" ? (body as Record<string, unknown>).meta : null;
  const meta = rawMeta && typeof rawMeta === "object" ? (rawMeta as Record<string, unknown>) : {};
  const mode = meta.mode === "case" ? "case" : "general";
  const scopeState = typeof meta.state === "string" ? meta.state.slice(0, 8) : undefined;
  const scopeRef = typeof meta.ref === "string" ? meta.ref.slice(0, 64) : null;
  const question = typeof meta.question === "string" ? meta.question : undefined;

  const encoder = new TextEncoder();
  const frames = answerQuestion({
    messages: parsed.messages,
    // Legacy dashboard default (CA) when the UI sends no state — the staff
    // surface's historical behavior. Explicit states pass through.
    state: scopeState,
    apiKey,
    signal: req.signal,
    events: { audit: supabaseAuditSink },
    meta: { staffUserId: user?.id ?? null, mode, scopeRef, question },
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
          if (frame.type === "delta" || frame.type === "trailer") enqueue(frame.text);
          else if (frame.type === "recompose") enqueue(RECOMPOSE_MARKER);
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("[demeter] stream error:", err);
          enqueue("Demeter is temporarily unavailable. Please try again in a moment.");
        }
      }
      if (!closed) {
        try { controller.close(); } catch { /* already closed */ }
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
