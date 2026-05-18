import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import type { Context } from "hono";
import { makeAnonClient, makeServiceClient } from "../lib/supabase.js";
import { getOrCreateApplicant } from "../lib/applicant.js";
import { getQuestionsForState } from "../lib/questions.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

// ── helpers ───────────────────────────────────────────────────────────────────

async function resolveApplicant(c: Context<{ Bindings: Env }>) {
  const actor = c.get("actor");
  if (actor.kind !== "applicant") {
    throw new HTTPException(403, { message: "Staff accounts must use the dashboard API" });
  }
  return getOrCreateApplicant(c.env, c.get("jwt"), actor.id);
}

function mapPacket(p: Record<string, unknown>) {
  return {
    id: p.packet_id,
    status: p.status,
    state_code: p.state_code,
    created_at: p.created_at,
    updated_at: p.updated_at,
    submitted_at: p.submitted_at ?? null,
    notes_for_applicant: p.notes_for_applicant ?? null,
  };
}

// ── Packets list + create ─────────────────────────────────────────────────────

// GET /me/packets
app.get("/", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status, state_code, created_at, updated_at, submitted_at, notes_for_applicant")
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json((data ?? []).map((p) => mapPacket(p as Record<string, unknown>)));
});

// POST /me/packets
app.post(
  "/",
  zValidator("json", z.object({ state_code: z.enum(["CA", "MA"]) })),
  async (c) => {
    const body = c.req.valid("json");
    const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
    const db = makeServiceClient(c.env);

    const { data, error } = await db
      .schema("snap_enrollment")
      .from("snap_packets")
      .insert({
        applicant_id: applicant.applicant_id,
        state_code: body.state_code,
        status: "Draft",
      })
      .select("packet_id, status, state_code, created_at, updated_at, submitted_at, notes_for_applicant")
      .single();

    if (error) throw new HTTPException(500, { message: error.message });
    return c.json(mapPacket(data as Record<string, unknown>), 201);
  }
);

// ── Single packet ─────────────────────────────────────────────────────────────

// GET /me/packets/:packetId
app.get("/:packetId", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status, state_code, created_at, updated_at, submitted_at, notes_for_applicant")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .is("deleted_at", null)
    .single();

  if (error?.code === "PGRST116") throw new HTTPException(404, { message: "Packet not found" });
  if (error) throw new HTTPException(500, { message: error.message });
  return c.json(mapPacket(data as Record<string, unknown>));
});

// GET /me/packets/:packetId/history
app.get("/:packetId/history", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  // Verify ownership
  const { data: packet, error: pErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_status_history")
    .select("to_status, occurred_at, reason")
    .eq("packet_id", c.req.param("packetId"))
    .order("occurred_at", { ascending: false });

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(
    (data ?? []).map((row) => ({
      status: row.to_status,
      timestamp: row.occurred_at,
      note: row.reason ?? null,
    }))
  );
});

// ── Questions ─────────────────────────────────────────────────────────────────

// GET /me/packets/:packetId/questions
app.get("/:packetId/questions", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data: packet, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, state_code")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (error) throw new HTTPException(500, { message: (error as any).message });

  return c.json(getQuestionsForState(packet.state_code as string));
});

// ── Answers ───────────────────────────────────────────────────────────────────

// GET /me/packets/:packetId/answers
app.get("/:packetId/answers", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data: packet, error: pErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("packet_answers")
    .select("question_key, applicant_answer, updated_at")
    .eq("packet_id", c.req.param("packetId"))
    .order("question_key");

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(
    (data ?? []).map((row) => {
      let value: unknown = row.applicant_answer;
      if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
        try { value = JSON.parse(value); } catch { /* keep as string */ }
      }
      return { question_id: row.question_key, value, saved_at: row.updated_at };
    })
  );
});

// POST /me/packets/:packetId/answers — upsert a single answer
app.post(
  "/:packetId/answers",
  zValidator("json", z.object({ question_id: z.string().min(1), value: z.unknown() })),
  async (c) => {
    const body = c.req.valid("json");
    const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);

    const anonDb = makeAnonClient(c.env, c.get("jwt"));
    const { data: packet } = await anonDb
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, state_code")
      .eq("packet_id", c.req.param("packetId"))
      .eq("applicant_id", applicant.applicant_id)
      .single();

    if (!packet) throw new HTTPException(404, { message: "Packet not found" });

    const sections = getQuestionsForState(packet.state_code as string);
    const question = sections.flatMap((s) => s.questions).find((q) => q.id === body.question_id);
    const questionLabel = question?.label ?? body.question_id;

    const serializedValue =
      typeof body.value === "string" ? body.value : JSON.stringify(body.value);

    const db = makeServiceClient(c.env);
    const { data, error } = await db
      .schema("snap_enrollment")
      .from("packet_answers")
      .upsert(
        {
          packet_id: c.req.param("packetId"),
          question_key: body.question_id,
          question_label: questionLabel,
          answer_source: "applicant_input",
          applicant_answer: serializedValue,
          original_ocr_value: null,
        },
        { onConflict: "packet_id,question_key" }
      )
      .select("question_key, updated_at")
      .single();

    if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
    if (error) throw new HTTPException(500, { message: error.message });

    return c.json({ question_id: data.question_key, value: body.value, saved_at: data.updated_at }, 201);
  }
);

// ── Documents ─────────────────────────────────────────────────────────────────

