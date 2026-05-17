// PDF handoff export for navigator staff.
// Runs on Fly Node (not CF Workers) because @react-pdf/renderer requires Node.js.
import * as React from "react";
import { Hono } from "hono";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { requireAuth } from "../../middleware/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import {
  buildHandoffPayload,
  collectBlockers,
  sha256Hex,
  STORAGE_BUCKET,
  HANDOFF_DISCLAIMER,
} from "@civica/snap-handoff";
import type { HandoffPayload } from "@civica/snap-handoff";

type AuthEnv = { Variables: { userId: string } };
export const handoffRouter = new Hono<AuthEnv>();

handoffRouter.post("/api/v1/snap/handoff/:packet_id/pdf", requireAuth, async (c) => {
  const userId = c.get("userId");
  const packetId = c.req.param("packet_id");
  const body = await c.req.json<{ agency_reference?: string }>().catch(() => ({}));

  // Verify staff membership
  const { data: staffUser } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("staff_users")
    .select("staff_id, org_id")
    .eq("auth_uid", userId)
    .is("deleted_at", null)
    .single();

  if (!staffUser) {
    return c.json({ code: "forbidden", message: "Staff access required" }, 403);
  }

  // Load packet and verify status
  const { data: packet } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status, applicant_id")
    .eq("packet_id", packetId)
    .is("deleted_at", null)
    .single();

  if (!packet) {
    return c.json({ code: "not_found", message: "Packet not found" }, 404);
  }

  if (packet.status !== "Ready for Handoff" && packet.status !== "Handed Off") {
    return c.json(
      {
        code: "unprocessable_entity",
        message: `Packet must be in "Ready for Handoff" or "Handed Off" status (current: ${packet.status})`,
      },
      422,
    );
  }

  // Pre-flight blockers (DB trigger is the final guard)
  const blockers = await collectBlockers(supabaseAdmin, packetId, packet.applicant_id);
  if (blockers.length > 0) {
    return c.json(
      {
        code: "unprocessable_entity",
        message: `Cannot export: ${blockers.map((b) => b.label).join("; ")}`,
      },
      422,
    );
  }

  // Build structured payload
  const payload = await buildHandoffPayload(supabaseAdmin, packetId);
  const exportedAt = new Date().toISOString();

  // Compute data checksum (sha256 of canonical payload JSON).
  // This checksum is stored in handoff_exports and printed in the PDF footer
  // so recipients can verify data integrity against the JSON preview.
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const dataChecksum = await sha256Hex(payloadBytes);

  // Render PDF
  const pdfBuffer = await renderHandoffPdf(payload, staffUser.staff_id, dataChecksum, exportedAt);

  // Insert handoff_exports row (audit trigger fires)
  const { data: inserted, error: insertErr } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("handoff_exports")
    .insert({
      packet_id: packetId,
      exported_by_staff_id: staffUser.staff_id,
      format: "pdf_packet",
      storage_path: null,
      checksum_sha256: dataChecksum,
      agency_reference: (body as { agency_reference?: string }).agency_reference ?? null,
    })
    .select("export_id, exported_at")
    .single();

  if (insertErr) {
    return c.json({ code: "internal_error", message: insertErr.message }, 500);
  }

  // Upload PDF to storage (best-effort; row + checksum are authoritative)
  const storagePath = `${packetId}/${inserted.export_id}.pdf`;
  const upload = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: false });

  if (upload.error) {
    console.warn(`PDF storage upload failed: ${upload.error.message}`);
  }

  return c.json(
    {
      export_id: inserted.export_id,
      exported_at: inserted.exported_at,
      format: "pdf_packet",
      checksum_sha256: dataChecksum,
      storage_path: upload.error ? null : upload.data.path,
      payload_bytes: pdfBuffer.byteLength,
    },
    201,
  );
});

// ---------------------------------------------------------------------------
// PDF layout
// ---------------------------------------------------------------------------

const S = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  disclaimer: {
    fontSize: 7.5,
    color: "#555",
    fontStyle: "italic",
    marginBottom: 12,
    lineHeight: 1.4,
  },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  sectionHead: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#555",
    marginTop: 12,
    marginBottom: 4,
    borderBottom: "0.5 solid #ccc",
    paddingBottom: 2,
  },
  kv: { flexDirection: "row", marginBottom: 2 },
  kvKey: { width: 140, color: "#555" },
  kvVal: { flex: 1 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    padding: "3 4",
    fontFamily: "Helvetica-Bold",
  },
  tableRow: { flexDirection: "row", padding: "3 4", borderBottom: "0.5 solid #e5e7eb" },
  col1: { width: 160 },
  col2: { width: 140 },
  col3: { flex: 1 },
  bullet: { marginBottom: 2, flexDirection: "row" },
  bulletDot: { width: 12 },
  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#d1fae5",
    color: "#065f46",
    padding: "2 6",
    borderRadius: 3,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: "#888",
    borderTop: "0.5 solid #ddd",
    paddingTop: 4,
  },
});

function maskId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

