// POST /api/auth/verify — verify the OTP, persist Supabase session as
// HttpOnly cookies, and return the user id. Mirrors iOS verifyOTPRequest.

import { NextResponse } from "next/server";
import { publicEnv } from "../../../../lib/env";
import { persistSession } from "../../../../lib/supabase-server";

type VerifyBody = {
  phone?: string;
  token?: string;
};

type SupabaseVerifyResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string };
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

  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  const res = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ phone, token, type: "sms" }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    const lowered = text.toLowerCase();
    const code = lowered.includes("invalid") || lowered.includes("expired")
      ? "invalid_code"
      : "upstream_failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  const session = (await res.json()) as SupabaseVerifyResponse;

  await persistSession({
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId: session.user.id,
    expiresInSeconds: session.expires_in,
  });

  return NextResponse.json({ userId: session.user.id });
}
