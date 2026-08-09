// GET /api/screen/:id/export — the case-file PDF (mockup frame 07).
//
// Org members only. A guest never reaches this route with a usable result:
// ScreeningWorksheet only renders the Export PDF button as a real link
// when guestScreeningsLeft === null (the route's own org-vs-guest signal),
// and this route enforces the same rule server-side rather than trusting
// the client not to hand-craft the request — "Export needs an account" is
// a real gate, not just a disabled button.
//
// Recomputes the classification from the STORED facts via classifyScreening
// rather than reading the denormalized outcome column — classifyScreening
// is pure engine logic (no LLM call, no spend), so this is cheap and always
// matches what the live worksheet would show for the same facts.

import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { classifyScreening } from "@civica/demeter-engine";
import { resolveScreeningIdentity } from "../../../../../lib/screening-auth";
import { loadScreening, markScreeningExported } from "../../../../../lib/screening-store";
import { ScreeningPdfDocument } from "../../../../../lib/screening-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identity = await resolveScreeningIdentity();

  if (identity.kind !== "org") {
    return NextResponse.json(
      { error: "Export needs an account — sign in to export this screening.", reason: "requires_account" },
      { status: 403 },
    );
  }

  let screening;
  try {
    screening = await loadScreening(id, identity);
  } catch (err) {
    console.error("[screen/export] store unavailable:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Screening storage is temporarily unavailable. Please try again.", reason: "store_unavailable" },
      { status: 503 },
    );
  }
  if (!screening) {
    return NextResponse.json({ error: "Screening not found" }, { status: 404 });
  }

  const classification = classifyScreening(screening.facts, screening.stateCode, new Date());
  const calc = classification.verdict?.trace?.benefit_calc as
    | import("../../../../../lib/screening-worksheet-shape").BenefitCalcDetail
    | undefined;

  const pdfBuffer = await renderToBuffer(
    ScreeningPdfDocument({
      caseLabel: screening.caseLabel,
      orgName: identity.orgName,
      stateCode: screening.stateCode,
      generatedAt: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      outcome: classification.outcome,
      summary: classification.summary,
      calc,
      stillNeeded: classification.completeness.stillNeeded,
    }),
  );

  // Best-effort — a failure here shouldn't cost the caseworker their PDF,
  // which has already been rendered by this point.
  markScreeningExported(id, identity).catch((err) => {
    console.error("[screen/export] failed to mark exported:", err instanceof Error ? err.message : String(err));
  });

  const filename = `${screening.caseLabel ?? "demeter-screening"}.pdf`;
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