// GET /me/packets/:packetId/documents
app.get("/:packetId/documents", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
  const db = makeAnonClient(c.env, c.get("jwt"));

  const { data: packet, error: pErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (!packet) throw new HTTPException(404, { message: "Packet not found" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("required_document_items")
    .select(`
      item_id, label, is_required, document_kind,
      resolved_at, waived_at,
      uploaded_documents!resolved_document_id(document_id, processing_status, uploaded_at)
    `)
    .eq("packet_id", c.req.param("packetId"))
    .order("created_at");

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(
    (data ?? []).map((row) => {
      const docRow = row.uploaded_documents as Record<string, unknown> | null;

      let status: string;
      if (row.waived_at) {
        status = "N/A";
      } else if (row.resolved_at && docRow?.processing_status === "complete") {
        status = "Accepted for Packet";
      } else if (docRow?.processing_status === "processing") {
        status = "Needs Review";
      } else if (docRow) {
        status = "Uploaded";
      } else if (!row.is_required) {
        status = "Optional";
      } else {
        status = "Not Started";
      }

      return {
        id: row.item_id,
        name: row.label,
        status,
        required: row.is_required,
        uploaded_at: (docRow?.uploaded_at as string | null) ?? null,
      };
    })
  );
});

// ── Consent ───────────────────────────────────────────────────────────────────

// POST /me/packets/:packetId/consent
app.post(
  "/:packetId/consent",
  zValidator(
    "json",
    z.object({
      signature: z.string().min(1).max(200),
      consented_at: z.string().datetime(),
    })
  ),
  async (c) => {
    const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);
    const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null;

    const anonDb = makeAnonClient(c.env, c.get("jwt"));
    const { data: packet, error: pErr } = await anonDb
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id, status")
      .eq("packet_id", c.req.param("packetId"))
      .eq("applicant_id", applicant.applicant_id)
      .single();

    if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });
    if (packet.status !== "Draft") {
      throw new HTTPException(409, { message: "Consent already recorded or packet is not in Draft status" });
    }

    const db = makeServiceClient(c.env);
    const POLICY_VERSION = "2026-05-01";
    const consentRows = (["privacy_notice", "data_sharing", "terms_of_service"] as const).map(
      (kind) => ({
        applicant_id: applicant.applicant_id,
        consent_kind: kind,
        policy_version: POLICY_VERSION,
        consent_method: "web_checkbox" as const,
        ip_address: ip,
      })
    );

    const { error: consentErr } = await db
      .schema("snap_enrollment")
      .from("user_consents")
      .insert(consentRows);

    if (consentErr) throw new HTTPException(500, { message: consentErr.message });
    return c.body(null, 204);
  }
);

// DELETE /me/packets/:packetId/consent — revoke all consents for this applicant (service-role update)
app.delete("/:packetId/consent", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);

  const { data: packet, error: pErr } = await makeAnonClient(c.env, c.get("jwt"))
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });

  const db = makeServiceClient(c.env);
  const { error } = await db
    .schema("snap_enrollment")
    .from("user_consents")
    .update({ revoked_at: new Date().toISOString(), revoke_reason: "applicant_requested" })
    .eq("applicant_id", applicant.applicant_id)
    .is("revoked_at", null);

  if (error) throw new HTTPException(500, { message: error.message });
  return c.body(null, 204);
});

// ── Document upload URL ───────────────────────────────────────────────────────

// POST /me/packets/:packetId/upload-url — generate a Supabase Storage presigned
// upload URL for a document. The client PUTs the file directly to the returned URL
// and then calls POST /documents to register it in the DB.
app.post(
  "/:packetId/upload-url",
  zValidator("json", z.object({ filename: z.string().max(255).optional() })),
  async (c) => {
    const body = c.req.valid("json");
    const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);

    const anonDb = makeAnonClient(c.env, c.get("jwt"));
    const { data: packet, error: pErr } = await anonDb
      .schema("snap_enrollment")
      .from("snap_packets")
      .select("packet_id")
      .eq("packet_id", c.req.param("packetId"))
      .eq("applicant_id", applicant.applicant_id)
      .is("deleted_at", null)
      .single();

    if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (pErr) throw new HTTPException(500, { message: (pErr as any).message });

    const ext = body.filename?.split(".").pop()?.toLowerCase() ?? "pdf";
    const storagePath = `${applicant.applicant_id}/${c.req.param("packetId")}/${crypto.randomUUID()}.${ext}`;

    const svc = makeServiceClient(c.env);
    const { data, error } = await svc.storage.from("documents").createSignedUploadUrl(storagePath);
    if (error) throw new HTTPException(500, { message: error.message });

    return c.json({
      signed_url: data.signedUrl,
      storage_path: storagePath,
    }, 201);
  }
);

// ── Submit ────────────────────────────────────────────────────────────────────

// POST /me/packets/:packetId/submit
app.post("/:packetId/submit", async (c) => {
  const applicant = await resolveApplicant(c as Context<{ Bindings: Env }>);

  const { data: packet, error: pErr } = await makeAnonClient(c.env, c.get("jwt"))
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status")
    .eq("packet_id", c.req.param("packetId"))
    .eq("applicant_id", applicant.applicant_id)
    .single();

  if (pErr?.code === "PGRST116" || !packet) throw new HTTPException(404, { message: "Packet not found" });
  if (packet.status !== "Draft") {
    throw new HTTPException(409, { message: `Packet cannot be submitted from status "${packet.status}"` });
  }

  const db = makeServiceClient(c.env);
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .update({
      status: "Submitted for Review",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("packet_id", c.req.param("packetId"))
    .select("packet_id, status, state_code, created_at, updated_at, submitted_at, notes_for_applicant")
    .single();

  if (error?.code === "P0001") throw new HTTPException(422, { message: error.message });
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json(mapPacket(data as Record<string, unknown>));
});

export default app;
