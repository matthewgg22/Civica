/**
 * Buddy Add Routes
 *
 * POST /buddy/invite               — applicant generates an invite link
 * POST /buddy/accept               — helper accepts the invite (must be signed in)
 * GET  /buddy/applicant-summary    — buddy reads their linked applicant(s) summary
 * GET  /buddy/config               — feature flag check (no auth required)
 *
 * Invite token format: signed JWT (hono/jwt), payload { jti: <uuid> }, 48h TTL.
 * Token hash (SHA-256 of the raw JWT string) is stored in buddy_invite for
 * single-use atomic validation. The payload is an opaque nonce — applicant_user_id
 * is NOT embedded in the token to prevent info leakage if a token is shared.
 *
 * Navigator/admin accepting an invite: relationship is declined, a
 * buddy_invite_declined_existing_role event is logged, and 200 is returned with
 * { status: 'navigator_access' }. The navigator's existing org scope already
 * covers the applicant's data.
 *
 * "No Civica account" path (invitee has never signed in): handled by the
 * civica.app/buddy/accept web fallback page (PR2). That page runs sign-up /
 * sign-in, obtains a JWT, then calls this endpoint with the Bearer token set.
 */

import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient, makeServiceClient } from "../lib/supabase.js";
import { requireApplicant, requireBuddy } from "../lib/auth.js";
import { rateLimit } from "../lib/rate-limit.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buddyEnabled(env: Env): boolean {
  return env.BUDDY_ADD_ENABLED === "true";
}

// ---------------------------------------------------------------------------
// GET /buddy/config — feature flag (no auth required)
// ---------------------------------------------------------------------------

app.get("/config", async (c) => {
  return c.json({ enabled: buddyEnabled(c.env) });
});

// ---------------------------------------------------------------------------
// POST /buddy/invite — applicant generates an invite link for a helper
// ---------------------------------------------------------------------------

const inviteBodySchema = z.object({
  /** Optional org code. When present the buddy relationship is linked to a BuddyOrg. */
  org_code: z.string().optional(),
});

app.post("/invite", rateLimit("strict"), zValidator("json", inviteBodySchema), async (c) => {
  const actor = c.get("actor");
  requireApplicant(actor.kind);

  if (!buddyEnabled(c.env)) {
    throw new HTTPException(403, { message: "Buddy feature is not enabled" });
  }

  const secret = c.env.BUDDY_JWT_SECRET;
  if (!secret) {
    throw new HTTPException(500, { message: "BUDDY_JWT_SECRET not configured" });
  }

  const db = makeServiceClient(c.env);
  const body = c.req.valid("json");

  // Enforce 3-buddy limit (active relationships only).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error: countErr } = await (db.schema("snap_enrollment").from("buddy_relationship" as any) as any)
    .select("id", { count: "exact", head: true })
    .eq("applicant_user_id", actor.id)
    .eq("status", "active");

  if (countErr) throw new HTTPException(500, { message: countErr.message });

  if ((count ?? 0) >= 3) {
    return c.json({ code: "BUDDY_LIMIT_REACHED", message: "You can have up to 3 helpers at a time. Remove one to invite someone new." }, 422);
  }

  // Resolve org if an org_code was supplied.
  let orgId: string | null = null;
  if (body.org_code) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org, error: orgErr } = await (db.schema("snap_enrollment").from("buddy_org" as any) as any)
      .select("id, org_code_expires_at")
      .eq("org_code", body.org_code)
      .single() as { data: { id: string; org_code_expires_at: string } | null; error: { code?: string; message: string } | null };

    if (orgErr?.code === "PGRST116" || !org) {
      return c.json({ code: "ORG_CODE_INVALID", message: "Org code not found" }, 422);
    }
    if (orgErr) throw new HTTPException(500, { message: orgErr.message });
    if (new Date(org.org_code_expires_at) < new Date()) {
      return c.json({ code: "ORG_CODE_EXPIRED", message: "Org code has expired" }, 422);
    }
    orgId = org.id;
  }

  // Generate opaque nonce, sign as JWT (48h TTL).
  const jti = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const token = await sign(
    { jti, exp: Math.floor(expiresAt.getTime() / 1000) },
    secret,
    "HS256",
  );
  const tokenHash = await sha256hex(token);

  // Revoke any prior unused invite from this applicant.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.schema("snap_enrollment").from("buddy_invite" as any) as any)
    .update({ used_at: new Date().toISOString() })
    .eq("applicant_user_id", actor.id)
    .is("used_at", null);

  // Store the new invite.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: insertErr } = await (db.schema("snap_enrollment").from("buddy_invite" as any) as any)
    .insert({
      applicant_user_id: actor.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      ...(orgId ? { org_id: orgId } : {}),
    }) as { error: { message: string } | null };

  if (insertErr) throw new HTTPException(500, { message: insertErr.message });

  return c.json({
    token,
    invite_url: `https://civica.app/buddy/accept?token=${encodeURIComponent(token)}`,
    expires_at: expiresAt.toISOString(),
  }, 201);
});

