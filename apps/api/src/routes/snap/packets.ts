// Net-new: SNAP readiness packet CRUD for iOS applicants (no Flask equivalent).
// Uses snap_enrollment schema via service-role client; RLS-equivalent scoping
// is enforced by filtering on applicant auth_uid.
import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

type AuthEnv = { Variables: { userId: string } };
export const packetsRouter = new Hono<AuthEnv>();

// List packets for the authenticated applicant
packetsRouter.get("/api/v1/snap/packets", requireAuth, async (c) => {
  const userId = c.get("userId");

  const { data: applicant } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("applicants")
    .select("applicant_id")
    .eq("auth_uid", userId)
    .single();

  if (!applicant) return c.json({ data: [] });

  const { data, error } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("*, uploaded_documents(document_id, document_kind, processing_status)")
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("snap/packets list failed", error);
    return c.json({ code: "internal_error", message: "Failed to fetch packets" }, 500);
  }
  return c.json({ data });
});

// Get a single packet
packetsRouter.get("/api/v1/snap/packets/:id", requireAuth, async (c) => {
  const userId = c.get("userId");

  const { data: applicant } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("applicants")
    .select("applicant_id")
    .eq("auth_uid", userId)
    .single();

  if (!applicant) return c.json({ code: "not_found", message: "Packet not found" }, 404);

  const { data, error } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("*, uploaded_documents(*, document_extractions(*, extraction_fields(*)))")
    .eq("packet_id", c.req.param("id"))
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .single();

  if (error?.code === "PGRST116") return c.json({ code: "not_found", message: "Packet not found" }, 404);
  if (error) return c.json({ code: "internal_error", message: "Failed to fetch packet" }, 500);
  return c.json(data);
});

// Request a signed upload URL for a document
packetsRouter.post("/api/v1/snap/packets/:id/documents/upload-url", requireAuth, async (c) => {
  const userId = c.get("userId");
  const packetId = c.req.param("id");

  const { data: applicant } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("applicants")
    .select("applicant_id")
    .eq("auth_uid", userId)
    .single();

  if (!applicant) return c.json({ code: "not_found", message: "Packet not found" }, 404);

  const { data: packet } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", packetId)
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .single();

  if (!packet) return c.json({ code: "not_found", message: "Packet not found" }, 404);

  const body = await c.req.json<{ file_name?: string }>();
  const fileName = body.file_name ?? `upload-${Date.now()}`;
  const storagePath = `documents/${packetId}/${crypto.randomUUID()}/${fileName}`;

  const { data: doc, error: docError } = await supabaseAdmin
    .schema("snap_enrollment")
    .from("uploaded_documents")
    .insert({
      packet_id: packetId,
      applicant_id: applicant.applicant_id,
      storage_path: storagePath,
      original_filename: fileName,
      on_device_quality_passed: false,
    })
    .select("document_id")
    .single();

  if (docError) {
    console.error("upload-url insert failed", docError);
    return c.json({ code: "internal_error", message: "Failed to create document record" }, 500);
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return c.json({ document_id: doc.document_id, storage_path: storagePath, expires_at: expiresAt }, 201);
});
