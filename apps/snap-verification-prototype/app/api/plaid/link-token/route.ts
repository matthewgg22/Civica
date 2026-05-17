import { NextResponse } from "next/server";
import { createLinkToken } from "@/lib/plaid";

export async function POST(req: Request) {
  const { userId } = await req.json().catch(() => ({ userId: "anon" }));
  const res = await createLinkToken(userId || "anon");
  return NextResponse.json(res);
}
