/**
 * Spec-only OpenAPIHono registry for apps/enrollment-api.
 *
 * Pattern matches apps/api/src/openapi/spec.ts — routes are registered with
 * full Zod schemas for documentation. Stub handlers here are never called in
 * production; real handlers live in src/routes/*.ts.
 *
 * Drift risk: a route changes shape in src/routes/ but the registration here
 * doesn't update. The contract test in src/openapi/spec.test.ts catches the
 * common cases (route exists, method matches, response schema is set), and
 * the iOS client codegen surfaces the rest at build time.
 *
 * Wired into the worker by:
 *   app.get("/openapi.json", (c) => c.json(buildOpenAPIDocument()));
 *
 * Surfaced by: /devex-review 2026-05-22 (DX gap 5).
 */

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  ErrorSchema,
  UuidSchema,
  MeSchema,
  PatchMeBodySchema,
  PacketSchema,
  CreatePacketBodySchema,
  ErrorRiskSchema,
  InboxItemSchema,
  ArgyleConnectionSchema,
  ArgyleConnectBodySchema,
  WorkHourLogSchema,
  PostWorkHoursBodySchema,
  BuddyConfigSchema,
  BuddyInviteBodySchema,
  BuddyInviteResponseSchema,
  BuddyAcceptBodySchema,
  BuddyAcceptResponseSchema,
  BuddyApplicantSummarySchema,
  RecertSchema,
  PatchRecertBodySchema,
  FeatureFlagsSchema,
} from "./schemas.js";

// Stub handler — never executed; only present so OpenAPIHono types are happy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stub = () => new Response() as any;

const BEARER = [{ bearerAuth: [] }];

const app = new OpenAPIHono();

app.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT (Supabase)",
  description:
    "Supabase-issued JWT. Applicant endpoints expect kind='applicant' (default for end users). Buddy endpoints expect kind='buddy' (set via app_metadata.role). Navigator/staff routes expect a staff_users row mapped to this auth_uid.",
});

