import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase";

// T5 lead-capture endpoint for the §10106 county admin cost dashboard.
// Phase 1: log submission server-side and return 200.
// Phase 2 (post-MVP): wire to HubSpot or Airtable via their APIs using a
//   server-side secret so no API keys are exposed to the browser.
//
// Auth: intentionally unauthenticated — this endpoint is reached from
// public-facing shared-link tokens before a Supabase session exists.
// Rate-limiting should be added before production (e.g. Vercel Edge Rate
// Limiting or an upstash/ratelimit middleware).

interface LeadPayload {
  name?: unknown;
  organization?: unknown;
  email?: unknown;
  qcProcess?: unknown;
}

export async function POST(req: NextRequest) {
  let body: LeadPayload;
  try {
    body = (await req.json()) as LeadPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const organization =
    typeof body.organization === "string"
      ? body.organization.trim().slice(0, 300)
      : "";
  const email =
    typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
  const qcProcess =
    typeof body.qcProcess === "string" ? body.qcProcess.trim().slice(0, 1000) : "";

  if (!name || !organization || !email) {
    return NextResponse.json(
      { error: "name, organization, and email are required" },
      { status: 400 }
    );
  }

  // Basic email shape check (not a full RFC-5322 parse — that's for the CRM).
  if (!email.includes("@") || !email.includes(".")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  // Structured log — consumed by Vercel Log Drains / Datadog.
  console.log("[lead-capture]", {
    name,
    organization,
    email,
    qcProcess: qcProcess || null,
    submittedAt: new Date().toISOString(),
    source: "county-10106-dashboard",
  });

  // Persist to Supabase via service role (non-blocking — UX always gets 200).
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from("pilot_leads").insert({
      name,
      organization,
      email,
      qc_process: qcProcess || null,
      source: "county-10106",
    });
    if (error) {
      console.error("[lead-capture] Supabase insert failed", {
        error: error.message,
        email,
      });
    }
  } catch (err) {
    console.error("[lead-capture] Unexpected Supabase error", { err, email });
  }

  // TODO(post-MVP): forward to HubSpot via HUBSPOT_ACCESS_TOKEN env var.
  //   await hubspotCreateContact({ name, organization, email });

  return NextResponse.json({ ok: true }, { status: 200 });
}
