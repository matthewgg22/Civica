import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const createDocumentSchema = z.object({
  packet_id: z.string().uuid(),
  applicant_id: z.string().uuid(),
  storage_path: z.string().min(1),
  original_filename: z.string().max(255).optional(),
  document_kind: z.enum([
    "paystub", "photo_id", "lease", "utility_bill",
    "bank_statement", "tax_return", "benefit_letter", "other",
  ]).optional(),
  on_device_quality_passed: z.boolean().default(false),
});

const updateDocumentSchema = z.object({
  document_kind: z.enum([
    "paystub", "photo_id", "lease", "utility_bill",
    "bank_statement", "tax_return", "benefit_letter", "other",
  ]).optional(),
  processing_status: z.enum(["pending", "processing", "complete", "failed"]).optional(),
  rejected_reason: z.string().max(500).optional(),
  classification_confidence: z.number().min(0).max(1).optional(),
});

app.get("/packets/:packetId/documents", async (c) => {
  const jwt = c.get("jwt");
  const db = makeAnonClient(c.env, jwt);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .select("*, document_extractions(extraction_id, overall_confidence, extracted_at)")
    .eq("packet_id", c.req.param("packetId"))
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

app.post("/documents", zValidator("json", createDocumentSchema), async (c) => {
  const body = c.req.valid("json");
  const db = await withActorContext(c);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .insert({
      packet_id: body.packet_id,
      applicant_id: body.applicant_id,
      storage_path: body.storage_path,
      on_device_quality_passed: body.on_device_quality_passed,
      ...(body.document_kind !== undefined && { document_kind: body.document_kind }),
      ...(body.original_filename !== undefined && { original_filename: body.original_filename }),
    })
    .select()
    .single();

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data, 201);
});

app.patch("/documents/:documentId", zValidator("json", updateDocumentSchema), async (c) => {
  const body = c.req.valid("json");
  const db = await withActorContext(c);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .update({
      ...(body.document_kind !== undefined && { document_kind: body.document_kind }),
      ...(body.classification_confidence !== undefined && { classification_confidence: body.classification_confidence }),
      ...(body.processing_status !== undefined && { processing_status: body.processing_status }),
      ...(body.rejected_reason !== undefined && { rejected_reason: body.rejected_reason }),
    })
    .eq("document_id", c.req.param("documentId"))
    .select()
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Document not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data);
});

// Soft-delete
app.delete("/documents/:documentId", async (c) => {
  const db = await withActorContext(c);
  const { error } = await db
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("document_id", c.req.param("documentId"))
    .is("deleted_at", null);

  if (error) throw new HTTPException(500, { message: error.message });
  return c.body(null, 204);
});

export default app;
