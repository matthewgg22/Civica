import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient, makeServiceClient } from "../lib/supabase.js";
import { requireNavigator } from "../lib/auth.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";
import type { Logger } from "../lib/logger.js";
import { evaluateChecklist } from "@civica/snap-rules";
import { usps, fips, AddressSchema } from "@civica/state-connectors";

// Canonical source: packages/snap-enums/src/packetStatus.ts
// Inlined here to avoid adding a workspace dep for a single enum.
const PacketStatusSchema = z.enum([
  "Draft",
  "Submitted for Review",
  "Needs Documents",
  "Needs Applicant Clarification",
  "In Navigator Review",
  "Ready for Handoff",
  "Handed Off",
  "Closed",
]);

const app = new Hono<{ Bindings: Env }>();

const createPacketSchema = z.object({
  applicant_id: z.string().uuid(),
  state_code: z.enum(["CA", "MA"]),
  org_id: z.string().uuid().optional(),
  county: z.string().max(100).optional(),
  county_fips: z.string().length(5).optional(),
  // T9 integration stub. When provided AND ENABLE_ADDRESS_VALIDATION=true the
  // gateway runs USPS validation + ZIP→county resolution and uses the result
  // to populate county_fips/county when the caller hasn't set them.
  address: AddressSchema.optional(),
});

const updatePacketSchema = z.object({
  status: PacketStatusSchema.optional(),
  notes_for_applicant: z.string().max(2000).optional(),
  org_id: z.string().uuid().optional(),
  // OBBBA §10102(a) distress-review gate: navigator's decision on expedited routing
  is_expedited: z.boolean().optional(),
});

// List packets — scoped by RLS to caller's org or own packets
app.get("/", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(`
      packet_id, status, state_code, county, created_at, updated_at, submitted_at,
      applicants(applicant_id, state_code, preferred_language),
      packet_assignments(staff_id, is_current)
    `)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Get single packet
app.get("/:packetId", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select(`
      *,
      applicants(*),
      packet_answers(*),
      required_document_items(*),
      packet_assignments(*, staff_users(staff_id, display_name, email)),
      navigator_notes(note_id, is_internal, created_at, updated_at, author_staff_id)
    `)
    .eq("packet_id", c.req.param("packetId"))
    .is("deleted_at", null)
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Create packet
app.post("/", zValidator("json", createPacketSchema), async (c) => {
  const body = c.req.valid("json");
  const db = await withActorContext(c);
  // Logger is attached by requestLogger middleware in src/index.ts; the route
  // app's local Hono generic doesn't declare Variables, so we cast through get.
  const log = (c.get as (k: string) => Logger)("log");

  // T9: USPS address validation behind a feature flag. Failures are logged
  // and the packet is still created — address validation is advisory at this
  // stage, not a gate. When valid we backfill county_fips/county from the
  // local ZIP table if the caller didn't provide them.
  let resolvedCounty = body.county ?? null;
  let resolvedCountyFips = body.county_fips ?? null;
  if (c.env.ENABLE_ADDRESS_VALIDATION === "true" && body.address) {
    if (c.env.USPS_CLIENT_ID && c.env.USPS_CLIENT_SECRET) {
      try {
        const result = await usps.validateAddress(body.address, {
          credentials: {
            clientId: c.env.USPS_CLIENT_ID,
            clientSecret: c.env.USPS_CLIENT_SECRET,
          },
        });
        log.info("usps_validate", { valid: result.valid, dpv: result.delivery_point_validation });
        if (result.valid && result.normalized) {
          const fast = fips.fromZipFast(result.normalized.zip5);
          if (fast && !resolvedCountyFips) {
            resolvedCountyFips = fast.fips;
            resolvedCounty = resolvedCounty ?? fast.county_name;
          }
        }
      } catch (err) {
        log.warn("usps_validate_error", { err: String(err) });
      }
    } else {
      log.warn("usps_validate_skipped", { reason: "missing_credentials" });
    }
  }

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .insert({
      applicant_id: body.applicant_id,
      state_code: body.state_code,
      status: "Draft" as const,
      org_id: body.org_id ?? null,
      county: resolvedCounty,
      county_fips: resolvedCountyFips,
    })
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });

  // Seed required document items from the rules engine. Uses empty answers so
  // only always-required items are created at packet creation; items are
  // re-evaluated (and additional rows inserted) when the applicant submits answers.
  // Seed required document items from the rules engine. Uses empty answers so
  // only always-required items are created at packet creation; items are
  // re-evaluated (and additional rows inserted) when the applicant submits answers.
  const checklist = evaluateChecklist({ state_code: body.state_code, household_size: 1, answers: {} });
  if (checklist.required_items.length > 0) {
    const { error: itemsError } = await db
      .schema("snap_enrollment")
      .from("required_document_items")
      .insert(
        checklist.required_items.map((item) => ({
          packet_id: data.packet_id,
          state_code: body.state_code,
          // Cast is safe: snap-rules Zod schema constrains document_kind to the DB enum values.
          document_kind: item.document_kind as "paystub" | "photo_id" | "lease" | "utility_bill" | "bank_statement" | "tax_return" | "benefit_letter" | "other",
          label: item.label_en,
          is_required: item.is_required,
        })),
      );
    if (itemsError) throw new HTTPException(500, { message: itemsError.message });
  }

  return c.json(data, 201);
});

