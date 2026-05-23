import { Hono } from "hono";
import { z } from "zod";
import { supabaseAdmin } from "../../lib/supabase.js";
import { timingSafeEqual } from "node:crypto";
import {
  verifyLeaseExtraction,
  LEASE_FIELD_KEYS,
  type ExtractionField,
} from "@civica/snap-qc-engine";

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
      .update({ processing_status: "rejected" })
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

  // Fetch document kind + packet context in one query
  const { data: doc } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .select("packet_id, document_kind")
    .eq("document_id", body.document_id)
    .single();

  if (doc?.packet_id) {
    // Store OCR extraction fields
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

    // ── Lease-specific: run rent + name verification and write back results ──
    // Only runs for lease documents. Reads stated rent + leaseholder name from
    // packet_answers, cross-checks against OCR-extracted values, then writes
    // three synthetic civica_* fields back to extraction_fields so the navigator
    // review UI can surface the verification status without a separate query.
    if (doc.document_kind === "lease") {
      await runLeaseVerification({
        extractionId: extraction.extraction_id,
        packetId: doc.packet_id,
        ocrFields: fields.map((f) => ({
          field_key: String(f.name ?? ""),
          original_ocr_value: f.value != null ? String(f.value) : null,
          confidence: Number(f.confidence) || 0,
        })),
      });
    }
  }

  // Advance to awaiting_confirmation — navigator must confirm before the
  // document counts as verified. "complete" was a stale status value that
  // didn't exist in the state machine CHECK constraint.
  await supabaseAdmin
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .update({ processing_status: "awaiting_confirmation" })
    .eq("document_id", body.document_id);

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Lease verification helper
// ---------------------------------------------------------------------------

async function runLeaseVerification({
  extractionId,
  packetId,
  ocrFields,
}: {
  extractionId: string;
  packetId: string;
  ocrFields: ExtractionField[];
}): Promise<void> {
  // Fetch relevant packet answers: stated rent + stated leaseholder name
  const { data: answers } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("packet_answers")
    .select("question_key, applicant_answer")
    .eq("packet_id", packetId)
    .in("question_key", [
      "monthly_rent_or_mortgage",
      "leaseholder_name",
      "lease_in_applicant_name",
    ]);

  if (!answers?.length) return; // no intake data to compare against

  const answerMap: Record<string, string> = {};
  for (const a of answers) {
    if (a.applicant_answer != null) answerMap[a.question_key] = a.applicant_answer;
  }

  const statedRent = parseFloat(answerMap["monthly_rent_or_mortgage"] ?? "");
  if (isNaN(statedRent) || statedRent <= 0) return; // can't verify without stated rent

  const statedLeaseholderName =
    answerMap["leaseholder_name"] ?? null;

  const result = verifyLeaseExtraction({
    extraction_fields: ocrFields,
    stated_monthly_rent: statedRent,
    stated_leaseholder_name: statedLeaseholderName,
  });

  // Write three synthetic civica_* fields back to extraction_fields.
  // confidence = 1.0 — these are computed values, not OCR guesses.
  // needs_review is generated always as confidence < 0.85, so it will be
  // false for these (1.0 > 0.85), which is correct — they don't need navigator
  // review themselves; the *source* fields that fed them may.
  const syntheticFields = [
    {
      extraction_id: extractionId,
      packet_id: packetId,
      field_key: LEASE_FIELD_KEYS.RENT_VERIFICATION,
      field_label: "Civica: rent verification status",
      original_ocr_value: result.rent_match,
      confidence: 1.0,
    },
    {
      extraction_id: extractionId,
      packet_id: packetId,
      field_key: LEASE_FIELD_KEYS.NAME_VERIFICATION,
      field_label: "Civica: name verification status",
      original_ocr_value: result.name_match,
      confidence: 1.0,
    },
    {
      extraction_id: extractionId,
      packet_id: packetId,
      field_key: LEASE_FIELD_KEYS.DEFENSIBILITY_TIER,
      field_label: "Civica: lease defensibility tier",
      original_ocr_value: result.defensibility_tier,
      confidence: 1.0,
    },
  ];

  const { error } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("extraction_fields")
    .insert(syntheticFields);

  if (error) {
    console.error("ocr webhook: lease verification fields insert failed", error);
  }
}
