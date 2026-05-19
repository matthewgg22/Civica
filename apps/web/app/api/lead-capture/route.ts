import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "./rate-limit";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  phone: z.string().trim().min(7).max(32).optional(),
  // Required by the pilot_leads_audience_shape CHECK constraint in
  // migration 20260556 — student-lpie-web rows must have email + campus.
  campus: z.string().trim().min(1).max(120),
});

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(ip)) {
    return NextResponse.json(
      { message: "Too many requests" },
      { status: 429 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 422 });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // Dev / preview without Supabase credentials. Don't crash — return 503
    // so the form layout can be exercised without Supabase. Log so it's
    // visible if accidentally deployed without env wired up.
    console.warn(
      "[lead-capture] Supabase env vars missing; returning 503. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
    return NextResponse.json(
      { message: "Lead capture not configured for this environment" },
      { status: 503 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // pilot_leads schema accepts both CBO-audience (name+organization) and
  // student-audience (email+campus) shapes since migration 20260556. The
  // source-conditional CHECK constraint enforces the right fields per audience.
  const row = {
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    campus: parsed.data.campus,
    source: "student-lpie-web" as const,
  };

  const { error } = await supabase.from("pilot_leads").insert(row);
  if (error) {
    console.error("[lead-capture] supabase insert failed", error);
    return NextResponse.json({ message: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
