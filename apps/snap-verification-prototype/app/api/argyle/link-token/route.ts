import { NextResponse } from "next/server";
import { createUserToken } from "@/lib/argyle";

export async function POST(req: Request) {
  const { applicantName } = await req.json().catch(() => ({ applicantName: "Anonymous" }));
  const res = await createUserToken(applicantName || "Anonymous");
  return NextResponse.json(res);
}
