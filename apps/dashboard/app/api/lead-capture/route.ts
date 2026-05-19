import { NextRequest, NextResponse } from "next/server";

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

  // Phase 1: structured log. Vercel Log Drains or Datadog can pick this up.
  console.log("[lead-capture]", {
    name,
    organization,
    email,
    qcProcess: qcProcess || null,
    submittedAt: new Date().toISOString(),
    source: "county-10106-dashboard",
  });

  // TODO(post-MVP): persist to Supabase public.lead_captures table and/or
  // forward to HubSpot via HUBSPOT_ACCESS_TOKEN env var.
  //   await supabase.from("lead_captures").insert({ name, organization, email, qc_process: qcProcess, source: "county-10106" });
  //   await hubspotCreateContact({ name, organization, email });

  return NextResponse.json({ ok: true }, { status: 200 });
}
