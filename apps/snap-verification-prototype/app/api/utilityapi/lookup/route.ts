import { NextResponse } from "next/server";
import { lookupAccounts } from "@/lib/utilityapi";

export async function POST(req: Request) {
  const { applicantName, serviceAddress } = await req.json();
  if (!applicantName || !serviceAddress) {
    return NextResponse.json({ error: "applicantName and serviceAddress required" }, { status: 400 });
  }
  const result = await lookupAccounts({ applicantName, serviceAddress });
  return NextResponse.json(result);
}
