/**
 * BenefitsCal CBO submission routes — Phase 1
 *
 * POST /benefitscal/prepare-export/:packetId
 *   Fetches packet data from DB, normalizes it to a BenefitsCalPayload,
 *   inserts a benefitscal_submissions row with status='pending_review',
 *   and returns the payload for navigator review before Phase 2 submission.
 *
 * GET /benefitscal/status/:packetId
 *   Returns the most recent benefitscal_submissions row for this packet.
 *
 * Phase 2 routes (POST /benefitscal/submit/:packetId) are blocked on CBO
 * Assister account approval (~2-4 weeks) and will be added to this file then.
 *
 * NOTE: Applicant PII is stored as Fernet ciphertext in the DB. For Phase 1,
 * the prepare-export route reads ciphertext values and passes them as-is into
 * the payload_json snapshot. Phase 2 will decrypt via the Fernet key and
 * normalizeForPortal before Playwright field-fill. This allows navigator review
 * of the raw packet without requiring decryption in Phase 1.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient, makeServiceClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import { runBenefitsCalSubmission } from "../lib/benefitscal-submit.js";
import type { BrowserDriverFactory } from "@civica/benefitscal-cbo";
import { browserlessDriverFactory } from "@civica/benefitscal-cbo/drivers/browserless";
import type { Env } from "../types.js";

/**
 * Optional driver factory override hook for tests. When set, the POST
 * /submit route uses this factory instead of the production default
 * (which today is unwired — no Worker-side Playwright runtime exists).
 *
 * In production the helper currently always returns a failure transcript
 * because there is no driver, which is the correct behavior until
 * BENEFITSCAL_CBO_* secrets + an external browser service are wired.
 */
let driverFactoryOverride: BrowserDriverFactory | null = null;
export function __setBenefitsCalDriverFactory(f: BrowserDriverFactory | null): void {
  driverFactoryOverride = f;
}

const app = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Request body schema for prepare-export
// ---------------------------------------------------------------------------

