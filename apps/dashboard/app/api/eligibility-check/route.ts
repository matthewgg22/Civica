// POST /api/eligibility-check — navigator quick-check.
//
// The integration seam that turns three engines live in one call: a navigator
// enters the determinative facts, we run Component R (elicit → determine →
// recommend), and return verdict + estimated benefit + ranked recommendations.
//
// This deliberately bypasses the apply-wizard answer schema (which under-
// collects for a determination) and the packet→Facts adapter (#504): the
// navigator supplies Facts directly via the form. Pure engine compute, no DB.

import { NextResponse, type NextRequest } from "next/server";
import { evaluateComponentR, type ComponentRInput } from "@civica/snap-recommendation";
import type { Facts } from "@civica/snap-rules";

type Body = {
  facts?: Facts;
  answeredAxes?: ComponentRInput["answeredAxes"];
  state?: "CA" | "MA";
  asOf?: string;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.facts || typeof body.facts !== "object") {
    return NextResponse.json({ error: "Missing facts" }, { status: 400 });
  }

  const state = body.state === "MA" ? "MA" : "CA";
  const asOf = body.asOf ? new Date(body.asOf) : new Date();

  try {
    const result = evaluateComponentR({
      facts: body.facts,
      answeredAxes: body.answeredAxes ?? {},
      state,
      asOf,
    });

    // Flatten the part a navigator surface cares about. Verdict + benefit live
    // in stage 2; the deduction trace explains the number; stage 3 is the recs.
    const verdict = result.stage2?.verdict ?? null;
    const benefit = result.stage2?.benefit ?? null;
    const trace = result.stage2?.trace ?? null;

    return NextResponse.json({
      status: result.stage1.status, // DETERMINE | ELICIT
      missing_fields: result.stage1.missing_fields,
      plausibility_flags: result.stage1.plausibility_flags,
      verdict,
      estimated_monthly_benefit_usd: benefit,
      trace,
      recommendations: result.stage3?.recommendations ?? [],
      interrupt_required: result.stage3?.interrupt_required ?? false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine error" },
      { status: 500 },
    );
  }
}