// ---------------------------------------------------------------------------
// POST /buddy/accept — helper accepts an invite (must be signed in)
// ---------------------------------------------------------------------------

const acceptBodySchema = z.object({
  token: z.string().min(1),
});

app.post("/accept", rateLimit("strict"), zValidator("json", acceptBodySchema), async (c) => {
  const actor = c.get("actor");

  if (!buddyEnabled(c.env)) {
    throw new HTTPException(403, { message: "Buddy feature is not enabled" });
  }

  const secret = c.env.BUDDY_JWT_SECRET;
  if (!secret) {
    throw new HTTPException(500, { message: "BUDDY_JWT_SECRET not configured" });
  }

  const { token } = c.req.valid("json");

  // Verify signature and expiry.
  let payload: { jti: string; exp: number };
  try {
    payload = await verify(token, secret, "HS256") as { jti: string; exp: number };
  } catch {
    throw new HTTPException(401, { message: "TOKEN_INVALID" });
  }

  if (!payload?.jti) {
    throw new HTTPException(401, { message: "TOKEN_INVALID" });
  }

  const tokenHash = await sha256hex(token);
  const db = makeServiceClient(c.env);

  // Atomic single-use consume: UPDATE ... WHERE used_at IS NULL returns 0 rows
  // on a double-tap, closing the race condition entirely.
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inviteRows, error: useErr } = await (db.schema("snap_enrollment").from("buddy_invite" as any) as any)
    .update({ used_at: now })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("id, applicant_user_id") as { data: Array<{ id: string; applicant_user_id: string }> | null; error: { message: string } | null };

  if (useErr) throw new HTTPException(500, { message: useErr.message });

  if (!inviteRows || inviteRows.length === 0) {
    // Could be already used, expired, or never existed — return 409 for any.
    return c.json({ code: "TOKEN_ALREADY_USED", message: "This invite link has already been used or has expired." }, 409);
  }

  const invite = inviteRows[0] as { id: string; applicant_user_id: string };

  // Caseworker (navigator/admin) accepting the SAME invite link — "extension of
  // friend": a CBO can connect through the applicant's buddy link just like a
  // family member. Two differences from a friend:
  //  1. We do NOT set app_metadata.role='buddy'. Staff keep their navigator/admin
  //     role (their packet access already comes from it), so we skip the Admin API
  //     role write entirely.
  //  2. The cleanup cron is guarded to never null a non-'buddy' role, so this
  //     relationship row can complete/revoke without wiping their staff access.
  // The link is upserted (idempotent) so a caseworker re-scanning the code just
  // re-confirms the existing connection instead of erroring on the unique index.
  if (actor.kind === "navigator" || actor.kind === "admin") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db.schema("snap_enrollment").from("buddy_invite_events" as any) as any)
      .insert({ event_type: "buddy_invite_accepted_staff", actor_id: actor.id, invite_id: invite.id })
      .then(() => null)
      .catch(() => null); // table may not exist yet in early deploys — non-fatal

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: staffRel, error: staffRelErr } = await (db.schema("snap_enrollment").from("buddy_relationship" as any) as any)
      .upsert(
        {
          applicant_user_id: invite.applicant_user_id,
          buddy_user_id: actor.id,
          status: "active",
        },
        { onConflict: "applicant_user_id,buddy_user_id" },
      )
      .select("id")
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (staffRelErr) throw new HTTPException(500, { message: staffRelErr.message });

    return c.json({ relationship_id: (staffRel as { id: string }).id, status: "navigator_linked" }, 201);
  }

  // Set app_metadata.role = 'buddy' via Supabase Admin API.
  const adminApiUrl = `${c.env.SUPABASE_URL}/auth/v1/admin/users/${actor.id}`;
  const adminRes = await fetch(adminApiUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "apikey": c.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ app_metadata: { role: "buddy" } }),
  });

  if (!adminRes.ok) {
    throw new HTTPException(500, { message: "Failed to assign buddy role" });
  }

  // Create the BuddyRelationship row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rel, error: relErr } = await (db.schema("snap_enrollment").from("buddy_relationship" as any) as any)
    .insert({
      applicant_user_id: invite.applicant_user_id,
      buddy_user_id: actor.id,
      status: "active",
    })
    .select("id")
    .single() as { data: { id: string } | null; error: { message: string } | null };

  if (relErr) throw new HTTPException(500, { message: relErr.message });

  return c.json({ relationship_id: (rel as { id: string }).id }, 201);
});

