import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

// List required document items for a packet
app.get("/packets/:packetId/document-items", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("required_document_items")
    .select("*")
    .eq("packet_id", c.req.param("packetId"))
    .order("created_at");

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

const resolveItemSchema = z.object({
  resolved_document_id: z.string().uuid().optional(),
});

const waiveItemSchema = z.object({
  waive_reason: z.string().min(1).max(1000),
});

// Mark a required document item as resolved (document received)
app.patch("/document-items/:itemId/resolve", zValidator("json", resolveItemSchema), async (c) => {
  const body = c.req.valid("json");
  const db = await withActorContext(c);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("required_document_items")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_document_id: body.resolved_document_id ?? null,
      waived_at: null,
    })
    .eq("item_id", c.req.param("itemId"))
    .select()
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Document item not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Waive a required document item (navigator override with reason)
app.patch("/document-items/:itemId/waive", zValidator("json", waiveItemSchema), async (c) => {
  const body = c.req.valid("json");
  const actor = c.get("actor");
  const db = await withActorContext(c);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("required_document_items")
    .update({
      waived_at: new Date().toISOString(),
      waive_reason: body.waive_reason,
      waived_by_staff_id: actor.kind !== "applicant" ? actor.id : null,
      resolved_at: null,
    })
    .eq("item_id", c.req.param("itemId"))
    .select()
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Document item not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

export default app;