const prepareExportSchema = z.object({
  /**
   * Client consent type for this submission.
   * Required to populate the consent_type column (NOT NULL in DB).
   */
  consent_type: z.enum(["in_person", "telephonic", "async_portal"]).default("async_portal"),
  /**
   * ISO 8601 datetime when telephonic consent was recorded.
   * Required when consent_type = "telephonic".
   */
  telephonic_consent_recorded_at: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// POST /benefitscal/prepare-export/:packetId
// ---------------------------------------------------------------------------

app.post(
  "/prepare-export/:packetId",
  zValidator("json", prepareExportSchema),
  async (c) => {
    const packetId = c.req.param("packetId");
    const body = c.req.valid("json");
    const actor = c.get("actor");

    // Only navigators/staff may initiate a BenefitsCal submission
    if (actor.kind === "applicant") {
      throw new HTTPException(403, {
        message: "Applicants cannot initiate BenefitsCal submissions",
      });
    }

    // Validate telephonic consent constraint
    if (
      body.consent_type === "telephonic" &&
      !body.telephonic_consent_recorded_at
    ) {
      throw new HTTPException(422, {
        message:
          "telephonic_consent_recorded_at is required when consent_type is telephonic",
      });
    }

    const db = makeAnonClient(c.env, c.get("jwt"));

    // 1. Fetch packet with applicant info and answers
    const { data: packet, error: packetErr } = await db
      .schema("snap_enrollment")
      .from("snap_packets")
      .select(`
        packet_id, status, state_code, org_id, county, submitted_at,
        applicants(applicant_id, full_name_ciphertext, date_of_birth_ciphertext, phone_ciphertext, address_ciphertext, preferred_language)
      `)
      .eq("packet_id", packetId)
      .is("deleted_at", null)
      .single();

    if (packetErr?.code === "PGRST116") {
      throw new HTTPException(404, { message: "Packet not found" });
    }
    if (packetErr) throw new HTTPException(500, { message: packetErr.message });
    if (!packet) throw new HTTPException(404, { message: "Packet not found" });

    // 2. Fetch packet answers (for income/household fallback if QC not run)
    const { data: answers, error: answersErr } = await db
      .schema("snap_enrollment")
      .from("packet_answers")
      .select("question_key, applicant_answer, navigator_confirmed_value")
      .eq("packet_id", packetId)
      .order("question_key");

    if (answersErr) throw new HTTPException(500, { message: answersErr.message });

    // 3. Fetch uploaded documents with signed URLs
    //    (Storage sign-URL calls are best-effort; missing URLs are excluded)
    const { data: docRows, error: docsErr } = await db
      .schema("snap_enrollment")
      .from("uploaded_documents")
      .select("document_id, document_kind, processing_status")
      .eq("packet_id", packetId)
      .is("deleted_at", null);

    if (docsErr) throw new HTTPException(500, { message: docsErr.message });

    // Generate signed URLs for each document (10-minute window)
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

    // 4. Build the payload snapshot
    //    Phase 1: ciphertext fields are stored as-is; Phase 2 will decrypt
    //    before Playwright field-fill. This snapshot captures the raw state
    //    for navigator review and audit purposes.
    const applicantRaw = Array.isArray(packet.applicants)
      ? (packet.applicants[0] ?? null)
      : packet.applicants;

    const payloadSnapshot = {
      packet_id: packet.packet_id,
      state_code: packet.state_code,
      county: packet.county ?? null,
      org_id: packet.org_id ?? null,

      // Applicant fields — ciphertext in Phase 1; Phase 2 will have decrypted values
      // after Fernet decrypt. Navigator reviews the raw packet from the dashboard.
      applicant_id: applicantRaw?.applicant_id ?? null,
      // NOTE: PII fields below are ciphertext. Do not log or expose in error messages.
      full_name_ciphertext: applicantRaw?.full_name_ciphertext ?? null,
      date_of_birth_ciphertext: applicantRaw?.date_of_birth_ciphertext ?? null,
      phone_ciphertext: applicantRaw?.phone_ciphertext ?? null,
      address_ciphertext: applicantRaw?.address_ciphertext ?? null,

      answers: answers ?? [],
      document_urls: documentUrls,
      consent_type: body.consent_type,
      telephonic_consent_recorded_at: body.telephonic_consent_recorded_at ?? null,
      prepared_at: new Date().toISOString(),
    };

    // 5. Insert benefitscal_submissions row
    const serviceDb = await withActorContext(c);
    const { data: submission, error: insertErr } = await serviceDb
      .schema("snap_enrollment")
      .from("benefitscal_submissions")
      .insert({
        packet_id: packetId,
        org_id: packet.org_id ?? actor.orgId ?? "",
        payload_json: payloadSnapshot,
        status: "pending_review",
        consent_type: body.consent_type,
        telephonic_consent_recorded_at: body.telephonic_consent_recorded_at ?? null,
      })
      .select("submission_id, status, created_at")
      .single();

    if (insertErr) throw new HTTPException(500, { message: insertErr.message });

    return c.json(
      {
        submission_id: submission.submission_id,
        status: submission.status,
        created_at: submission.created_at,
        payload: payloadSnapshot,
      },
      201,
    );
  },
);

// ---------------------------------------------------------------------------
// POST /benefitscal/submit/:packetId  (Session M1 — Phase 2 async submission)
//
// Flow:
//   1. Navigator must have already called prepare-export, producing a
//      'pending_review' row with payload_json populated.
//   2. POST /submit reuses that snapshot, idempotency-checks for an
//      in-flight or successful submission, inserts a new 'queued' row, and
//      kicks off the Playwright submitter via ctx.waitUntil.
//   3. Returns 202 immediately. The background task transitions the row
//      through running → succeeded|failed.
//
// Critical design (locked): ctx.waitUntil, NOT Cloudflare Queues. At pilot
// scale (~5 submissions/month) Queues is over-engineering. Revisit at ~100/mo.
// ---------------------------------------------------------------------------

const submitBodySchema = z.object({
  /** Explicit opt-in to prevent accidental submission. */
  confirm: z.literal(true),
});

app.post(
  "/submit/:packetId",
  zValidator("json", submitBodySchema),
  async (c) => {
    const packetId = c.req.param("packetId");
    const actor = c.get("actor");

    if (actor.kind === "applicant") {
      throw new HTTPException(403, {
        message: "Applicants cannot initiate BenefitsCal submissions",
      });
    }

    const db = makeServiceClient(c.env);

    // 1. Idempotency check — return the existing in-flight or succeeded row
    //    if one already exists for this packet.
    const { data: existing } = await db
      .schema("snap_enrollment")
      .from("benefitscal_submissions")
      .select("submission_id, status, submitted_at")
      .eq("packet_id", packetId)
      .in("status", ["queued", "running", "succeeded"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      return c.json(
        {
          submission_id: existing.submission_id,
          status: existing.status,
          idempotent: true,
        },
        202,
      );
    }

    // 2. Locate the most recent 'pending_review' row for this packet to
    //    reuse its payload snapshot. (Phase 1 produces this row.)
    const { data: pending, error: pendingErr } = await db
      .schema("snap_enrollment")
      .from("benefitscal_submissions")
      .select("payload_json, org_id, consent_type, telephonic_consent_recorded_at")
      .eq("packet_id", packetId)
      .eq("status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingErr) {
      throw new HTTPException(500, { message: pendingErr.message });
    }
    if (!pending) {
      throw new HTTPException(404, {
        message:
          "No pending_review snapshot for this packet — call POST /benefitscal/prepare-export first.",
      });
    }

    // 3. Insert the queued submission row.
    const serviceDb = await withActorContext(c);
    const { data: row, error: insertErr } = await serviceDb
      .schema("snap_enrollment")
      .from("benefitscal_submissions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        packet_id: packetId,
        org_id: pending.org_id,
        payload_json: pending.payload_json,
        status: "queued",
        consent_type: pending.consent_type,
        telephonic_consent_recorded_at: pending.telephonic_consent_recorded_at,
        initiated_by_staff_id: actor.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("submission_id, status")
      .single();

    if (insertErr || !row) {
      throw new HTTPException(500, {
        message: insertErr?.message ?? "Failed to enqueue submission",
      });
    }

    // 4. Kick off the background submission via ctx.waitUntil.
    //    Without a driverFactory override, runBenefitsCalSubmission will
    //    record a clean failure (no driver = no submitter). When the
    //    external browser service is wired, that override is set at
    //    startup and the same code path drives the real portal.
    //
    // Defensive: in unit tests, executionCtx may not be available.
    // Fall back to fire-and-forget Promise so tests still cover the
    // happy path without needing to inject an ExecutionContext.
    const waitUntil: (p: Promise<unknown>) => void = (p) => {
      try {
        c.executionCtx.waitUntil(p);
      } catch {
        // No ExecutionContext (test harness) — let the promise run detached.
        // Errors are swallowed by the inner .catch() below.
        void p;
      }
    };
    // Driver resolution order:
    //   1. driverFactoryOverride — set by tests via __setBenefitsCalDriverFactory.
    //   2. BROWSERLESS_API_KEY in env — production path (TODO-15).
    //   3. null — graceful DRIVER_NOT_WIRED failure (dev / staging without secrets).
    const factory: BrowserDriverFactory | null =
      driverFactoryOverride ??
      (c.env.BROWSERLESS_API_KEY
        ? browserlessDriverFactory({ apiKey: c.env.BROWSERLESS_API_KEY })
        : null);
    if (factory) {
      waitUntil(
        runBenefitsCalSubmission({
          submissionId: row.submission_id,
          packetId,
          snapshot: pending.payload_json,
          env: c.env,
          driverFactory: factory,
        }).catch(async (err) => {
          // Best-effort: mark the row as failed so navigator can retry.
          await db
            .schema("snap_enrollment")
            .from("benefitscal_submissions")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({
              status: "failed",
              error_message: err instanceof Error ? err.message : String(err),
              playwright_log: {
                error: { message: String(err), step: "waitUntil_catch" },
                transcript: [],
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
            .eq("submission_id", row.submission_id);
        }),
      );
    } else {
      // No driver wired — log and leave the row in 'queued'. A subsequent
      // call to a background reconciler (future work) or a retry once the
      // driver is wired will pick it up. For now, immediately mark failed
      // with a clear message so the navigator sees it.
      waitUntil(
        Promise.resolve(db
          .schema("snap_enrollment")
          .from("benefitscal_submissions")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({
            status: "failed",
            error_message:
              "BenefitsCal browser driver not wired in this environment. Use manual PDF export SOP until M2 ships.",
            playwright_log: {
              error: { message: "DRIVER_NOT_WIRED", step: "queued" },
              transcript: [],
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any)
          .eq("submission_id", row.submission_id)
          .then(() => undefined)),
      );
    }

    return c.json(
      {
        submission_id: row.submission_id,
        status: "queued",
        idempotent: false,
      },
      202,
    );
  },
);

// ---------------------------------------------------------------------------
// GET /benefitscal/status/:packetId
// ---------------------------------------------------------------------------

app.get("/status/:packetId", async (c) => {
  const packetId = c.req.param("packetId");
  const actor = c.get("actor");

  if (actor.kind === "applicant") {
    throw new HTTPException(403, {
      message: "Applicants cannot view BenefitsCal submission status",
    });
  }

  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("benefitscal_submissions")
    .select(`
      submission_id, packet_id, status, consent_type,
      benefitscal_confirmation_number, submitted_at, submitted_by,
      assister_account_id, error_message, retry_count,
      created_at, updated_at
    `)
    .eq("packet_id", packetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error?.code === "PGRST116") {
    throw new HTTPException(404, {
      message: "No BenefitsCal submission found for this packet",
    });
  }
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(data);
});

export default app;