// ---------------------------------------------------------------------------
// GET /buddy/applicant-summary — buddy reads their linked applicant(s)
// ---------------------------------------------------------------------------

app.get("/applicant-summary", async (c) => {
  const actor = c.get("actor");
  requireBuddy(actor.kind);

  // Anon client carries the buddy's JWT — auth.uid() inside the view resolves
  // to the buddy, so buddy_packet_summary_view filters to their active
  // relationships automatically. The view exposes only safe columns (packet_id,
  // status, state_code, current_section, updated_at) so a buddy-authenticated
  // query cannot reach SSN / income / household composition through the DB.
  const anonDb = makeAnonClient(c.env, c.get("jwt"));
  const db = makeServiceClient(c.env);

  // Fetch active relationships for this buddy. We still need this for
  // relationship_id and notifications_enabled — both buddy_relationship columns,
  // not packet columns. RLS policy buddy_relationship_read_own scopes to own rows.
  type RelRow = { id: string; applicant_user_id: string; notifications_enabled: boolean };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rels, error: relErr } = await (db.schema("snap_enrollment").from("buddy_relationship" as any) as any)
    .select("id, applicant_user_id, notifications_enabled")
    .eq("buddy_user_id", actor.id)
    .eq("status", "active") as { data: RelRow[] | null; error: { message: string } | null };

  if (relErr) throw new HTTPException(500, { message: relErr.message });
  if (!rels || rels.length === 0) {
    return c.json([]);
  }

  // Fetch packet summaries via the column-restricted view. The view's underlying
  // SECURITY DEFINER function filters to packets where buddy_relationship is
  // active for auth.uid(), so we don't need a WHERE clause here.
  const { data: packets, error: pErr } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    anonDb.schema("snap_enrollment").from("buddy_packet_summary_view" as any) as any
  )
    .select("packet_id, applicant_user_id, status, updated_at") as {
      data: { packet_id: string; applicant_user_id: string; status: string; updated_at: string }[] | null;
      error: { message: string } | null;
    };

  if (pErr) throw new HTTPException(500, { message: pErr.message });

  type PacketRow = { packet_id: string; applicant_user_id: string; status: string; updated_at: string };
  const packetByApplicant = new Map<string, PacketRow>(
    (packets ?? []).map((p) => [p.applicant_user_id, p]),
  );

  const summaries = rels.map((rel) => {
    const packet = packetByApplicant.get(rel.applicant_user_id);
    const stalledHours = packet
      ? Math.floor((Date.now() - new Date(packet.updated_at).getTime()) / (1000 * 60 * 60))
      : null;

    return {
      relationship_id: rel.id,
      applicant_id: rel.applicant_user_id,
      notifications_enabled: rel.notifications_enabled,
      current_section: packet ? packet.status : null,
      next_action: packet
        ? stalledHours !== null && stalledHours > 72
          ? "Application hasn't been updated in a while — check in with your applicant."
          : "Application is in progress. Keep checking back!"
        : "No active application found.",
      checklist_summary: packet
        ? { packet_id: packet.packet_id, status: packet.status, last_updated: packet.updated_at }
        : null,
    };
  });

  return c.json(summaries);
});

export default app;
