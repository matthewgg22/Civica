// POST /api/auth/verify — verify the phone OTP and establish a session.
// Uses the @supabase/ssr server client so cookies are written by the SDK
// rather than manually, matching the dashboard auth pattern.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import { durableRateLimit } from "../../../../lib/durable-rate-limit";

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : null) || request.headers.get("x-real-ip") || "unknown";
}

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

  // BRUTE-FORCE BOUND (launch audit 2026-08-28). The request route has always
  // been limited; this one — the route that actually takes code guesses — had
  // none, so guessing was bounded only by upstream throttles. A 6-digit code
  // is a password-equivalent on this surface: an account is someone's saved
  // SNAP conversation. Per-IP AND per-phone, because a distributed guesser
  // rotates IPs and a targeted one doesn't.
  const ipOk = await durableRateLimit("otpv-ip", clientIp(request), 10, 10 * 60_000);
  const phoneOk = await durableRateLimit("otpv-ph", phone, 5, 10 * 60_000);
  if (!ipOk || !phoneOk) {
    return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
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
