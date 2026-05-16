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

export default app;
