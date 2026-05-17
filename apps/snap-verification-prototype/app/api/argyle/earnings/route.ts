import { NextResponse } from "next/server";
import { fetchPlatformEarnings, fetchW2Earnings } from "@/lib/argyle";
import type { GigPlatform } from "@/types/verification";

export async function POST(req: Request) {
  const body = await req.json();
  const results = [];
  if (body.w2Employer) {
    results.push(await fetchW2Earnings(body.w2Employer as string));
  }
  for (const p of (body.platforms ?? []) as GigPlatform[]) {
    results.push(await fetchPlatformEarnings(p));
  }
  return NextResponse.json({ earnings: results });
}
