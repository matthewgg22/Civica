import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const upsertAnswerSchema = z.object({
  question_key: z.string().min(1).max(100),
  question_label: z.string().min(1).max(200),
  answer_source: z.string().default("applicant"),
  applicant_answer: z.string().optional(),
  original_ocr_value: z.string().optional(),
});

const reviewAnswerSchema = z.object({
  navigator_confirmed_value: z.string(),
  review_note: z.string().max(1000).optional(),
});

// List answers for a packet
app.get("/packets/:packetId/answers", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_answers")
    .select("*")
    .eq("packet_id", c.req.param("packetId"))
    .order("question_key");

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Upsert an answer (applicant writes applicant_answer; OCR writes original_ocr_value)
// Three-value immutability guard trigger enforces write-once on applicant_answer + original_ocr_value
app.put("/packets/:packetId/answers/:questionKey", zValidator("json", upsertAnswerSchema), async (c) => {
  const body = c.req.valid("json");
  const packetId = c.req.param("packetId");
  const db = await withActorContext(c);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_answers")
    .upsert({
      ...body,
      packet_id: packetId,
      question_key: c.req.param("questionKey"),
      applicant_answer: body.applicant_answer ?? null,
      original_ocr_value: body.original_ocr_value ?? null,
    }, { onConflict: "packet_id,question_key" })
    .select()
    .single();

  if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data, 201);
});

// Navigator confirms / corrects a value
app.patch("/answers/:answerId/review", zValidator("json", reviewAnswerSchema), async (c) => {
  const body = c.req.valid("json");
  const actor = c.get("actor");
  const db = await withActorContext(c);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_answers")
    .update({
      navigator_confirmed_value: body.navigator_confirmed_value,
      review_note: body.review_note ?? null,
      reviewed_by_staff_id: actor.kind !== "applicant" ? actor.id : null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("answer_id", c.req.param("answerId"))
    .select()
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Answer not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

export default app;
