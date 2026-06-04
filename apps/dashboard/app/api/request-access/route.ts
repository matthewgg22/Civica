import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase";

interface RequestAccessPayload {
  name?: unknown;
  organization?: unknown;
  email?: unknown;
  note?: unknown;
}

export async function POST(req: NextRequest) {
  let body: RequestAccessPayload;
  try {
    body = (await req.json()) as RequestAccessPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const organization = typeof body.organization === "string" ? body.organization.trim().slice(0, 300) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";

  if (!name || !organization || !email) {
    return NextResponse.json({ error: "name, organization, and email are required" }, { status: 400 });
  }

  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const supabase = createServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("access_requests")
    .insert({ name, organization, email, note: note || null });

  if (error) {
    console.error("[request-access] insert error", error);
    return NextResponse.json({ error: "Failed to save request" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