// Update packet (status transitions go through here — guard trigger enforces validity)
app.patch("/:packetId", zValidator("json", updatePacketSchema), async (c) => {
  const body = c.req.valid("json");
  const db = await withActorContext(c);

  // Pre-flight: structured low-confidence gate for "Ready for Handoff".
  // The DB trigger (snap_enrollment.enforce_status_transition) is the ultimate
  // guard, but it raises a generic P0001 error string. Doing an app-layer
  // pre-check lets us return field-level detail so the dashboard and iOS
  // clients can render which fields need review without parsing error text.
  if (body.status === "Ready for Handoff") {
    const { data: flagged, error: flaggedErr } = await db
      .schema("snap_enrollment")
      .from("extraction_fields")
      .select("field_id, field_key, confidence")
      .eq("packet_id", c.req.param("packetId"))
      .eq("needs_review", true)
      .is("reviewed_at", null);
    if (flaggedErr) throw new HTTPException(500, { message: flaggedErr.message });
    if ((flagged?.length ?? 0) > 0) {
      return c.json(
        {
          error: "low_confidence_blocks_submission",
          message:
            "Cannot advance to Ready for Handoff: extraction fields below the confidence threshold are unreviewed",
          flagged_fields: flagged,
        },
        422,
      );
    }
  }

  if (body.status) {
    const reason = c.req.header("X-Transition-Reason");
    if (reason) {
      type SetConfigArgs = { setting_name: string; new_value: string; is_local: boolean };
      const rpc = db.rpc.bind(db) as unknown as (fn: string, args: SetConfigArgs) => Promise<unknown>;
      await rpc("set_config", { setting_name: "snap_enrollment.transition_reason", new_value: reason, is_local: true });
    }
  }

  const updateFields = {
    ...(body.status !== undefined && { status: body.status }),
    notes_for_applicant: body.notes_for_applicant ?? null,
    org_id: body.org_id ?? null,
  };
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .update({
      ...(body.status !== undefined && { status: body.status }),
      ...(body.notes_for_applicant !== undefined && { notes_for_applicant: body.notes_for_applicant }),
      ...(body.org_id !== undefined && { org_id: body.org_id }),
      ...(body.is_expedited !== undefined && { is_expedited: body.is_expedited }),
    })
    .eq("packet_id", c.req.param("packetId"))
    .select()
    .single();

  if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Status history
app.get("/:packetId/history", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_status_history")
    .select("*")
    .eq("packet_id", c.req.param("packetId"))
    .order("occurred_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Buddies linked to a packet's applicant (navigator/admin only).
//
// The applicant's buddy system (apps/web BuddyBanner + routes/buddy.ts) is
// applicant-scoped: a buddy reads their OWN applicants. There is no inverse
// "who is the buddy on this case" read for staff — buddy_relationship RLS
// (buddy_relationship_read_own) only covers the buddy/applicant, not navigators.
// This endpoint adds that caseworker-side read with two-layer authorization:
//
//   1. requireNavigator(actor.kind) — role gate (rejects applicant/buddy/anon).
//   2. RLS authorization: read the packet via the anon client (caller JWT). If
//      the navigator's org can't see it, RLS returns no row → 404. This proves
//      the navigator is authorized for THIS packet before any service-role read.
//
// Then a service-role read of buddy_relationship (navigators aren't covered by
// its RLS). COLUMN-RESTRICTED: returns relationship status + timestamps + org
// linkage only — NEVER the helper's name or auth id (PII), mirroring the
// buddy_packet_summary_view PII posture.
app.get("/:packetId/buddies", async (c) => {
  const actor = c.get("actor");
  requireNavigator(actor.kind);

  const packetId = c.req.param("packetId");
  const jwt = c.get("jwt");

  // (1) RLS-scoped authorization + resolve the applicant's auth uid. snap_packets
  // .user_id is the applicant's auth.uid() (= buddy_relationship.applicant_user_id).
  const anon = makeAnonClient(c.env, jwt);
  // Cast the result: `user_id` is a real snap_packets column (see migration
  // 20260570 — buddy_packet_summary_rows reads p.user_id) but isn't in the
  // generated types. Casting also gives pErr a concrete type so the split
  // error-first check below doesn't narrow to `never` (supabase-ts-narrowing).
  const { data: packet, error: pErr } = (await anon
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, user_id")
    .eq("packet_id", packetId)
    .is("deleted_at", null)
    .single()) as {
      data: { packet_id: string; user_id: string | null } | null;
      error: { code?: string; message: string } | null;
    };

  // Error-first, split (never combine the code check with !data — it narrows
  // the discriminated union to `never`).
  if (pErr) {
    if (pErr.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
    throw new HTTPException(500, { message: pErr.message });
  }
  if (!packet) throw new HTTPException(404, { message: "Packet not found" });

  const applicantUserId = packet.user_id;
  if (!applicantUserId) return c.json([]); // no linked auth user yet → no buddies

  // (2) Service-role read (navigators aren't covered by buddy_relationship RLS).
  const svc = makeServiceClient(c.env);
  type RelRow = {
    id: string;
    status: string;
    org_id: string | null;
    notifications_enabled: boolean;
    created_at: string;
    updated_at: string;
  };
  const { data: rels, error: relErr } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svc.schema("snap_enrollment").from("buddy_relationship" as any) as any
  )
    .select("id, status, org_id, notifications_enabled, created_at, updated_at")
    .eq("applicant_user_id", applicantUserId)
    .order("created_at", { ascending: true }) as {
      data: RelRow[] | null;
      error: { message: string } | null;
    };

  if (relErr) throw new HTTPException(500, { message: relErr.message });

  // Column-restricted projection — no buddy name / auth id.
  const buddies = (rels ?? []).map((r) => ({
    relationship_id: r.id,
    status: r.status,
    org_linked: r.org_id !== null,
    notifications_enabled: r.notifications_enabled,
    linked_at: r.created_at,
    last_active: r.updated_at,
  }));

  return c.json(buddies);
});

export default app;
