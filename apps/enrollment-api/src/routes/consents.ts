import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const recordConsentSchema = z.object({
  applicant_id: z.string().uuid(),
  consent_kind: z.enum(["privacy_notice", "data_sharing", "terms_of_service"]),
  policy_version: z.string().min(1),
  consent_method: z.string().default("in_app"),
});

app.get("/applicants/:applicantId/consents", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("user_consents")
    .select("*")
    .eq("applicant_id", c.req.param("applicantId"))
    .order("consented_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

app.post("/consents", zValidator("json", recordConsentSchema), async (c) => {
  const body = c.req.valid("json");
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null;
  const db = await withActorContext(c);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("user_consents")
    .insert({ ...body, ip_address: ip })
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data, 201);
});

export default app;
