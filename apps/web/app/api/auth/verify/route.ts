// POST /api/auth/verify — verify the phone OTP and establish a session.
// Uses the @supabase/ssr server client so cookies are written by the SDK
// rather than manually, matching the dashboard auth pattern.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";

type VerifyBody = {
  phone?: string;
  token?: string;
};

export async function POST(request: Request) {
  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const phone = (body.phone ?? "").trim();
  const token = (body.token ?? "").trim();

  if (!phone || !token) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error) {
    const msg = error.message.toLowerCase();
    const code =
      msg.includes("invalid") || msg.includes("expired")
        ? "invalid_code"
        : "upstream_failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  return NextResponse.json({ userId: data.user?.id ?? null });
}
