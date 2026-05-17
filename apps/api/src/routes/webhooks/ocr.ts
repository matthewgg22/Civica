import { Hono } from "hono";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { timingSafeEqual } from "node:crypto";

const OcrWebhookPayloadSchema = z.object({
  job_id: z.string().uuid(),
  document_id: z.string().uuid(),
  success: z.boolean(),
  fields: z.array(z.any()).optional(),
  error: z.string().optional(),
});

export const ocrWebhookRouter = new Hono();

ocrWebhookRouter.post("/api/v1/webhooks/ocr", async (c) => {
  const secret = process.env["OCR_WEBHOOK_SECRET"] ?? "";
  const sig = c.req.header("X-Civica-Signature") ?? "";

  if (secret) {
    const expected = Buffer.from(secret);
    const received = Buffer.from(sig);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return c.json({ code: "forbidden", message: "Invalid webhook signature" }, 403);
    }
  }

  const body = OcrWebhookPayloadSchema.parse(await c.req.json());

  if (!body.success || !body.fields?.length) {
    await supabaseAdmin
      .schema("snap_enrollment")
      .from("uploaded_documents")
      .update({ processing_status: "failed" })
      .eq("document_id", body.document_id);
    return c.json({ ok: true });
  }

  type RawField = { name?: unknown; value?: unknown; confidence?: unknown; bbox?: unknown; provider?: unknown };
  const fields = body.fields as RawField[];
  const avgConfidence = fields.reduce((sum, f) => sum + (Number(f.confidence) || 0), 0) / fields.length;
  const provider = String(fields[0]?.provider ?? "unknown");

  // Create the extraction record
  const { data: extraction, error: extractionError } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("document_extractions")
    .insert({
      document_id: body.document_id,
      extractor_model: provider,
      extractor_version: "1.0",
      overall_confidence: Math.round(avgConfidence * 10000) / 10000,
      extraction_flags: {},
    })
    .select("extraction_id")
    .single();

  if (extractionError) {
    console.error("ocr webhook: extraction insert failed", extractionError);
    return c.json({ code: "internal_error", message: "Failed to save extraction" }, 500);
  }

  // Look up the packet_id for this document
  const { data: doc } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .select("packet_id")
    .eq("document_id", body.document_id)
    .single();

  if (doc?.packet_id) {
    await supabaseAdmin
      .schema("snap_enrollment")
      .from("extraction_fields")
      .insert(
        fields.map((f) => ({
          extraction_id: extraction.extraction_id,
          packet_id: doc.packet_id,
          field_key: String(f.name ?? ""),
          field_label: String(f.name ?? ""),
          original_ocr_value: f.value != null ? String(f.value) : null,
          confidence: Number(f.confidence) || 0,
          needs_review: (Number(f.confidence) || 0) < 0.8,
        })),
      );
  }

  await supabaseAdmin
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .update({ processing_status: "complete" })
    .eq("document_id", body.document_id);

  return c.json({ ok: true });
});
