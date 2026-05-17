import { NextResponse } from "next/server";
import { listPackages, savePackage } from "@/lib/store";
import type { VerificationPackage } from "@/types/verification";

export async function GET() {
  return NextResponse.json({ packages: listPackages() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { applicant_name: string; package: VerificationPackage };
  if (!body?.package?.flow || !body.applicant_name) {
    return NextResponse.json({ error: "applicant_name and package required" }, { status: 400 });
  }
  const stored = savePackage(body.package, body.applicant_name);
  return NextResponse.json({ stored });
}