function HandoffPdf({
  payload,
  staffId,
  dataChecksum,
  exportedAt,
}: {
  payload: HandoffPayload;
  staffId: string;
  dataChecksum: string;
  exportedAt: string;
}) {
  const { packet, applicant, answers, documents, notes_meta, consent } = payload;

  const missingItems = documents.checklist.filter(
    (i) => i.is_required && !i.resolved_at && !i.waived_at,
  );

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <Text style={S.title}>SNAP Enrollment Readiness Packet</Text>
        <Text style={S.disclaimer}>{HANDOFF_DISCLAIMER}</Text>

        {/* Applicant block */}
        <Text style={S.sectionHead}>Applicant Information</Text>
        <View style={S.kv}>
          <Text style={S.kvKey}>Applicant ID (masked)</Text>
          <Text style={S.kvVal}>{applicant ? maskId(applicant.applicant_id) : "—"}</Text>
        </View>
        <View style={S.kv}>
          <Text style={S.kvKey}>State</Text>
          <Text style={S.kvVal}>{packet.state_code ?? applicant?.state_code ?? "—"}</Text>
        </View>
        <View style={S.kv}>
          <Text style={S.kvKey}>County</Text>
          <Text style={S.kvVal}>{packet.county ?? "—"}</Text>
        </View>
        <View style={S.kv}>
          <Text style={S.kvKey}>Preferred language</Text>
          <Text style={S.kvVal}>{applicant?.preferred_language ?? "—"}</Text>
        </View>
        {consent && (
          <View style={S.kv}>
            <Text style={S.kvKey}>Privacy notice consent</Text>
            <Text style={S.kvVal}>
              {consent.consent_kind} — {consent.consented_at.slice(0, 10)} (
              {consent.consent_method ?? "unknown method"})
            </Text>
          </View>
        )}

        {/* Status */}
        <Text style={S.sectionHead}>Packet Status</Text>
        <Text style={S.statusBadge}>{packet.status}</Text>
        {packet.submitted_at && (
          <View style={{ ...S.kv, marginTop: 4 }}>
            <Text style={S.kvKey}>Submitted</Text>
            <Text style={S.kvVal}>{packet.submitted_at.slice(0, 10)}</Text>
          </View>
        )}

        {/* Answers table */}
        {answers.length > 0 && (
          <>
            <Text style={S.sectionHead}>Applicant Answers</Text>
            <View style={S.tableHeader}>
              <Text style={S.col1}>Question key</Text>
              <Text style={S.col2}>Applicant answer</Text>
              <Text style={S.col3}>Navigator confirmed</Text>
            </View>
            {answers.map((a) => (
              <View key={a.question_key} style={S.tableRow} wrap={false}>
                <Text style={S.col1}>{a.question_key}</Text>
                <Text style={S.col2}>{a.applicant_answer ?? "—"}</Text>
                <Text style={S.col3}>{a.navigator_confirmed_value ?? "—"}</Text>
              </View>
            ))}
          </>
        )}

        {/* Document checklist */}
        {documents.checklist.length > 0 && (
          <>
            <Text style={S.sectionHead}>Document Checklist</Text>
            <View style={S.tableHeader}>
              <Text style={S.col1}>Document type</Text>
              <Text style={S.col2}>Label</Text>
              <Text style={S.col3}>Status</Text>
            </View>
            {documents.checklist.map((item) => {
              const status = item.resolved_at
                ? "Resolved"
                : item.waived_at
                  ? "Waived"
                  : item.is_required
                    ? "Missing (required)"
                    : "Not provided";
              return (
                <View key={item.item_id} style={S.tableRow} wrap={false}>
                  <Text style={S.col1}>{item.document_kind ?? "—"}</Text>
                  <Text style={S.col2}>{item.label}</Text>
                  <Text style={S.col3}>{status}</Text>
                </View>
              );
            })}
            {missingItems.length > 0 && (
              <Text style={{ marginTop: 4, color: "#b45309", fontSize: 8 }}>
                {missingItems.length} required item(s) not yet resolved or waived.
              </Text>
            )}
          </>
        )}

        {/* Notes flagged for handoff */}
        {notes_meta.length > 0 && (
          <>
            <Text style={S.sectionHead}>Navigator Notes (for handoff)</Text>
            {notes_meta.map((n) => (
              <View key={n.note_id} style={S.bullet}>
                <Text style={S.bulletDot}>•</Text>
                <Text>
                  Note {maskId(n.note_id)} — {n.created_at.slice(0, 10)} by navigator{" "}
                  {maskId(n.author_staff_id)}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Footer — fixed to bottom of every page */}
        <View style={S.footer} fixed>
          <Text>Exported: {exportedAt}</Text>
          <Text>By: {maskId(staffId)}</Text>
          <Text>sha256 (payload): {dataChecksum.slice(0, 16)}…</Text>
        </View>
      </Page>
    </Document>
  );
}

async function renderHandoffPdf(
  payload: HandoffPayload,
  staffId: string,
  dataChecksum: string,
  exportedAt: string,
): Promise<Buffer> {
  const element = (
    <HandoffPdf
      payload={payload}
      staffId={staffId}
      dataChecksum={dataChecksum}
      exportedAt={exportedAt}
    />
  );
  return renderToBuffer(element);
}
