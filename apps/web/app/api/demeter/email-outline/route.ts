// Email someone their outlined application.
//
// The point of the product is that a conversation ends with a document you can
// put beside the real application. Until now that document existed only on the
// screen it was built on: close the tab and it was gone, and the one thing a
// person most wants to keep was the one thing they could not take with them.
//
// SENDS ONLY TO THE SIGNED-IN ADDRESS. Never to an address in the request
// body. This route composes personal information — household, income, rent —
// into one document, and a body-supplied recipient would turn it into a way to
// mail someone else's situation anywhere. The address comes from the session
// and nowhere else, which also means there is no address field to get wrong.

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import { mailConfigured, sendMail } from "../../../../lib/mail";
import { outlineToText, type OutlineInput } from "../../../../lib/demeter-outline";
import type { PartialFacts } from "@civica/demeter-engine";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Configuration is checked BEFORE auth so an operator hitting this in a
  // half-provisioned environment gets the real answer rather than a login wall.
  if (!mailConfigured()) {
    return NextResponse.json({ error: "mail_not_configured" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "sign_in_required" }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: "no_email_on_account" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const facts = (body.facts ?? {}) as PartialFacts;
  const stillNeeded = Array.isArray(body.stillNeeded)
    ? (body.stillNeeded as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 20)
    : [];

  // Nothing gathered means nothing to send. Mailing an empty template would
  // read as the product failing rather than as there being nothing yet.
  const empty =
    !facts.household?.length &&
    !facts.income?.length &&
    facts.shelter?.rent === undefined &&
    facts.assets === undefined;
  if (empty) return NextResponse.json({ error: "nothing_to_send" }, { status: 400 });

  const str = (k: string): string | null =>
    typeof body[k] === "string" && body[k] ? (body[k] as string) : null;

  const input: OutlineInput = {
    facts,
    stateName: str("stateName"),
    agency: str("agency"),
    portalName: str("portalName"),
    portalUrl: str("portalUrl"),
    stillNeeded,
    generatedAt: new Date(),
  };

  const result = await sendMail({
    to: user.email,
    subject: input.stateName
      ? `Your outlined SNAP application, ${input.stateName}`
      : "Your outlined SNAP application",
    text: outlineToText(input),
  });

  if (!result.ok) {
    // The provider's reason travels back. Every failure looking identical is
    // exactly what made the save path impossible to diagnose from a report.
    console.error("[email-outline] send failed:", result.reason, result.detail ?? "");
    return NextResponse.json(
      { error: "send_failed", reason: result.reason },
      { status: result.reason === "not_configured" ? 503 : 502 },
    );
  }

  // The address is echoed so the confirmation can name it — someone with more
  // than one account needs to know WHICH inbox to look in.
  return NextResponse.json({ sent: true, to: user.email });
}
