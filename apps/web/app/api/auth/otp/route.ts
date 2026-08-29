// POST /api/auth/otp — request a phone OTP code. Mirrors the iOS path
// CivicaEnrollmentAuth.sendOTPRequest. Browser hits this route; this route
// forwards to Supabase. We don't call Supabase from the browser directly so
// that the anon key is never embedded in a third-party origin and so future
// rate-limiting / abuse logic can live in one place.

import { NextResponse } from "next/server";
import { publicEnv } from "../../../../lib/env";
import { otpRateLimit } from "../rate-limit";

// Returns E.164 for unambiguous inputs; empty string for ambiguous ones.
// Explicit + prefix (e.g. +52...) always passes through — the caller
// provided an international country code and we trust it.
// 10-digit bare number → US (+1). 11-digit starting with 1 → US with CC.
// Anything else → empty, signals non_us_phone to the caller.
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  if (!otpRateLimit(clientIp(request))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const raw = (body.phone ?? "").trim();
  const digits = raw.replace(/\D/g, "");

  // Bare digit strings that aren't 10 or 11 digits are ambiguous — we can't
  // safely guess the country code. Tell the caller to use E.164 (+country...).
  if (digits.length > 0 && !raw.startsWith("+") && digits.length !== 10 && !(digits.length === 11 && digits.startsWith("1"))) {
    return NextResponse.json({ error: "non_us_phone" }, { status: 400 });
  }

  const phone = normalizePhone(raw);
  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const { supabaseUrl, supabaseAnonKey } = publicEnv();
  const res = await fetch(`${supabaseUrl}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify({ phone }),
    cache: "no-store",
  });

  if (!res.ok) {
    // Do NOT relay the provider's raw response to the client (launch audit
    // 2026-08-28). GoTrue error text can carry internal config or identifier
    // detail the caller has no need for; the client only needs "the send
    // failed." Keep the detail server-side for diagnosis.
    const text = await res.text();
    console.warn("[auth/otp] upstream OTP send failed:", res.status, text.slice(0, 500));
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }

  return NextResponse.json({ phone });
}
