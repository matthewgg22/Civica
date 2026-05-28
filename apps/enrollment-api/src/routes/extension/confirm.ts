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
 * Auth: same bearer token as the payload endpoint.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { makeServiceClient } from "../../lib/supabase.js";
import { rateLimit } from "../../lib/rate-limit.js";
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
    const bearer = c.req.header("Authorization");
    const expected = c.env.EXTENSION_BEARER_TOKEN;

    if (!expected) {
      throw new HTTPException(503, {
        message:
          "Extension bearer token is not configured for this environment. Set EXTENSION_BEARER_TOKEN.",
      });
    }
    if (!bearer || bearer !== `Bearer ${expected}`) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const packetId = c.req.param("packetId");
    if (!packetId) throw new HTTPException(400, { message: "packetId is required" });

    const body = c.req.valid("json");
    const db = makeServiceClient(c.env);

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

    // Defensive insert when no prior row exists.
    const { data: inserted, error: insertErr } = await db
      .schema("snap_enrollment")
      .from("benefitscal_submissions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        packet_id: packetId,
        org_id: packet.org_id ?? "",
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
