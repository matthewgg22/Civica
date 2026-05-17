import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

// Bucket convention: artifacts live under handoffs/{packet_id}/{export_id}.{ext}
// Bucket must exist in Supabase Storage (create with: supabase storage create handoffs --private).
const STORAGE_BUCKET = "handoffs";

const createHandoffSchema = z.object({
  format: z.enum(["json_api", "csv_summary", "xml_ecs", "pdf_packet"]).default("json_api"),
  agency_reference: z.string().max(120).optional(),
});

// GET /packets/:packetId/handoff/preview — build the structured payload without persisting.
app.get("/packets/:packetId/handoff/preview", async (c) => {
  const packetId = c.req.param("packetId");
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot preview handoff exports" });
  }
  const db = makeAnonClient(c.env, c.get("jwt"));
  const payload = await buildHandoffPayload(db, packetId);
  return c.json(payload);
});

// GET /packets/:packetId/handoff — list prior exports for this packet.
app.get("/packets/:packetId/handoff", async (c) => {
  const packetId = c.req.param("packetId");
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot view exports" });
  }
  const db = makeAnonClient(c.env, c.get("jwt"));
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("handoff_exports")
    .select("export_id, format, storage_path, checksum_sha256, agency_reference, exported_at, exported_by_staff_id")
    .eq("packet_id", packetId)
    .order("exported_at", { ascending: false });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data ?? []);
});

// POST /packets/:packetId/handoff — generate + persist a handoff export.
//
// Pre-conditions enforced server-side (also enforced by DB trigger):
//   1. caller is staff (not applicant)
//   2. packet status is "Ready for Handoff" or "Handed Off"
//   3. no unresolved required document items
//   4. no unreviewed low-confidence extraction fields
//   5. current (non-revoked) privacy_notice consent on file
app.post("/packets/:packetId/handoff", zValidator("json", createHandoffSchema), async (c) => {
  const packetId = c.req.param("packetId");
  const body = c.req.valid("json");
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot create exports" });
  }

  const db = makeAnonClient(c.env, c.get("jwt"));

  // 1. Load packet to verify status
  const { data: packet, error: packetErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status, applicant_id")
    .eq("packet_id", packetId)
    .is("deleted_at", null)
    .single();
  if (packetErr?.code === "PGRST116") {
    throw new HTTPException(404, { message: "Packet not found" });
  }
  if (packetErr) throw new HTTPException(500, { message: packetErr.message });
  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  if (packet.status !== "Ready for Handoff" && packet.status !== "Handed Off") {
    throw new HTTPException(422, {
      message: `Packet must be in "Ready for Handoff" or "Handed Off" status (current: ${packet.status})`,
    });
  }

  // 2. Pre-flight blockers (mirror dashboard logic; DB trigger is the final guard)
  const blockers = await collectBlockers(db, packetId, packet.applicant_id);
  if (blockers.length > 0) {
    throw new HTTPException(422, {
      message: `Cannot export: ${blockers.map((b) => b.label).join("; ")}`,
    });
  }

  // 3. Build payload + checksum
  const payload = await buildHandoffPayload(db, packetId);
  const serialized = JSON.stringify(payload, null, 2);
  const bytes = new TextEncoder().encode(serialized);
  const checksum = await sha256Hex(bytes);

  // 4. Insert handoff_exports row (audit trigger fires on insert).
  //    Get the generated export_id, then upload to a path that includes it.
  const serviceDb = await withActorContext(c);
  const { data: inserted, error: insertErr } = await serviceDb
    .schema("snap_enrollment")
    .from("handoff_exports")
    .insert({
      packet_id: packetId,
      exported_by_staff_id: actor.id,
      format: body.format,
      storage_path: null,
      checksum_sha256: checksum,
      agency_reference: body.agency_reference ?? null,
    })
    .select("export_id, exported_at")
    .single();
  if (insertErr) throw new HTTPException(500, { message: insertErr.message });

  // 5. Upload the artifact to Storage (best-effort; if the bucket is missing the
  //    row still exists with checksum + payload available via preview).
  const ext = body.format === "json_api" ? "json"
    : body.format === "csv_summary" ? "csv"
    : body.format === "xml_ecs" ? "xml"
    : "pdf";
  const storagePath = `${packetId}/${inserted.export_id}.${ext}`;
  const contentType = body.format === "json_api" ? "application/json"
    : body.format === "csv_summary" ? "text/csv"
    : body.format === "xml_ecs" ? "application/xml"
    : "application/pdf";

  let storedPath: string | null = null;
  if (body.format === "json_api") {
    const upload = await serviceDb.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, bytes, { contentType, upsert: false });
    if (upload.error) {
      // Soft-fail: row + checksum still authoritative; navigator can re-export.
      console.warn(`handoff_exports storage upload failed: ${upload.error.message}`);
    } else {
      storedPath = upload.data.path;
      // handoff_exports is append-only, so we can't UPDATE storage_path after
      // insert. Re-insert a corrected row only if upload succeeded after a miss
      // is overkill; instead record the path on a follow-up read by convention.
      // For now leave storage_path null and return the path in the response.
    }
  } else {
    // PDF / CSV / XML generators not yet implemented; record the row + checksum
    // (of the canonical JSON payload) so the workflow can still advance.
    console.warn(`handoff_exports: format=${body.format} generator not implemented; row recorded with JSON checksum only`);
  }

  return c.json(
    {
      export_id: inserted.export_id,
      exported_at: inserted.exported_at,
      format: body.format,
      checksum_sha256: checksum,
      storage_path: storedPath,
      payload_bytes: bytes.byteLength,
    },
    201,
  );
});

