/**
 * POST /v1/enrollment/extension/packets/:packetId/confirm
 *
 * The extension content script calls this when it detects the BenefitsCal
 * post-submit success page and scrapes the confirmation number. We update
 * the latest active benefitscal_submissions row for the packet:
 *   status='succeeded', benefitscal_confirmation_number, submitted_at.
 *
 * If no in-flight row exists, we insert a fresh 'succeeded' row so the
 * confirmation is still recorded — this is a defensive path when an
 * assister submits via the extension without first calling prepare-export
 * from the dashboard (which is a supported MVP flow).
 *
 * Auth: accepts EITHER a per-CBO device-flow access token (issue #317,
 * org-scoped) OR the legacy shared EXTENSION_BEARER_TOKEN (deprecated). With a
 * device token the packet must belong to the token's org (else 404). See
 * ./auth.ts.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { makeServiceClient } from "../../lib/supabase.js";
import { withActorContext } from "../../middleware/actorContext.js";
import { rateLimit } from "../../lib/rate-limit.js";
import { resolveExtensionAuth } from "./auth.js";
import type { Env } from "../../types.js";

const bodySchema = z.object({
  benefitscal_confirmation_number: z.string().min(1).max(64),
  benefitscal_application_id: z.string().min(1).max(64).optional(),
});

const app = new Hono<{ Bindings: Env }>();

app.post(
  "/packets/:packetId/confirm",
  rateLimit("standard"),
  zValidator("json", bodySchema),
  async (c) => {
    // Auth: device token (org-scoped) OR legacy shared token. See ./auth.ts.
    const auth = await resolveExtensionAuth(c.env, c.req.header("Authorization"));
    if (auth === "unconfigured") {
      throw new HTTPException(503, {
        message:
          "Extension auth is not configured for this environment. Set EXTENSION_BEARER_TOKEN or use a device token.",
      });
    }
    if (auth === "unauthorized") {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const packetId = c.req.param("packetId");
    if (!packetId) throw new HTTPException(400, { message: "packetId is required" });

    const body = c.req.valid("json");

    // Set actor + acquire actor-context-scoped DB client so audit triggers
    // attribute the write to 'cbo_assister' (device token, real org) or
    // 'extension' (legacy shared) instead of NULL. See A2 finding.
    c.set("actor", auth.actor);
    const db = await withActorContext(c);

    // Sanity check: packet exists.
    const { data: packet, error: packetErr } = await db
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, org_id")
      .eq("packet_id", packetId)
      .is("deleted_at", null)
      .single();
    if (packetErr?.code === "PGRST116") {
      throw new HTTPException(404, { message: "Packet not found" });
    }
    if (packetErr) throw new HTTPException(500, { message: packetErr.message });
    if (!packet) throw new HTTPException(404, { message: "Packet not found" });

    // ORG ISOLATION: a device token may only write confirmations for packets in
    // its own org. 404 on mismatch (never disclose another org's packet). The
    // legacy shared token (orgId=null) skips this — documented back-compat.
    if (auth.method === "device_token" && packet.org_id !== auth.orgId) {
      throw new HTTPException(404, { message: "Packet not found" });
    }

    // A3: packet must have an assigned org before we can record a submission.
    // The defensive insert path needs org_id (FK to staff_orgs). Without it
    // we'd violate the FK and 500 with an opaque DB error — return a clear
    // 422 instead so the navigator can resolve the upstream data gap.
    if (!packet.org_id) {
      throw new HTTPException(422, {
        message:
          "Packet has no assigned org. Assign a navigator/CBO to the packet before recording a BenefitsCal submission.",
      });
    }

    // Look for an in-flight submission row to upgrade.
    const { data: existing } = await db
      .schema("snap_enrollment")
      .from("benefitscal_submissions")
      .select("submission_id, status")
      .eq("packet_id", packetId)
      .in("status", ["pending_review", "queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const playwrightLog = {
      transcript: [
        {
          step: "extension_confirmation_captured",
          at: new Date().toISOString(),
          note: "Recorded via /extension/packets/:id/confirm",
        },
      ],
      benefitscal_application_id: body.benefitscal_application_id ?? null,
      source: "civica_submitter_extension" as const,
    };

    if (existing) {
      const { data: updated, error: updateErr } = await db
        .schema("snap_enrollment")
        .from("benefitscal_submissions")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          status: "succeeded",
          benefitscal_confirmation_number: body.benefitscal_confirmation_number,
          submitted_at: new Date().toISOString(),
          playwright_log: playwrightLog,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("submission_id", existing.submission_id)
        .select("submission_id, status, benefitscal_confirmation_number, submitted_at")
        .single();
      if (updateErr) throw new HTTPException(500, { message: updateErr.message });
      return c.json({ ...updated, idempotent: false }, 200);
    }

    // Defensive insert when no prior row exists. org_id is guaranteed non-null
    // by the 422 check above.
    const { data: inserted, error: insertErr } = await db
      .schema("snap_enrollment")
      .from("benefitscal_submissions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        packet_id: packetId,
        org_id: packet.org_id,
        payload_json: { source: "extension_confirmation_only" },
        status: "succeeded",
        consent_type: "async_portal",
        benefitscal_confirmation_number: body.benefitscal_confirmation_number,
        submitted_at: new Date().toISOString(),
        playwright_log: playwrightLog,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("submission_id, status, benefitscal_confirmation_number, submitted_at")
      .single();
    if (insertErr) throw new HTTPException(500, { message: insertErr.message });
    return c.json({ ...inserted, idempotent: false, defensive_insert: true }, 201);
  },
);

export default app;
