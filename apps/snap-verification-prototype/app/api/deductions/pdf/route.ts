import { NextResponse } from "next/server";
import { calculateSnapBenefit } from "@/lib/snap-calculator";
import { renderDeductionsPdf } from "@/lib/snap-calculator/pdf";
import type { SnapCalculatorInput } from "@/lib/snap-calculator";
import type { StateCode } from "@/types/verification";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams;

  const input: SnapCalculatorInput = {
    stateCode: (p.get("state") ?? "CA") as StateCode,
    householdSize: Math.max(1, Number(p.get("hh")) || 2),
    grossMonthlyEarnedIncome: Number(p.get("earned")) || 0,
    grossMonthlyUnearnedIncome: Number(p.get("unearned")) || 0,
    monthlySheltCost: Number(p.get("rent")) || 0,
    monthlySuaAmount: Number(p.get("sua_amount")) || 0,
    monthlyDependentCareCost: Number(p.get("depcare")) || 0,
    hasChildUnder2: p.get("child2") === "1",
    elderlyOrDisabled: p.get("elderly") === "1",
  };

  const result = calculateSnapBenefit(input);
  const pdf = await renderDeductionsPdf({
    input,
    result,
    applicantName: p.get("applicant") ?? undefined,
    generatedAt: new Date().toISOString(),
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="snap-benefit-estimate.pdf"`,
    },
  });
}
