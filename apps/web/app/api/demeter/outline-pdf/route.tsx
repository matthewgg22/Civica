// Download the outlined application as a PDF.
//
// NO AUTH, deliberately — and this is the one place in the product where that
// is the safer choice. The document is composed entirely from facts the caller
// posts in the request body, which are the facts already on their own screen.
// Nothing is read from the database and nothing is written to it, so there is
// no other person's data this could reach. Requiring sign-in would mean the
// one artefact someone can walk away with is locked behind an account, which
// is exactly the wrong thing to gate for a person who came here worried about
// being tracked.
//
// The emailed copy is different and does require sign-in: sending needs an
// address, and an address has to come from a session rather than a body.

import { after, NextResponse, type NextRequest } from "next/server";
import { recordDemeterEvent } from "../../../../lib/demeter-events";
import { renderToBuffer } from "@react-pdf/renderer";
import { OutlinePdf } from "../../../../lib/outline-pdf";
import type { OutlineInput } from "../../../../lib/demeter-outline";
import type { PartialFacts } from "@civica/demeter-engine";

export const runtime = "nodejs";

/** Bounds on a body that becomes a rendered document. Generous next to any
 *  real household and small enough that this cannot be used to make the
 *  renderer chew through an arbitrary payload. */
const MAX_STILL_NEEDED = 20;
const MAX_FIELD_CHARS = 200;

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const facts = (body.facts ?? {}) as PartialFacts;
  const empty =
    !facts.household?.length &&
    !facts.income?.length &&
    facts.shelter?.rent === undefined &&
    facts.assets === undefined;
  // An empty document would be a page of headings and nothing else — worse
  // than no download, because it looks like the product produced something.
  if (empty) return NextResponse.json({ error: "nothing_to_render" }, { status: 400 });

  const str = (k: string): string | null => {
    const v = body[k];
    return typeof v === "string" && v ? v.slice(0, MAX_FIELD_CHARS) : null;
  };

  const input: OutlineInput = {
    facts,
    stateName: str("stateName"),
    agency: str("agency"),
    portalName: str("portalName"),
    portalNote: str("portalNote"),
    portalUrl: str("portalUrl"),
    stillNeeded: Array.isArray(body.stillNeeded)
      ? (body.stillNeeded as unknown[])
          .filter((x): x is string => typeof x === "string")
          .slice(0, MAX_STILL_NEEDED)
          .map((x) => x.slice(0, MAX_FIELD_CHARS))
      : [],
    // Finished sentences only — see OutlineInput.notes on why this is not the
    // transcript. Bounded the same way stillNeeded is: this comes from a
    // client, so it gets the same count and length caps rather than new ones.
    notes: Array.isArray((body as { notes?: unknown }).notes)
      ? ((body as { notes: unknown[] }).notes)
          .filter((x): x is string => typeof x === "string")
          .slice(0, MAX_STILL_NEEDED)
          .map((x) => x.slice(0, MAX_FIELD_CHARS))
      : [],
    generatedAt: new Date(),
  };

  const buffer = await renderToBuffer(<OutlinePdf input={input} />);

  // The filename carries the state and the date, because this ends up in a
  // downloads folder beside everything else someone saved that week.
  const slug = input.stateName ? input.stateName.toLowerCase().replace(/[^a-z]+/g, "-") : "snap";
  const filename = `outlined-application-${slug}-${input.generatedAt.toISOString().slice(0, 10)}.pdf`;

  // Recorded on the response actually being produced, not on the click:
  // an intent that 500s is not a conversion.
  after(() =>
    recordDemeterEvent({
      kind: "conversion",
      event: "pdf_downloaded",
      status: 200,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : null,
      scopeState: typeof body.stateName === "string" ? body.stateName : null,
    }),
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Personal, and generated per request — never let anything cache it.
      "Cache-Control": "no-store, private",
    },
  });
}
