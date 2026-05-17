import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeAnonClient } from "../lib/supabase.js";
import { withActorContext } from "../middleware/actorContext.js";
import type { Env } from "../types.js";
import {
  buildHandoffPayload,
  collectBlockers,
  sha256Hex,
  STORAGE_BUCKET,
} from "@civica/snap-handoff";
import type { HandoffPayload } from "@civica/snap-handoff";

const app = new Hono<{ Bindings: Env }>();

const createHandoffSchema = z.object({
  format: z.enum(["json_api", "csv_summary", "xml_ecs", "pdf_packet"]).default("json_api"),
  agency_reference: z.string().max(120).optional(),
});

// GET /packets/:packetId/handoff/preview — build payload without persisting.
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
    .select(
      "export_id, format, storage_path, checksum_sha256, agency_reference, exported_at, exported_by_staff_id",
    )
    .eq("packet_id", packetId)
    .order("exported_at", { ascending: false });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(data ?? []);
});

// POST /packets/:packetId/handoff — generate + persist a handoff export.
//
// Handles json_api and csv_summary. pdf_packet is served by apps/api.
//
// Pre-conditions (mirrored by DB trigger):
//   1. caller is staff
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
  if (body.format === "pdf_packet") {
    throw new HTTPException(422, {
      message: "PDF generation is handled by the dedicated /api/v1/snap/handoff/:packet_id/pdf endpoint",
    });
  }
  if (body.format === "xml_ecs") {
    throw new HTTPException(422, { message: "XML ECS format is not yet implemented" });
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

  // 2. Pre-flight blockers (DB trigger is the final guard)
  const blockers = await collectBlockers(db, packetId, packet.applicant_id);
  if (blockers.length > 0) {
    throw new HTTPException(422, {
      message: `Cannot export: ${blockers.map((b) => b.label).join("; ")}`,
    });
  }

  // 3. Build the structured payload, then serialize to the requested format
  const payload = await buildHandoffPayload(db, packetId);
  const exportedAt = new Date().toISOString();

  let outputBytes: Uint8Array;
  let outputContentType: string;

  if (body.format === "json_api") {
    const serialized = JSON.stringify(payload, null, 2);
    outputBytes = new TextEncoder().encode(serialized);
    outputContentType = "application/json";
  } else {
    // csv_summary
    const csvString = buildHandoffCsv(payload, exportedAt);
    outputBytes = new TextEncoder().encode(csvString);
    outputContentType = "text/csv";
  }

  const checksum = await sha256Hex(outputBytes);

  // 4. Insert handoff_exports row (audit trigger fires on insert)
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

  // 5. Upload artifact to Storage (best-effort; row + checksum are authoritative)
  const ext = body.format === "json_api" ? "json" : "csv";
  const storagePath = `${packetId}/${inserted.export_id}.${ext}`;

  let storedPath: string | null = null;
  const upload = await serviceDb.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, outputBytes, { contentType: outputContentType, upsert: false });
  if (upload.error) {
    console.warn(`handoff_exports storage upload failed (${body.format}): ${upload.error.message}`);
  } else {
    storedPath = upload.data.path;
  }

  return c.json(
    {
      export_id: inserted.export_id,
      exported_at: inserted.exported_at,
      format: body.format,
      checksum_sha256: checksum,
      storage_path: storedPath,
      payload_bytes: outputBytes.byteLength,
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

  const ext =
    row.format === "json_api"
      ? "json"
      : row.format === "csv_summary"
        ? "csv"
        : row.format === "xml_ecs"
          ? "xml"
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
// CSV renderer
// ---------------------------------------------------------------------------

function buildHandoffCsv(payload: HandoffPayload, exportedAt: string): string {
  const missingItemCount = payload.documents.checklist.filter(
    (i) => i.is_required && !i.resolved_at && !i.waived_at,
  ).length;

  const lines: string[] = [];

  // Section 1 — packet summary (one header row + one data row)
  lines.push(
    "packet_id,status,state,county,submitted_at,exported_at,doc_count,missing_item_count",
  );
  lines.push(
    [
      csvCell(payload.packet.packet_id),
      csvCell(payload.packet.status),
      csvCell(payload.packet.state_code ?? ""),
      csvCell(payload.packet.county ?? ""),
      csvCell(payload.packet.submitted_at ?? ""),
      csvCell(exportedAt),
      String(payload.documents.uploaded.length),
      String(missingItemCount),
    ].join(","),
  );

  // Blank line between sections
  lines.push("");

  // Section 2 — per-answer rows
  lines.push("question_key,applicant_value,navigator_confirmed_value");
  for (const answer of payload.answers) {
    lines.push(
      [
        csvCell(answer.question_key),
        csvCell(answer.applicant_value ?? ""),
        csvCell(answer.navigator_confirmed_value ?? ""),
      ].join(","),
    );
  }

  return lines.join("\r\n");
}

function csvCell(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
