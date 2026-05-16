import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const createNoteSchema = z.object({
  body_ciphertext: z.string().min(1),
  is_internal: z.boolean().default(true),
});

// Notes visible to caller: applicants see is_internal=false only (RLS enforces)
app.get("/packets/:packetId/notes", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("navigator_notes")
    .select("note_id, is_internal, created_at, updated_at, author_staff_id")
    .eq("packet_id", c.req.param("packetId"))
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

app.post("/packets/:packetId/notes", zValidator("json", createNoteSchema), async (c) => {
  const body = c.req.valid("json");
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot create notes" });
  }

  const db = await withActorContext(c);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("navigator_notes")
    .insert({
      ...body,
      packet_id: c.req.param("packetId"),
      author_staff_id: actor.id,
    })
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data, 201);
});

// Soft-delete
app.delete("/notes/:noteId", async (c) => {
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot delete notes" });
  }

  const db = await withActorContext(c);
  const { error } = await db
    .schema("snap_enrollment")
    .from("navigator_notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("note_id", c.req.param("noteId"))
    .eq("author_staff_id", actor.id)
    .is("deleted_at", null);

  if (error) throw new HTTPException(500, { message: error.message });
  return c.body(null, 204);
});

export default app;
