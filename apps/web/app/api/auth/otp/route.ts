// POST /api/auth/otp — request a phone OTP code. Mirrors the iOS path
// CivicaEnrollmentAuth.sendOTPRequest. Browser hits this route; this route
// forwards to Supabase. We don't call Supabase from the browser directly so
// that the anon key is never embedded in a third-party origin and so future
// rate-limiting / abuse logic can live in one place.

import { NextResponse } from "next/server";
import { publicEnv } from "../../../../lib/env";

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return digits ? `+${digits}` : "";
}

export async function POST(request: Request) {
  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? "");
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
    const text = await res.text();
    return NextResponse.json(
      { error: "upstream_failed", detail: text.slice(0, 500) },
      { status: 502 },
    );
  }

  return NextResponse.json({ phone });
}
