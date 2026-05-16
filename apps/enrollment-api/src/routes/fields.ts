import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

// List extraction fields for a packet (unreviewed first, then by field_key)
app.get("/packets/:packetId/fields", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("extraction_fields")
    .select("*")
    .eq("packet_id", c.req.param("packetId"))
    .order("needs_review", { ascending: false })
    .order("field_key");

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

const reviewFieldSchema = z.object({
  navigator_confirmed_value: z.string(),
  review_note: z.string().max(1000).optional(),
});

// Navigator confirms / corrects an extracted field value
app.patch("/fields/:fieldId/review", zValidator("json", reviewFieldSchema), async (c) => {
  const body = c.req.valid("json");
  const actor = c.get("actor");
  const db = await withActorContext(c);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("extraction_fields")
    .update({
      navigator_confirmed_value: body.navigator_confirmed_value,
      review_note: body.review_note ?? null,
      reviewed_by_staff_id: actor.kind !== "applicant" ? actor.id : null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("field_id", c.req.param("fieldId"))
    .select()
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Field not found" });
  if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

export default app;
