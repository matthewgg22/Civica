import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient, makeServiceClient } from "../lib/supabase.js";
import { getOrCreateApplicant } from "../lib/applicant.js";
import { rateLimit } from "../lib/rate-limit.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const patchMeSchema = z.object({
  state_code: z.enum(["CA", "MA"]).optional(),
  language: z.enum(["en", "es"]).optional(),
});

// GET /me — return the authenticated applicant's profile
app.get("/", async (c) => {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Staff accounts must use the dashboard API" });
  }

  const applicant = await getOrCreateApplicant(c.env, c.get("jwt"), actor.id);

  return c.json({
    id: applicant.applicant_id,
    state_code: applicant.state_code,
    language: applicant.preferred_language,
  });
});

// PATCH /me — update state_code or preferred language
app.patch("/", zValidator("json", patchMeSchema), async (c) => {
  const body = c.req.valid("json");
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Staff accounts must use the dashboard API" });
  }

  const applicant = await getOrCreateApplicant(c.env, c.get("jwt"), actor.id);

  const update: Record<string, unknown> = {};
  if (body.state_code) update.state_code = body.state_code;
  if (body.language) update.preferred_language = body.language;

  if (Object.keys(update).length === 0) {
    return c.json({ id: applicant.applicant_id, ...applicant });
  }

  const db = makeServiceClient(c.env);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("applicants")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("applicant_id", applicant.applicant_id)
    .select("applicant_id, state_code, preferred_language")
    .single();

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json({ id: data.applicant_id, state_code: data.state_code, language: data.preferred_language });
});

// GET /me/buddies — list all active BuddyRelationships for this applicant
app.get("/buddies", async (c) => {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Applicant role required" });
  }

  const db = makeServiceClient(c.env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("buddy_relationship" as any) as any)
    .select("id, buddy_user_id, status, notifications_enabled, created_at, updated_at")
    .eq("applicant_user_id", actor.id)
    .eq("status", "active")
    .order("created_at", { ascending: false }) as { data: unknown[] | null; error: { message: string } | null };

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data ?? []);
});

// DELETE /me/buddies/:id — revoke a BuddyRelationship
app.delete("/buddies/:id", async (c) => {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Applicant role required" });
  }

  const relId = c.req.param("id");
  const db = makeServiceClient(c.env);

  // Fetch the relationship to get buddy_user_id for app_metadata cleanup.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rel, error: fetchErr } = await (db.schema("snap_enrollment").from("buddy_relationship" as any) as any)
    .select("id, buddy_user_id, status")
    .eq("id", relId)
    .eq("applicant_user_id", actor.id)
    .single() as { data: { id: string; buddy_user_id: string; status: string } | null; error: { code?: string; message: string } | null };

  if (fetchErr?.code === "PGRST116" || !rel) {
    throw new HTTPException(404, { message: "Relationship not found" });
  }
  if (fetchErr) throw new HTTPException(500, { message: fetchErr.message });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (db.schema("snap_enrollment").from("buddy_relationship" as any) as any)
    .update({ status: "revoked", updated_at: new Date().toISOString() })
    .eq("id", relId)
    .eq("applicant_user_id", actor.id) as { error: { message: string } | null };

  if (updateErr) throw new HTTPException(500, { message: updateErr.message });

  // Clear app_metadata.role via Admin API on manual revoke.
  // Auto-revoke (trigger) cannot do this — tracked as TODO-18.
  const row = rel;
  const adminApiUrl = `${c.env.SUPABASE_URL}/auth/v1/admin/users/${row.buddy_user_id}`;
  await fetch(adminApiUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "apikey": c.env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${c.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ app_metadata: { role: null } }),
  }).catch(() => null); // non-fatal — worst case buddy retains role until JWT expiry (~1h)

  return c.json({ revoked: true });
});

// PATCH /me/buddies/:id — toggle notifications_enabled
const patchBuddySchema = z.object({
  notifications_enabled: z.boolean(),
});

