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
import { resolveScreeningIdentity, GUEST_CAP } from "../../../lib/screening-auth";
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
        { error: "Too many requests, try again in a minute.", reason: "rate_limited" },
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
  let createdNew = false;
  try {
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
      screening = await createScreening(identity, state);
      createdNew = true;
    }
  } catch (err) {
    if (err instanceof GuestCapReachedError) {
      return NextResponse.json(
        { error: "Guest screening limit reached, sign in to keep going.", reason: "guest_cap_reached" },
        { status: 403 },
      );
    }
    // A store failure (unconfigured Supabase, network outage) is distinct
    // from an engine failure below — screenings genuinely can't exist
    // without persistence, so this can't fail open like guest identity
    // resolution does. But it must still surface as the same clean JSON
    // shape every other failure in this route returns, not an unhandled
    // exception leaking Next's generic error page.
    console.error("[screen] store unavailable:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Screening storage is temporarily unavailable. Please try again.", reason: "store_unavailable" },
      { status: 503 },
    );
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

    // Per-IP attribution (launch audit 2026-08-28): screen spend was landing
    // only in the global bucket, so the ip_daily_cap never saw it — an abuser
    // could run the budget dry through /api/screen alone.
    const spendIp = clientIp(req);
    after(async () => {
      const inTok = usageIn || estimateTokensFromChars(JSON.stringify(messages).length);
      const outTok = usageOut || estimateTokensFromChars(JSON.stringify(result.classification).length);
      await settleSpend(costUsd(inTok, outTok), new Date(), spendIp);
    });

    return NextResponse.json({
      screeningId: screening.id,
      caseLabel: screening.caseLabel,
      state: screening.stateCode,
      facts: result.facts,
      classification: result.classification,
      extractedNothing: result.extractedNothing,
      // Guest screening count AFTER this turn — identity.screeningsUsed was
      // read before this request's own create, so add 1 when this call was
      // the one that created a new screening.
      guestScreeningsLeft:
        identity.kind === "guest"
          ? Math.max(0, GUEST_CAP - (identity.screeningsUsed + (createdNew ? 1 : 0)))
          : null,
    });
  } catch (err) {
    console.error("[screen] turn failed:", err instanceof Error ? err.message : String(err));
    after(async () => {
      const inTok = estimateTokensFromChars(JSON.stringify(messages).length);
      await settleSpend(costUsd(inTok, 0), new Date(), clientIp(req));
    });
    return NextResponse.json(
      { error: "Screening is temporarily unavailable. Please try again." },
      { status: 500 },
    );
  }
}