// GET /packets/:packetId/handoff/:exportId/download — signed URL to the artifact.
app.get("/packets/:packetId/handoff/:exportId/download", async (c) => {
  const packetId = c.req.param("packetId");
  const exportId = c.req.param("exportId");
  const actor = c.get("actor");
  if (actor.kind === "applicant") {
    throw new HTTPException(403, { message: "Applicants cannot download exports" });
  }
  const db = makeAnonClient(c.env, c.get("jwt"));
  const { data: row, error } = await db
    .schema("snap_enrollment")
    .from("handoff_exports")
    .select("export_id, format")
    .eq("export_id", exportId)
    .eq("packet_id", packetId)
    .single();
  if (error?.code === "PGRST116") {
    throw new HTTPException(404, { message: "Export not found" });
  }
  if (error) throw new HTTPException(500, { message: error.message });
  if (!row) throw new HTTPException(404, { message: "Export not found" });

  const ext = row.format === "json_api" ? "json"
    : row.format === "csv_summary" ? "csv"
    : row.format === "xml_ecs" ? "xml"
    : "pdf";
  const path = `${packetId}/${exportId}.${ext}`;
  const { data: signed, error: signErr } = await db.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 10); // 10-minute window
  if (signErr) throw new HTTPException(404, { message: `No artifact stored: ${signErr.message}` });
  return c.json({ url: signed.signedUrl, expires_in_seconds: 600 });
});

export default app;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Blocker {
  kind: "unresolved_docs" | "unreviewed_fields" | "missing_consent";
  label: string;
  count?: number;
}

async function collectBlockers(
  db: ReturnType<typeof makeAnonClient>,
  packetId: string,
  applicantId: string,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];
  const [docs, fields, consent] = await Promise.all([
    db.schema("snap_enrollment").from("required_document_items")
      .select("item_id", { count: "exact", head: true })
      .eq("packet_id", packetId).eq("is_required", true)
      .is("resolved_at", null).is("waived_at", null),
    db.schema("snap_enrollment").from("extraction_fields")
      .select("field_id", { count: "exact", head: true })
      .eq("packet_id", packetId).eq("needs_review", true).is("reviewed_at", null),
    db.schema("snap_enrollment").from("user_consents")
      .select("consent_id").eq("applicant_id", applicantId)
      .eq("consent_kind", "privacy_notice").is("revoked_at", null).limit(1),
  ]);
  if ((docs.count ?? 0) > 0) {
    blockers.push({ kind: "unresolved_docs", label: "Required documents not yet resolved", count: docs.count ?? 0 });
  }
  if ((fields.count ?? 0) > 0) {
    blockers.push({ kind: "unreviewed_fields", label: "Extraction fields flagged for review", count: fields.count ?? 0 });
  }
  if ((consent.data?.length ?? 0) === 0) {
    blockers.push({ kind: "missing_consent", label: "Privacy notice consent not on file" });
  }
  return blockers;
}