app.patch("/buddies/:id", zValidator("json", patchBuddySchema), async (c) => {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Applicant role required" });
  }

  const relId = c.req.param("id");
  const { notifications_enabled } = c.req.valid("json");
  const db = makeServiceClient(c.env);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("buddy_relationship" as any) as any)
    .update({ notifications_enabled, updated_at: new Date().toISOString() })
    .eq("id", relId)
    .eq("applicant_user_id", actor.id)
    .select("id, notifications_enabled")
    .single() as { data: { id: string; notifications_enabled: boolean } | null; error: { code?: string; message: string } | null };

  if (error?.code === "PGRST116") {
    throw new HTTPException(404, { message: "Relationship not found" });
  }
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(data);
});

// GET /me/active-recert — return the signed-in applicant's most recent
// recertification (any status). RLS enforces that an applicant can only see
// their own. Returns 404 when no recert exists, so iOS can render a
// "start a recert first" prompt instead of an error.
app.get("/active-recert", async (c) => {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Applicant role required" });
  }

  const db = makeAnonClient(c.env, c.get("jwt"));
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("recertifications")
    .select("recert_id, packet_id, cert_period_end, status")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new HTTPException(500, { message: error.message });
  }
  if (!data) {
    throw new HTTPException(404, { message: "No active recertification" });
  }
  return c.json(data);
});

// GET /me/re-entry-suggestion — Unrath retention pillar (G2-1, 2026-05-27).
//
// Detects whether the signed-in applicant is a re-entry candidate: a household
// whose SNAP case closed within the last 90 days. Per Unrath (2024), most cases
// that close at SAR7/recert moments re-enroll within 1-3 months (the "churn"
// pattern) — and the majority were still eligible at the time of close.
//
// Returns:
//   { candidate: false, prior_packet: null }
//     — no closed packets within the recency window, or no packets at all.
//   { candidate: true, prior_packet: {...}, days_since_close: N }
//     — most recent closed packet is within the window; iOS can offer the
//       hydrated re-enrollment flow instead of a full intake.
//
// Eligibility scoring (`scoreRetentionRisk`) is not invoked here — the
// inputs (Argyle wage trend, household composition, recert outcomes) live
// across multiple queries and are best assembled on the iOS or caller side.
const RE_ENTRY_RECENCY_DAYS = 90;

app.get("/re-entry-suggestion", async (c) => {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Applicant role required" });
  }

  const db = makeAnonClient(c.env, c.get("jwt"));
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, state_code, county, county_fips, status, closed_at")
    .eq("status", "Closed")
    .not("closed_at", "is", null)
    .is("deleted_at", null)
    .order("closed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new HTTPException(500, { message: error.message });
  }
  if (!data || !data.closed_at) {
    return c.json({ candidate: false, prior_packet: null });
  }

  const closedAt = new Date(data.closed_at);
  const daysSinceClose = Math.floor(
    (Date.now() - closedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceClose > RE_ENTRY_RECENCY_DAYS) {
    return c.json({ candidate: false, prior_packet: null });
  }

  return c.json({
    candidate: true,
    days_since_close: daysSinceClose,
    prior_packet: {
      packet_id: data.packet_id,
      state_code: data.state_code,
      county: data.county,
      county_fips: data.county_fips,
      closed_at: data.closed_at,
    },
  });
});

