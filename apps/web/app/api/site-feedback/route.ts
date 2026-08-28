// POST /api/site-feedback — general product/site feedback, distinct from
// /api/demeter/feedback (a rating tied to one specific chat answer). This is
// for "I have a suggestion" / "something's broken" / "please add my state" —
// there was no path for that at all until this route existed. See the
// migration comment for why it's a separate table rather than a reuse of
// mae_feedback's per-answer shape.
//
// Strict validation, a honeypot field, rate
// limited, and a failure never reads as rejection to the person reporting —
// someone who bothered to write in should not be told "sorry, try again" and
// give up.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { rateLimit, RATE_LIMIT } from "../lead-capture/rate-limit";
import { durableRateLimit } from "../../../lib/durable-rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Feedback = z.object({
  category: z.enum(["bug", "suggestion", "question", "other"]).optional().or(z.literal("")),
  message: z.string().trim().min(1).max(2000),
  contact_email: z.string().trim().email().max(200).optional().or(z.literal("")),
  page_url: z.string().trim().max(500).optional().or(z.literal("")),
  // Honeypot: real users never fill this hidden field.
  company_fax: z.string().max(0).optional().or(z.literal("")),
});

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : null) || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  // Cross-instance ceiling + cheap in-memory fast-path (launch audit
  // 2026-08-28): the in-memory map is per-instance and resets on cold start,
  // so durableRateLimit is the real limit. Namespaced ("sfb") — three forms,
  // three independent allowances.
  const ip = clientIp(req);
  if (
    !rateLimit(`sfb:${ip}`) ||
    !(await durableRateLimit("sfb", ip, RATE_LIMIT.max, RATE_LIMIT.windowMs))
  ) {
    return NextResponse.json(
      { error: "Too many submissions, try again in a bit." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Feedback.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form fields." }, { status: 400 });
  }
  // Honeypot filled → pretend success, store nothing.
  if (parsed.data.company_fax) {
    return NextResponse.json({ ok: true });
  }

  try {
    const db = supabaseAdmin();
    const { error } = await db
      .schema("snap_enrollment")
      .from("demeter_site_feedback")
      .insert({
        category: parsed.data.category || null,
        message: parsed.data.message,
        contact_email: parsed.data.contact_email || null,
        page_url: parsed.data.page_url || null,
      });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[site-feedback] insert failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Couldn't save your feedback, please try again." },
      { status: 503 },
    );
  }
}