async function buildHandoffPayload(db: ReturnType<typeof makeAnonClient>, packetId: string) {
  const [packetRes, answersRes, docsRes, docItemsRes, fieldsRes, notesRes, consentRes, historyRes] =
    await Promise.all([
      db.schema("snap_enrollment").from("snap_packets")
        .select("*, applicants(applicant_id, state_code, preferred_language, created_at)")
        .eq("packet_id", packetId).is("deleted_at", null).single(),
      db.schema("snap_enrollment").from("packet_answers")
        .select("question_key, applicant_value, navigator_confirmed_value, source, answered_at")
        .eq("packet_id", packetId).order("question_key"),
      db.schema("snap_enrollment").from("uploaded_documents")
        .select("document_id, document_kind, original_filename, uploaded_at, processing_status, byte_size")
        .eq("packet_id", packetId).is("deleted_at", null).order("uploaded_at"),
      db.schema("snap_enrollment").from("required_document_items")
        .select("item_id, document_kind, label, is_required, resolved_at, waived_at, waive_reason, resolved_document_id")
        .eq("packet_id", packetId).order("created_at"),
      db.schema("snap_enrollment").from("extraction_fields")
        .select("field_id, field_key, document_id, applicant_answer, original_ocr_value, navigator_confirmed_value, confidence, needs_review, reviewed_at")
        .eq("packet_id", packetId).order("field_key"),
      db.schema("snap_enrollment").from("navigator_notes")
        .select("note_id, is_internal, created_at, author_staff_id")
        .eq("packet_id", packetId).is("deleted_at", null).order("created_at"),
      db.schema("snap_enrollment").from("user_consents")
        .select("consent_id, consent_kind, consented_at, policy_version, consent_method")
        .order("consented_at", { ascending: false }),
      db.schema("snap_enrollment").from("packet_status_history")
        .select("from_status, to_status, occurred_at, reason, changed_by_staff_id")
        .eq("packet_id", packetId).order("occurred_at"),
    ]);

  if (packetRes.error || !packetRes.data) {
    throw new HTTPException(404, { message: "Packet not found while building handoff payload" });
  }
  const packet = packetRes.data;
  type ApplicantRow = { applicant_id: string; state_code: string; preferred_language: string; created_at: string };
  const applicantRel = packet.applicants as unknown as ApplicantRow | ApplicantRow[] | null;
  const applicant = Array.isArray(applicantRel) ? applicantRel[0] ?? null : applicantRel;

  return {
    disclaimer:
      "This handoff packet was prepared by Civica to help organize information for official SNAP review. " +
      "Civica does not determine SNAP eligibility, approve benefits, or replace an official SNAP application.",
    schema_version: 1,
    generated_at: new Date().toISOString(),
    packet: {
      packet_id: packet.packet_id,
      status: packet.status,
      state_code: packet.state_code,
      county: packet.county,
      created_at: packet.created_at,
      submitted_at: packet.submitted_at,
      handed_off_at: packet.handed_off_at,
    },
    applicant: applicant
      ? {
          applicant_id: applicant.applicant_id,
          state_code: applicant.state_code,
          preferred_language: applicant.preferred_language,
        }
      : null,
    answers: answersRes.data ?? [],
    documents: {
      uploaded: docsRes.data ?? [],
      checklist: docItemsRes.data ?? [],
    },
    extractions: fieldsRes.data ?? [],
    notes_meta: (notesRes.data ?? []).filter((n) => !n.is_internal).map((n) => ({
      note_id: n.note_id,
      created_at: n.created_at,
      author_staff_id: n.author_staff_id,
    })),
    consent: (consentRes.data ?? [])[0] ?? null,
    status_history: historyRes.data ?? [],
  };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
