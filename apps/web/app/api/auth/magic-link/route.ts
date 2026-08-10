// POST /api/auth/magic-link — email a sign-in link (PKCE, server-initiated).
//
// Mirrors ../google/route.ts exactly in principle: the browser never calls
// Supabase directly, so the anon key is never embedded in a third-party origin
// and abuse handling lives in one place. The server client generates the PKCE
// challenge and persists the verifier in an HttpOnly cookie; Supabase emails a
// link back to /auth/callback, which exchanges the code for a session — the
// same callback Google already uses, with no staff-role gate.
//
// WHY EMAIL AND NOT THE EXISTING PHONE OTP: ../otp/route.ts is SMS, needs a
// paid provider, and asks for a phone number — a worse ask for someone
// applying for food assistance, often on a shared or borrowed device. Email
// costs nothing per message and is the identifier they will already be given
// for their case.
//
// WHY NO PASSWORD: password resets are the top support cost in consumer
// benefits tools, and there is no support desk here to absorb them.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import { durableRateLimit } from "../../../../lib/durable-rate-limit";

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Same-origin relative paths only — a crafted `next` must not become an open
 *  redirect, and this value survives a round trip through the user's inbox. */
function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/screen/ask";
  }
  return raw;
}

// Deliberately permissive: the authority on whether an address exists is the
// delivery attempt, not a regex. This only rejects input that cannot be an
// address at all, so a valid-but-unusual one is never turned away here.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let body: { email?: unknown; next?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter an email address." }, { status: 400 });
  }

  // TWO limits, and the per-ADDRESS one is the important half.
  //
  // Limiting only by IP still lets someone bomb one person's inbox from a
  // handful of addresses, and the cost of that lands on the recipient, not on
  // us. Both are DURABLE (shared across serverless instances) because the
  // in-memory limiter resets on cold start and is per-instance — an
  // allowance of (limit × instances), which is no allowance at all.
  const ipOk = await durableRateLimit("mlip", clientIp(request), 5, 10 * 60_000);
  const emailOk = await durableRateLimit("mlem", email, 3, 10 * 60_000);
  if (!ipOk || !emailOk) {
    return NextResponse.json(
      { error: "Too many sign-in emails — try again in a few minutes." },
      { status: 429, headers: { "Retry-After": "600" } },
    );
  }

  const origin = new URL(request.url).origin;
  const next = safeNext(body.next);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // Sign-in AND sign-up are the same act here. Requiring a separate
      // registration step would be a second wall in front of someone who
      // only wants to keep their own conversation.
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.warn("[auth] magic link send failed:", error.message);
  }

  // ALWAYS the same response, error or not. A different answer for a known
  // vs unknown address turns this endpoint into a way to test whether a given
  // person has used a benefits service — which is exactly the kind of fact
  // that should not be probeable. The user is told to check their inbox
  // either way.
  return NextResponse.json({ ok: true });
}
