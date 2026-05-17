import { NextResponse } from "next/server";
import { fetchIncomeDeposits, fetchRentTransactions } from "@/lib/plaid";

export async function POST(req: Request) {
  const body = await req.json();
  if (body.mode === "rent") {
    const txns = await fetchRentTransactions({
      publicToken: body.publicToken ?? "sandbox",
      leaseholderName: body.leaseholderName,
      monthlyAmount: body.monthlyAmount,
      paymentMethod: body.paymentMethod,
    });
    return NextResponse.json({ transactions: txns });
  }
  if (body.mode === "income") {
    const deposits = await fetchIncomeDeposits({
      publicToken: body.publicToken ?? "sandbox",
      knownSources: body.knownSources ?? [],
    });
    return NextResponse.json({ deposits });
  }
  return NextResponse.json({ error: "unknown mode" }, { status: 400 });
}