// ── /v1/enrollment/me ─────────────────────────────────────────────────────

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/me",
    tags: ["me"],
    security: BEARER,
    summary: "Get the calling applicant's profile",
    responses: {
      200: { content: { "application/json": { schema: MeSchema } }, description: "Applicant profile" },
      403: { content: { "application/json": { schema: ErrorSchema } }, description: "Caller is not an applicant" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/v1/enrollment/me",
    tags: ["me"],
    security: BEARER,
    summary: "Update the calling applicant's state or language",
    request: { body: { content: { "application/json": { schema: PatchMeBodySchema } } } },
    responses: {
      200: { content: { "application/json": { schema: MeSchema } }, description: "Updated profile" },
      403: { content: { "application/json": { schema: ErrorSchema } }, description: "Caller is not an applicant" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/me/active-recert",
    tags: ["me"],
    security: BEARER,
    summary: "Get the applicant's active recertification, if any",
    responses: {
      200: { content: { "application/json": { schema: RecertSchema.nullable() } }, description: "Active recert or null" },
    },
  }),
  stub,
);

// ── /v1/enrollment/me/packets ─────────────────────────────────────────────

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/me/packets",
    tags: ["me-packets"],
    security: BEARER,
    summary: "List the calling applicant's packets",
    responses: {
      200: { content: { "application/json": { schema: z.array(PacketSchema) } }, description: "Packets owned by the applicant" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/enrollment/me/packets",
    tags: ["me-packets"],
    security: BEARER,
    summary: "Create a new packet for the calling applicant",
    request: { body: { content: { "application/json": { schema: CreatePacketBodySchema } } } },
    responses: {
      201: { content: { "application/json": { schema: PacketSchema } }, description: "Packet created" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/me/packets/{packetId}",
    tags: ["me-packets"],
    security: BEARER,
    summary: "Get a packet by id",
    request: { params: z.object({ packetId: UuidSchema }) },
    responses: {
      200: { content: { "application/json": { schema: PacketSchema } }, description: "Packet" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Packet not found" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/enrollment/me/packets/{packetId}/error-risk",
    tags: ["me-packets"],
    security: BEARER,
    summary: "Score the packet's pre-submission error risk",
    description:
      "Computes the same authoritative score the navigator endpoint sees. Persists a row to packet_error_risk for analytics history.",
    request: { params: z.object({ packetId: UuidSchema }) },
    responses: {
      200: { content: { "application/json": { schema: ErrorRiskSchema } }, description: "Risk tier + factors" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Packet not found" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/enrollment/me/packets/{packetId}/submit",
    tags: ["me-packets"],
    security: BEARER,
    summary: "Submit a packet for navigator review",
    description:
      "Transitions the packet to status='submitted'. NOTE: submitted is not terminal — packets can be kicked back to corrections_needed.",
    request: { params: z.object({ packetId: UuidSchema }) },
    responses: {
      200: { content: { "application/json": { schema: PacketSchema } }, description: "Submitted packet" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Packet not found" },
    },
  }),
  stub,
);

// ── /v1/enrollment/me/inbox ───────────────────────────────────────────────

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/me/inbox",
    tags: ["me-inbox"],
    security: BEARER,
    summary: "List missing-item requests across the applicant's packets",
    responses: {
      200: { content: { "application/json": { schema: z.array(InboxItemSchema) } }, description: "Inbox items" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/enrollment/me/inbox/{requestId}/resolve",
    tags: ["me-inbox"],
    security: BEARER,
    summary: "Mark a missing-item request as resolved by the applicant",
    request: { params: z.object({ requestId: UuidSchema }) },
    responses: {
      200: { content: { "application/json": { schema: InboxItemSchema } }, description: "Resolved item" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Request not found" },
    },
  }),
  stub,
);

// ── /v1/enrollment/me/argyle ──────────────────────────────────────────────

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/me/argyle",
    tags: ["me-argyle"],
    security: BEARER,
    summary: "Get the applicant's Argyle connection status",
    responses: {
      200: { content: { "application/json": { schema: ArgyleConnectionSchema } }, description: "Connection status" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/enrollment/me/argyle",
    tags: ["me-argyle"],
    security: BEARER,
    summary: "Persist a new Argyle connection for the applicant",
    request: { body: { content: { "application/json": { schema: ArgyleConnectBodySchema } } } },
    responses: {
      201: { content: { "application/json": { schema: ArgyleConnectionSchema } }, description: "Connection saved" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/v1/enrollment/me/argyle",
    tags: ["me-argyle"],
    security: BEARER,
    summary: "Revoke the applicant's Argyle connection",
    responses: {
      204: { description: "Revoked" },
    },
  }),
  stub,
);

// ── /v1/enrollment/me/work-hours ──────────────────────────────────────────

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/me/work-hours/{packetId}/hours",
    tags: ["me-work-hours"],
    security: BEARER,
    summary: "List logged work hours for a packet in a given month (ABAWD §10102)",
    request: {
      params: z.object({ packetId: UuidSchema }),
      query: z.object({ month: z.string().openapi({ example: "2026-05" }) }),
    },
    responses: {
      200: { content: { "application/json": { schema: z.array(WorkHourLogSchema) } }, description: "Hour logs" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/enrollment/me/work-hours/{packetId}/hours",
    tags: ["me-work-hours"],
    security: BEARER,
    summary: "Log work hours for an ABAWD applicant",
    request: {
      params: z.object({ packetId: UuidSchema }),
      body: { content: { "application/json": { schema: PostWorkHoursBodySchema } } },
    },
    responses: {
      201: { content: { "application/json": { schema: WorkHourLogSchema } }, description: "Hour log created" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "delete",
    path: "/v1/enrollment/me/work-hours/{packetId}/hours/{logId}",
    tags: ["me-work-hours"],
    security: BEARER,
    summary: "Delete an hour log",
    request: { params: z.object({ packetId: UuidSchema, logId: UuidSchema }) },
    responses: {
      204: { description: "Deleted" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Log not found" },
    },
  }),
  stub,
);

// ── /v1/enrollment/buddy ──────────────────────────────────────────────────

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/buddy/config",
    tags: ["buddy"],
    summary: "Feature-flag check for the buddy invite/accept flow (no auth)",
    responses: {
      200: { content: { "application/json": { schema: BuddyConfigSchema } }, description: "Buddy config" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/enrollment/buddy/invite",
    tags: ["buddy"],
    security: BEARER,
    summary: "Applicant generates a buddy invite token",
    request: { body: { content: { "application/json": { schema: BuddyInviteBodySchema } } } },
    responses: {
      201: { content: { "application/json": { schema: BuddyInviteResponseSchema } }, description: "Invite token" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "post",
    path: "/v1/enrollment/buddy/accept",
    tags: ["buddy"],
    security: BEARER,
    summary: "Helper accepts a buddy invite token",
    request: { body: { content: { "application/json": { schema: BuddyAcceptBodySchema } } } },
    responses: {
      201: { content: { "application/json": { schema: BuddyAcceptResponseSchema } }, description: "Accepted" },
      200: { content: { "application/json": { schema: BuddyAcceptResponseSchema } }, description: "Navigator already has access" },
      400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid or expired token" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/buddy/applicant-summary",
    tags: ["buddy"],
    security: BEARER,
    summary: "Buddy reads a column-restricted summary of linked applicant packets",
    description:
      "Reads through buddy_packet_summary_view — only safe columns (packet_id, status, state_code, current_section, updated_at) are returned. SSN, income, and household composition are not exposed.",
    responses: {
      200: { content: { "application/json": { schema: z.array(BuddyApplicantSummarySchema) } }, description: "Summary list" },
      403: { content: { "application/json": { schema: ErrorSchema } }, description: "Caller is not a buddy" },
    },
  }),
  stub,
);

// ── /v1/enrollment/recert ─────────────────────────────────────────────────

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/recert/{packetId}",
    tags: ["recert"],
    security: BEARER,
    summary: "Get the recertification row for a packet, creating one if missing",
    request: { params: z.object({ packetId: UuidSchema }) },
    responses: {
      200: { content: { "application/json": { schema: RecertSchema } }, description: "Recert row" },
      404: { content: { "application/json": { schema: ErrorSchema } }, description: "Packet not found" },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: "patch",
    path: "/v1/enrollment/recert/{recertId}",
    tags: ["recert"],
    security: BEARER,
    summary: "Update recertification status or outcome",
    request: {
      params: z.object({ recertId: UuidSchema }),
      body: { content: { "application/json": { schema: PatchRecertBodySchema } } },
    },
    responses: {
      200: { content: { "application/json": { schema: RecertSchema } }, description: "Updated recert" },
    },
  }),
  stub,
);

// ── /v1/enrollment/feature-flags ──────────────────────────────────────────

app.openapi(
  createRoute({
    method: "get",
    path: "/v1/enrollment/feature-flags",
    tags: ["feature-flags"],
    summary: "Read the active feature flags (no auth)",
    responses: {
      200: { content: { "application/json": { schema: FeatureFlagsSchema } }, description: "Active feature flags" },
    },
  }),
  stub,
);

// ── Export ────────────────────────────────────────────────────────────────

export function buildOpenAPIDocument() {
  return app.getOpenAPIDocument({
    openapi: "3.1.0",
    info: {
      title: "Civica Enrollment API",
      version: "0.1.0",
      description:
        "Cloudflare Workers Hono service for SNAP enrollment. Covers applicant intake, packet lifecycle, navigator inbox, buddy access, recertification, and Argyle/BenefitsCal integrations. This spec covers the iOS-facing surface; staff/navigator and webhook routes are not yet registered here.",
      contact: { name: "Civica Engineering" },
    },
    servers: [
      { url: "https://civica-enrollment-api.workers.dev", description: "Production" },
      { url: "http://localhost:8787", description: "Local wrangler dev" },
    ],
  });
}
