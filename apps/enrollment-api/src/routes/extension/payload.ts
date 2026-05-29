/**
 * GET /v1/enrollment/extension/packets/:packetId/payload
 *
 * Returns the BenefitsCalPayload-shaped snapshot for the extension content
 * script to autofill the BenefitsCal CBO Manager form pages. Mirrors the
 * shape produced by POST /benefitscal/prepare-export so consumers don't
 * need a second integration.
 *
 * Auth: accepts EITHER a per-CBO device-flow access token (issue #317,
 * org-scoped) OR the legacy shared EXTENSION_BEARER_TOKEN (deprecated,
 * org-agnostic — kept working until the extension migrates). When a device
 * token is used, the target packet MUST belong to the token's org or the
 * request 404s (cross-org reads are impossible). See ./auth.ts.
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
import { resolveExtensionAuth } from "./auth.js";
import type { Env } from "../../types.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/packets/:packetId/payload", rateLimit("standard"), async (c) => {
  // Auth: per-CBO device token (org-scoped) OR legacy shared token (deprecated,
  // org-agnostic). See ./auth.ts.
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

  // Set actor so withActorContext + downstream audit triggers attribute the
  // read to the right actor: 'cbo_assister' (real org_id) for a device token,
  // 'extension' (shared) for the legacy path. Per /plan-eng-review A2.
  c.set("actor", auth.actor);
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

  // ORG ISOLATION: a device token may only read packets in its own org. We
  // return 404 (not 403) on mismatch so the existence of another org's packet
  // is never disclosed. The legacy shared token has no org scope (orgId=null)
  // and skips this check — that's the documented back-compat posture.
  if (auth.method === "device_token" && packet.org_id !== auth.orgId) {
    throw new HTTPException(404, { message: "Packet not found" });
  }

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
