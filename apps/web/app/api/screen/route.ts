// POST /api/screen — one turn of the CBO screening tool.
//
// Deliberately NOT streaming (unlike /api/demeter): screenHousehold makes a
// single bounded tool-call extraction, not a long-form generated answer, so
// there's nothing to stream — the whole point of forcing tool_choice is a
// small, immediate JSON result. Same spend gate as the public chat, though:
// this calls the same Anthropic account and must count against the same
// ceiling, or a screening loop could spend outside it unmetered.
//
// body: { screeningId?: string, message: string, state?: string }
//   - screeningId omitted → create a new screening (guest cap enforced here;
//     org members have none). `state` sets it — required for a guest,
//     defaulted to the org's own state for an org member.
//   - screeningId present → continue it. `state` is ignored; the screening
//     keeps the state it was created with.

import { NextResponse, after, type NextRequest } from "next/server";
import { screenHousehold } from "@civica/demeter-engine";
import { checkUsageGate, settleSpend, costUsd, estimateTokensFromChars } from "../../../lib/demeter-usage";
import { resolveScreeningIdentity } from "../../../lib/screening-auth";
import {
  loadScreening,
  createScreening,
  saveScreeningTurn,
  GuestCapReachedError,
  type ScreeningMessage,
} from "../../../lib/screening-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : null) || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Screening is not configured yet.", reason: "unconfigured" }, { status: 503 });
  }

  const gate = await checkUsageGate(clientIp(req));
  if (!gate.allowed) {
    if (gate.reason === "rate_limited") {
      return NextResponse.json(
        { error: "Too many requests — try again in a minute.", reason: "rate_limited" },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }
    return NextResponse.json(
      { error: "Screening is at capacity for the month.", reason: "at_capacity" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as { screeningId?: unknown; message?: unknown; state?: unknown };
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

  const identity = await resolveScreeningIdentity();

  let screening;
  if (typeof b.screeningId === "string" && b.screeningId) {
    screening = await loadScreening(b.screeningId, identity);
    if (!screening) {
      return NextResponse.json({ error: "Screening not found" }, { status: 404 });
    }
  } else {
    const state =
      typeof b.state === "string" && b.state
        ? b.state.toUpperCase()
        : identity.kind === "org"
          ? identity.stateCode
          : null;
    if (!state) {
      return NextResponse.json({ error: "state is required to start a screening" }, { status: 400 });
    }
    try {
      screening = await createScreening(identity, state);
    } catch (err) {
      if (err instanceof GuestCapReachedError) {
        return NextResponse.json(
          { error: "Guest screening limit reached — sign in to keep going.", reason: "guest_cap_reached" },
          { status: 403 },
        );
      }
      throw err;
    }
  }

  const messages: ScreeningMessage[] = [...screening.messages, { role: "user", content: message }];

  let usageIn = 0;
  let usageOut = 0;
  try {
    const result = await screenHousehold({
      messages,
      facts: screening.facts,
      state: screening.stateCode,
      apiKey,
      signal: req.signal,
    });
    usageIn = result.usage.inputTokens;
    usageOut = result.usage.outputTokens;

    // The worksheet updates even on a pure-question turn (extractedNothing);
    // the messages array is the record of the conversation regardless.
    await saveScreeningTurn(screening.id, identity, {
      facts: result.facts,
      messages,
      outcome: result.classification.outcome,
    });

    after(async () => {
      const inTok = usageIn || estimateTokensFromChars(JSON.stringify(messages).length);
      const outTok = usageOut || estimateTokensFromChars(JSON.stringify(result.classification).length);
      await settleSpend(costUsd(inTok, outTok));
    });

    return NextResponse.json({
      screeningId: screening.id,
      caseLabel: screening.caseLabel,
      state: screening.stateCode,
      facts: result.facts,
      classification: result.classification,
      extractedNothing: result.extractedNothing,
    });
  } catch (err) {
    console.error("[screen] turn failed:", err instanceof Error ? err.message : String(err));
    after(async () => {
      const inTok = estimateTokensFromChars(JSON.stringify(messages).length);
      await settleSpend(costUsd(inTok, 0));
    });
    return NextResponse.json(
      { error: "Screening is temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }
}
