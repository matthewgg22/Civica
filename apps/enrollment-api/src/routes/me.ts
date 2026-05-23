import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient, makeServiceClient } from "../lib/supabase.js";
import { getOrCreateApplicant } from "../lib/applicant.js";
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

export default app;