// POST /me/re-enroll-from/:packetId — Unrath retention pillar (G2-2, 2026-05-27).
//
// Creates a new Draft packet hydrated from a recently-Closed source packet.
// The applicant re-confirms what's changed rather than re-doing the full intake.
// Per Unrath (2024), most cases that close at SAR7/recert moments are still
// eligible and re-enroll within 1-3 months — this endpoint cuts the friction.
//
// v1 hydration scope (deliberately conservative):
//   - Copies packet_answers (question_key, question_label, applicant_answer,
//     answer_source). New answer_ids are generated. Navigator review fields
//     (navigator_confirmed_value, original_ocr_value, review_note, reviewed_at,
//     reviewed_by_staff_id) are reset — those were specific to the prior cycle.
//   - NOT copied: documents (may have expired — force re-upload), extraction
//     fields (depend on documents), missing-items (recomputed against new
//     packet). Argyle/work-hours are applicant-scoped, not packet-scoped, so
//     they survive automatically.
//
// Idempotency: if the applicant has any active (non-Closed, non-deleted)
// packet, returns 200 with that existing packet rather than creating a duplicate.
// iOS retries safely.
//
// Guards:
//   - Source packet must be owned by the applicant (RLS enforces via anon client)
//   - Source packet must be Closed
//   - Source packet must have closed_at within RE_ENTRY_RECENCY_DAYS
//
// Failure modes: if the INSERT of the new packet succeeds but the answer copy
// fails partially, the empty Draft is leaked. The next call hits the
// idempotency branch and returns the leaked Draft so iOS can continue from
// there. Not transactional — Supabase JS has no transaction primitive — but
// recoverable.
app.post(
  "/re-enroll-from/:packetId",
  rateLimit("standard"),
  async (c) => {
    const actor = c.get("actor");
    if (actor.kind !== "applicant") {
      throw new HTTPException(403, { message: "Applicant role required" });
    }
    const sourcePacketId = c.req.param("packetId");

    // 1. Validate source packet via RLS-enforced read.
    const anon = makeAnonClient(c.env, c.get("jwt"));
    const { data: source, error: sourceErr } = await anon
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, state_code, county, county_fips, status, closed_at")
      .eq("packet_id", sourcePacketId)
      .is("deleted_at", null)
      .maybeSingle();

    if (sourceErr && sourceErr.code !== "PGRST116") {
      throw new HTTPException(500, { message: sourceErr.message });
    }
    if (!source) {
      throw new HTTPException(404, { message: "Source packet not found" });
    }
    if (source.status !== "Closed") {
      throw new HTTPException(400, {
        message: "Source packet must be Closed to re-enroll from",
      });
    }
    if (!source.closed_at) {
      throw new HTTPException(400, {
        message: "Source packet missing closed_at timestamp",
      });
    }
    const daysSinceClose = Math.floor(
      (Date.now() - new Date(source.closed_at).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysSinceClose > RE_ENTRY_RECENCY_DAYS) {
      throw new HTTPException(400, {
        message: "Source packet too old to re-enroll from",
      });
    }

    const applicant = await getOrCreateApplicant(c.env, c.get("jwt"), actor.id);

    // 2. Idempotency: return existing active packet if one exists.
    const service = makeServiceClient(c.env);
    const { data: existing, error: existingErr } = await service
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, status, state_code, created_at, updated_at")
      .eq("applicant_id", applicant.applicant_id)
      .neq("status", "Closed")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingErr && existingErr.code !== "PGRST116") {
      throw new HTTPException(500, { message: existingErr.message });
    }
    if (existing) {
      return c.json({
        packet: existing,
        hydrated: { answers: 0 },
        idempotent: true,
      });
    }

    // 3. Create the new Draft packet hydrated with state/county metadata.
    const { data: created, error: createErr } = await service
      .schema("snap_enrollment")
      .from("snap_packets")
      .insert({
        applicant_id: applicant.applicant_id,
        state_code: source.state_code,
        county: source.county,
        county_fips: source.county_fips,
        status: "Draft",
      })
      .select("packet_id, status, state_code, created_at, updated_at")
      .single();

    if (createErr || !created) {
      throw new HTTPException(500, {
        message: createErr?.message ?? "Failed to create new packet",
      });
    }

    // 4. Copy answers (preserving applicant-facing values, resetting review fields).
    const { data: sourceAnswers, error: answersReadErr } = await service
      .schema("snap_enrollment")
      .from("packet_answers")
      .select("question_key, question_label, applicant_answer, answer_source")
      .eq("packet_id", sourcePacketId);

    if (answersReadErr) {
      throw new HTTPException(500, { message: answersReadErr.message });
    }

    let copiedAnswers = 0;
    if (sourceAnswers && sourceAnswers.length > 0) {
      const newRows = sourceAnswers.map((a) => ({
        packet_id: created.packet_id as string,
        question_key: a.question_key,
        question_label: a.question_label,
        applicant_answer: a.applicant_answer,
        answer_source: a.answer_source,
      }));
      const { error: insertErr } = await service
        .schema("snap_enrollment")
        .from("packet_answers")
        .insert(newRows);
      if (insertErr) {
        // Leak the empty Draft; iOS retry will return it via idempotency
        // branch and the user can fill it in manually.
        throw new HTTPException(500, {
          message: `Created packet but failed to copy answers: ${insertErr.message}`,
        });
      }
      copiedAnswers = newRows.length;
    }

    return c.json(
      {
        packet: created,
        hydrated: { answers: copiedAnswers },
        idempotent: false,
      },
      201,
    );
  },
);

export default app;
