// ---------------------------------------------------------------------------
// Shared Zod schemas for the enrollment-api OpenAPI spec.
//
// Imported by openapi/spec.ts. These are documentation-shaped schemas; the
// live route files use their own zValidator schemas. The drift-detection
// test in openapi/spec.test.ts asserts the registered routes still match
// the live ones — fix any drift by reconciling here, not by tweaking the test.
// ---------------------------------------------------------------------------

import { z } from "@hono/zod-openapi";

// ── Common ────────────────────────────────────────────────────────────────

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Packet not found" }),
    trace_id: z
      .string()
      .uuid()
      .optional()
      .openapi({ example: "f7c1a2b9-4c8c-4f2d-a7e3-1b6a5c2e9f10", description: "Set on 500 responses; matches request_id in server logs" }),
  })
  .openapi("Error");

export const UuidSchema = z.string().uuid();

const PacketStatusEnum = z.enum([
  "in_progress",
  "submitted",
  "approved",
  "denied",
  "withdrawn",
  "corrections_needed",
]);

const StateCodeEnum = z.enum(["CA", "MA"]);

const PayPeriodEnum = z.enum(["weekly", "biweekly", "semimonthly", "monthly", "annual"]);

// ── /me ───────────────────────────────────────────────────────────────────

export const MeSchema = z
  .object({
    id: UuidSchema,
    state_code: StateCodeEnum.nullable(),
    language: z.string().openapi({ example: "en" }),
  })
  .openapi("Me");

export const PatchMeBodySchema = z
  .object({
    state_code: StateCodeEnum.optional(),
    language: z.string().optional(),
  })
  .openapi("PatchMeBody");

// ── /me/packets ───────────────────────────────────────────────────────────

export const PacketSchema = z
  .object({
    packet_id: UuidSchema,
    applicant_id: UuidSchema,
    state_code: StateCodeEnum,
    status: PacketStatusEnum,
    current_section: z.string().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("Packet");

export const CreatePacketBodySchema = z
  .object({
    state_code: StateCodeEnum,
  })
  .openapi("CreatePacketBody");

// ── Error risk ────────────────────────────────────────────────────────────

export const ErrorRiskSchema = z
  .object({
    tier: z.enum(["high", "medium", "low", "incomplete"]),
    score: z.number().int().nullable().openapi({ example: 35 }),
    factors: z.array(z.string()).openapi({ example: ["earned_income_unverified"] }),
    engine_version: z.string().openapi({ example: "0.2.0" }),
  })
  .openapi("ErrorRiskResult");

// ── Inbox / missing items ─────────────────────────────────────────────────

export const InboxItemSchema = z
  .object({
    request_id: UuidSchema,
    packet_id: UuidSchema,
    status: z.enum(["pending", "resolved", "cancelled"]),
    label: z.string(),
    sent_at: z.string().datetime(),
    resolved_at: z.string().datetime().nullable(),
  })
  .openapi("InboxItem");

// ── Argyle ────────────────────────────────────────────────────────────────

export const ArgyleConnectionSchema = z
  .object({
    connected: z.boolean(),
    linked_accounts: z.array(z.object({ account_id: z.string() })).optional(),
  })
  .openapi("ArgyleConnection");

export const ArgyleConnectBodySchema = z
  .object({
    user_token: z.string().min(1),
    linked_accounts: z.array(z.object({ account_id: z.string() })),
  })
  .openapi("ArgyleConnectBody");

// ── Work hours ────────────────────────────────────────────────────────────

export const WorkHourLogSchema = z
  .object({
    log_id: UuidSchema,
    packet_id: UuidSchema,
    work_date: z.string().openapi({ example: "2026-05-15" }),
    hours: z.number().min(0).max(24),
    source: z.enum(["manual", "argyle", "import"]),
    notes: z.string().nullable(),
    created_at: z.string().datetime(),
  })
  .openapi("WorkHourLog");

export const PostWorkHoursBodySchema = z
  .object({
    work_date: z.string(),
    hours: z.number().min(0).max(24),
    source: z.enum(["manual", "argyle", "import"]).optional(),
    notes: z.string().optional(),
  })
  .openapi("PostWorkHoursBody");

// ── Buddy ─────────────────────────────────────────────────────────────────

export const BuddyConfigSchema = z
  .object({
    enabled: z.boolean(),
  })
  .openapi("BuddyConfig");

export const BuddyInviteBodySchema = z
  .object({
    org_code: z.string().optional(),
  })
  .openapi("BuddyInviteBody");

export const BuddyInviteResponseSchema = z
  .object({
    token: z.string(),
    expires_at: z.string().datetime(),
    accept_url: z.string().url(),
  })
  .openapi("BuddyInviteResponse");

export const BuddyAcceptBodySchema = z
  .object({
    token: z.string().min(1),
  })
  .openapi("BuddyAcceptBody");

export const BuddyAcceptResponseSchema = z
  .union([
    z.object({ relationship_id: UuidSchema }),
    z.object({ status: z.literal("navigator_access"), message: z.string() }),
  ])
  .openapi("BuddyAcceptResponse");

export const BuddyApplicantSummarySchema = z
  .object({
    relationship_id: UuidSchema,
    applicant_id: UuidSchema,
    notifications_enabled: z.boolean(),
    current_section: z.string().nullable(),
    next_action: z.string(),
    checklist_summary: z
      .object({
        packet_id: UuidSchema,
        status: PacketStatusEnum,
        last_updated: z.string().datetime(),
      })
      .nullable(),
  })
  .openapi("BuddyApplicantSummary");

// ── Recert ────────────────────────────────────────────────────────────────

export const RecertSchema = z
  .object({
    recert_id: UuidSchema,
    packet_id: UuidSchema,
    cert_period_end: z.string().nullable(),
    cert_period_end_source: z.enum(["estimated", "manual", "agency_confirmed"]).nullable(),
    status: z.enum([
      "pending",
      "interview_scheduled",
      "interview_complete",
      "submitted",
      "approved",
      "denied",
      "opted_out",
      "lapsed",
    ]),
    outcome: z.enum(["approved", "denied", "withdrawn", "lapsed"]).nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
  .openapi("Recert");

export const PatchRecertBodySchema = z
  .object({
    status: RecertSchema.shape.status.optional(),
    outcome: RecertSchema.shape.outcome.optional(),
    opted_out_at: z.string().datetime().nullable().optional(),
    interview_completed_at: z.string().datetime().nullable().optional(),
    submitted_at: z.string().datetime().nullable().optional(),
  })
  .openapi("PatchRecertBody");

// ── Feature flags ─────────────────────────────────────────────────────────

export const FeatureFlagsSchema = z
  .object({
    buddy_add_enabled: z.boolean(),
    recert_ai_enabled: z.boolean(),
    address_validation_enabled: z.boolean(),
  })
  .openapi("FeatureFlags");

// Re-export the runtime enums so spec.ts can wire path params.
export { PacketStatusEnum, StateCodeEnum, PayPeriodEnum };
