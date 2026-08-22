// POST /api/supporters — the supporter sign-on form (moderated: rows land
// PENDING; only approved rows ever render on the wall — eng F1). Validation
// is strict and the honeypot field silently drops bots. Rate-limited through
// the same durable per-IP window as the chat.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "../../../lib/supabase-server";
import { checkUsageGate } from "../../../lib/demeter-usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SignOn = z.object({
  org_name: z.string().trim().min(2).max(120),
  contact_email: z.string().trim().email().max(200),
  website: z.string().trim().url().max(300).optional().or(z.literal("")),
  state: z.string().trim().max(30).optional().or(z.literal("")),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  // Honeypot: real users never fill this hidden field.
  company_fax: z.string().max(0).optional().or(z.literal("")),
});

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0]?.trim() : null) || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const gate = await checkUsageGate(clientIp(req));
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Too many submissions — try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SignOn.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please check the form fields." }, { status: 400 });
  }
  // Honeypot filled → pretend success, store nothing.
  if (parsed.data.company_fax) {
    return NextResponse.json({ ok: true, status: "pending" });
  }

  try {
    const db = supabaseAdmin();
    const { error } = await db
      .schema("snap_enrollment")
      .from("demeter_supporters")
      .insert({
        org_name: parsed.data.org_name,
        contact_email: parsed.data.contact_email,
        website: parsed.data.website || null,
        state: parsed.data.state || null,
        note: parsed.data.note || null,
        status: "pending",
      });
    if (error) throw error;
    return NextResponse.json({ ok: true, status: "pending" });
  } catch (err) {
    console.error("[supporters] insert failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: "Couldn't save your sign-on — please email us instead." },
      { status: 503 },
    );
  }
}
