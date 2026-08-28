// POST /api/demeter/worksheet — the live estimate behind the public chat's
// right rail.
//
// STATELESS ON PURPOSE, and that is the whole difference from /api/screen:
//   - /api/screen is the accounts-gated CBO path. It resolves an identity,
//     creates and persists a screening, and enforces a 5-screening guest cap.
//   - this route persists NOTHING and knows no identity. The accumulated facts
//     live in the browser's React state and are posted back each turn. Close
//     the tab and it is gone. That is what "anonymous-first" has to mean for a
//     panel that shows someone's own income on screen.
//
// COST: this is a SECOND model call per turn, on top of the answer. It is the
// bounded tool-call extraction (short output), not another 4k-token answer, so
// it is a fraction of the answer's cost rather than a doubling — but it is not
// free, and it counts against the same monthly ceiling. It therefore:
//   - passes through the SAME usage gate as the answer, and
//   - FAILS SOFT. Any failure returns 200 with the facts unchanged, because a
//     worksheet that cannot update must never take the answer down with it.
//
// A verified state is REQUIRED. snap-rules is state-keyed, so there is no
// honest federal-floor benefit calculation to show; the client hides the rail
// entirely rather than render an estimate it cannot stand behind.

import { NextResponse, after, type NextRequest } from "next/server";
import { screenHousehold, type PartialFacts } from "@civica/demeter-engine";
import { VERIFIED_STATE_CODES } from "@civica/demeter-engine/packs";
import {
  checkUsageGate,
  settleSpend,
  costUsd,
  estimateTokensFromChars,
} from "../../../../lib/demeter-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : null) || req.headers.get("x-real-ip") || "unknown";
}

/** Unchanged facts + no classification: the shape every soft failure returns. */
function unchanged(facts: PartialFacts) {
  return NextResponse.json({ facts, classification: null });
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const facts = (b.facts && typeof b.facts === "object" ? b.facts : {}) as PartialFacts;

  // Every downstream failure mode returns the facts the client already had, so
  // the rail freezes rather than emptying itself mid-conversation.
  if (!apiKey) return unchanged(facts);

  const state = typeof b.state === "string" ? b.state.toUpperCase() : null;
  if (!state || !VERIFIED_STATE_CODES.includes(state)) return unchanged(facts);

  const rawMessages = Array.isArray(b.messages) ? b.messages : [];
  const messages = rawMessages
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        !!m &&
        typeof m === "object" &&
        (( m as { role?: unknown }).role === "user" ||
          (m as { role?: unknown }).role === "assistant") &&
        typeof (m as { content?: unknown }).content === "string",
    )
    .slice(-20);
  if (messages.length === 0) return unchanged(facts);

  // Same ceiling as the answer. Over it, the answer's own gate will already be
  // telling the user; the rail just stops updating rather than double-reporting.
  const gate = await checkUsageGate(clientIp(req));
  if (!gate.allowed) return unchanged(facts);

  try {
    const result = await screenHousehold({
      messages,
      facts,
      state,
      apiKey,
      signal: req.signal,
      // ONLY THE CLIENT KNOWS (#966). It windows the conversation it posts;
      // the server sees a list and cannot tell a short conversation from a
      // truncated one. This decides whether an empty household/income array
      // means "they told me they have none" or "not mentioned in what I read",
      // and getting it wrong silently wipes a known household. The route
      // re-slices to 20 above, so a payload already at the cap cannot claim
      // completeness however it was labelled.
      windowComplete: b.windowComplete === true && rawMessages.length <= 20,
    });
    // ATTRIBUTED TO THE VISITOR, like the chat route. Without the ip arg this
    // spend lands only in the GLOBAL bucket, so an abuser driving cost through
    // worksheet calls never trips the per-IP daily cap — they just exhaust the
    // shared monthly budget and every real applicant sees "at capacity"
    // (launch audit 2026-08-28).
    const spendIp = clientIp(req);
    after(async () => {
      await settleSpend(
        costUsd(
          result.usage.inputTokens ||
            estimateTokensFromChars(JSON.stringify(messages).length),
          result.usage.outputTokens,
        ),
        new Date(),
        spendIp,
      );
    });
    return NextResponse.json({
      facts: result.facts,
      classification: result.classification,
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "AbortError" || req.signal.aborted)) {
      return unchanged(facts);
    }
    console.error("[demeter/worksheet] screening failed:", err);
    return unchanged(facts);
  }
}
