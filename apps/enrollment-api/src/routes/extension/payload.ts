/**
 * GET /v1/enrollment/extension/packets/:packetId/payload
 *
 * Returns the BenefitsCalPayload-shaped snapshot for the extension content
 * script to autofill the BenefitsCal CBO Manager form pages. Mirrors the
 * shape produced by POST /benefitscal/prepare-export so consumers don't
 * need a second integration.
 *
 * Auth: Bearer token via EXTENSION_BEARER_TOKEN. Single shared secret in
 * the MVP scope. Per-CBO tokens are the v2 — see TODO entry added by this
 * branch.
 *
 * PII posture: returns ciphertext as-is for full_name / DOB / phone /
 * address. The extension content script reports skipped fields in its
 * overlay; both decryption AND selector verification (TODO-14) unblock
 * together when CBO Manager access lands.
 */

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../../lib/supabase.js";
import { withActorContext } from "../../middleware/actorContext.js";
import { rateLimit } from "../../lib/rate-limit.js";
import type { Actor, Env } from "../../types.js";

const app = new Hono<{ Bindings: Env }>();

// Synthetic actor for audit attribution on all extension-route DB access.
// Per /plan-eng-review A2 (2026-05-27): every gateway write should set
// app.actor_* via withActorContext so audit triggers attribute the action
// rather than logging NULL. When per-CBO bearer tokens land, this becomes
// 'cbo_assister' with a real org_id derived from the token.
const EXTENSION_ACTOR: Actor = {
  kind: "extension",
  id: "civica-submitter-ext",
};

app.get("/packets/:packetId/payload", rateLimit("standard"), async (c) => {
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

  // Set actor so withActorContext + downstream audit triggers attribute
  // reads to 'extension'. The payload endpoint is read-only but the actor
  // context is cheap to set and keeps the pattern consistent with confirm.ts.
  c.set("actor", EXTENSION_ACTOR);
  const db = await withActorContext(c);

  // 1. Packet + applicant join (mirrors benefitscal.prepare-export at L101-110).
  const { data: packet, error: packetErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(
      `packet_id, status, state_code, org_id, county, submitted_at,
       applicants(applicant_id, full_name_ciphertext, date_of_birth_ciphertext, phone_ciphertext, address_ciphertext, preferred_language)`,
    )
    .eq("packet_id", packetId)
    .is("deleted_at", null)
    .single();

  if (packetErr?.code === "PGRST116") {
    throw new HTTPException(404, { message: "Packet not found" });
  }
  if (packetErr) throw new HTTPException(500, { message: packetErr.message });
  if (!packet) throw new HTTPException(404, { message: "Packet not found" });

  // 2. Answers + documents.
  const [{ data: answers }, { data: docRows }] = await Promise.all([
    db
      .schema("snap_enrollment")
      .from("packet_answers")
      .select("question_key, applicant_answer, navigator_confirmed_value")
      .eq("packet_id", packetId)
      .order("question_key"),
    db
      .schema("snap_enrollment")
      .from("uploaded_documents")
      .select("document_id, document_kind, processing_status")
      .eq("packet_id", packetId)
      .is("deleted_at", null),
  ]);

  // 3. Sign 10-minute URLs for each non-rejected document.
  const documentUrls: Array<{ type: string; url: string }> = [];
  for (const doc of docRows ?? []) {
    if (doc.processing_status === "rejected") continue;
    const storagePath = `${packetId}/${doc.document_id}`;
    const { data: signed } = await db.storage
      .from("documents")
      .createSignedUrl(storagePath, 60 * 10);
    if (signed?.signedUrl) {
      documentUrls.push({ type: doc.document_kind, url: signed.signedUrl });
    }
  }

  // 4. Shape the response.
  const applicantRaw = Array.isArray(packet.applicants)
    ? (packet.applicants[0] ?? null)
    : packet.applicants;

  return c.json(
    {
      packet_id: packet.packet_id,
      state_code: packet.state_code,
      county: packet.county ?? null,
      org_id: packet.org_id ?? null,
      applicant_id: applicantRaw?.applicant_id ?? null,
      // PII fields — Phase 1 ciphertext, decryption deferred. Extension
      // content script's field-fill loop checks each field and skips when
      // the value can't be coerced (ciphertext starts with snap_v1::).
      full_name_ciphertext: applicantRaw?.full_name_ciphertext ?? null,
      date_of_birth_ciphertext: applicantRaw?.date_of_birth_ciphertext ?? null,
      phone_ciphertext: applicantRaw?.phone_ciphertext ?? null,
      address_ciphertext: applicantRaw?.address_ciphertext ?? null,
      preferred_language: applicantRaw?.preferred_language ?? "en",
      answers: answers ?? [],
      document_urls: documentUrls,
      packet_status: packet.status,
      packet_submitted_at: packet.submitted_at,
      // Phase-1 marker the content script uses to surface a warning.
      pii_decryption_status: "deferred_to_phase_2" as const,
      prepared_at: new Date().toISOString(),
    },
    200,
  );
});

export default app;
