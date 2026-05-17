import { HTTPException } from "hono/http-exception";
// SupabaseClient<any, any, any> avoids the "public" schema default mismatch
// when callers pass clients typed against a non-public schema (snap_enrollment).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = import("@supabase/supabase-js").SupabaseClient<any, any, any>;

export const HANDOFF_DISCLAIMER =
  "This handoff packet was prepared by Civica to help organize information for official SNAP review. " +
  "Civica does not determine SNAP eligibility, approve benefits, or replace an official SNAP application.";

export const STORAGE_BUCKET = "handoffs";

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface HandoffAnswer {
  question_key: string;
  applicant_value: string | null;
  navigator_confirmed_value: string | null;
  source: string | null;
  answered_at: string | null;
}

export interface HandoffDocument {
  document_id: string;
  document_kind: string | null;
  original_filename: string;
  uploaded_at: string;
  processing_status: string | null;
  byte_size: number | null;
}

export interface HandoffChecklist {
  item_id: string;
  document_kind: string | null;
  label: string;
  is_required: boolean;
  resolved_at: string | null;
  waived_at: string | null;
  waive_reason: string | null;
  resolved_document_id: string | null;
}

export interface HandoffExtraction {
  field_id: string;
  field_key: string;
  document_id: string | null;
  applicant_answer: string | null;
  original_ocr_value: string | null;
  navigator_confirmed_value: string | null;
  confidence: number | null;
  needs_review: boolean;
  reviewed_at: string | null;
}

export interface HandoffNoteMeta {
  note_id: string;
  created_at: string;
  author_staff_id: string;
}

export interface HandoffConsent {
  consent_id: string;
  consent_kind: string;
  consented_at: string;
  policy_version: string | null;
  consent_method: string | null;
}

export interface HandoffStatusEvent {
  from_status: string | null;
  to_status: string;
  occurred_at: string;
  reason: string | null;
  changed_by_staff_id: string | null;
}

export interface HandoffPayload {
  disclaimer: string;
  schema_version: 1;
  generated_at: string;
  packet: {
    packet_id: string;
    status: string;
    state_code: string | null;
    county: string | null;
    created_at: string;
    submitted_at: string | null;
    handed_off_at: string | null;
  };
  applicant: {
    applicant_id: string;
    state_code: string;
    preferred_language: string;
  } | null;
  answers: HandoffAnswer[];
  documents: {
    uploaded: HandoffDocument[];
    checklist: HandoffChecklist[];
  };
  extractions: HandoffExtraction[];
  notes_meta: HandoffNoteMeta[];
  consent: HandoffConsent | null;
  status_history: HandoffStatusEvent[];
}

export interface Blocker {
  kind: "unresolved_docs" | "unreviewed_fields" | "missing_consent";
  label: string;
  count?: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

export async function collectBlockers(
  db: AnySupabaseClient,
  packetId: string,
  applicantId: string,
): Promise<Blocker[]> {
  const blockers: Blocker[] = [];
  const [docs, fields, consent] = await Promise.all([
    db
      .schema("snap_enrollment")
      .from("required_document_items")
      .select("item_id", { count: "exact", head: true })
      .eq("packet_id", packetId)
      .eq("is_required", true)
      .is("resolved_at", null)
      .is("waived_at", null),
    db
      .schema("snap_enrollment")
      .from("extraction_fields")
      .select("field_id", { count: "exact", head: true })
      .eq("packet_id", packetId)
      .eq("needs_review", true)
      .is("reviewed_at", null),
    db
      .schema("snap_enrollment")
      .from("user_consents")
      .select("consent_id")
      .eq("applicant_id", applicantId)
      .eq("consent_kind", "privacy_notice")
      .is("revoked_at", null)
      .limit(1),
  ]);

  if ((docs.count ?? 0) > 0) {
    blockers.push({
      kind: "unresolved_docs",
      label: "Required documents not yet resolved",
      count: docs.count ?? 0,
    });
  }
  if ((fields.count ?? 0) > 0) {
    blockers.push({
      kind: "unreviewed_fields",
      label: "Extraction fields flagged for review",
      count: fields.count ?? 0,
    });
  }
  if ((consent.data?.length ?? 0) === 0) {
    blockers.push({ kind: "missing_consent", label: "Privacy notice consent not on file" });
  }
  return blockers;
}

export async function buildHandoffPayload(
  db: AnySupabaseClient,
  packetId: string,
): Promise<HandoffPayload> {
  // Phase 1: load packet to get applicant_id for scoped consent query
  const { data: packetRaw, error: packetErr } = await db
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("*, applicants(applicant_id, state_code, preferred_language, created_at)")
    .eq("packet_id", packetId)
    .is("deleted_at", null)
    .single();

  if (packetErr || !packetRaw) {
    throw new HTTPException(404, { message: "Packet not found while building handoff payload" });
  }

  type ApplicantRow = {
    applicant_id: string;
    state_code: string;
    preferred_language: string;
    created_at: string;
  };
  const applicantRel = packetRaw.applicants as unknown as ApplicantRow | ApplicantRow[] | null;
  const applicant = Array.isArray(applicantRel) ? (applicantRel[0] ?? null) : applicantRel;
  const applicantId = applicant?.applicant_id ?? "";

  // Phase 2: parallel fetch of all related data; user_consents scoped by applicant_id
  const [answersRes, docsRes, docItemsRes, fieldsRes, notesRes, consentRes, historyRes] =
    await Promise.all([
      db
        .schema("snap_enrollment")
        .from("packet_answers")
        .select(
          "question_key, applicant_value, navigator_confirmed_value, source, answered_at",
        )
        .eq("packet_id", packetId)
        .order("question_key"),
      db
        .schema("snap_enrollment")
        .from("uploaded_documents")
        .select(
          "document_id, document_kind, original_filename, uploaded_at, processing_status, byte_size",
        )
        .eq("packet_id", packetId)
        .is("deleted_at", null)
        .order("uploaded_at"),
      db
        .schema("snap_enrollment")
        .from("required_document_items")
        .select(
          "item_id, document_kind, label, is_required, resolved_at, waived_at, waive_reason, resolved_document_id",
        )
        .eq("packet_id", packetId)
        .order("created_at"),
      db
        .schema("snap_enrollment")
        .from("extraction_fields")
        .select(
          "field_id, field_key, document_id, applicant_answer, original_ocr_value, navigator_confirmed_value, confidence, needs_review, reviewed_at",
        )
        .eq("packet_id", packetId)
        .order("field_key"),
      db
        .schema("snap_enrollment")
        .from("navigator_notes")
        .select("note_id, is_internal, created_at, author_staff_id")
        .eq("packet_id", packetId)
        .is("deleted_at", null)
        .order("created_at"),
      applicantId
        ? db
            .schema("snap_enrollment")
            .from("user_consents")
            .select("consent_id, consent_kind, consented_at, policy_version, consent_method")
            .eq("applicant_id", applicantId)
            .order("consented_at", { ascending: false })
        : Promise.resolve({ data: [] as HandoffConsent[], error: null }),
      db
        .schema("snap_enrollment")
        .from("packet_status_history")
        .select("from_status, to_status, occurred_at, reason, changed_by_staff_id")
        .eq("packet_id", packetId)
        .order("occurred_at"),
    ]);

  return {
    disclaimer: HANDOFF_DISCLAIMER,
    schema_version: 1,
    generated_at: new Date().toISOString(),
    packet: {
      packet_id: packetRaw.packet_id as string,
      status: packetRaw.status as string,
      state_code: packetRaw.state_code as string | null,
      county: packetRaw.county as string | null,
      created_at: packetRaw.created_at as string,
      submitted_at: packetRaw.submitted_at as string | null,
      handed_off_at: packetRaw.handed_off_at as string | null,
    },
    applicant: applicant
      ? {
          applicant_id: applicant.applicant_id,
          state_code: applicant.state_code,
          preferred_language: applicant.preferred_language,
        }
      : null,
    answers: (answersRes.data ?? []) as HandoffAnswer[],
    documents: {
      uploaded: (docsRes.data ?? []) as HandoffDocument[],
      checklist: (docItemsRes.data ?? []) as HandoffChecklist[],
    },
    extractions: (fieldsRes.data ?? []) as HandoffExtraction[],
    notes_meta: ((notesRes.data ?? []) as Array<{ note_id: string; is_internal: boolean; created_at: string; author_staff_id: string }>)
      .filter((n) => !n.is_internal)
      .map((n) => ({
        note_id: n.note_id,
        created_at: n.created_at,
        author_staff_id: n.author_staff_id,
      })),
    consent: ((consentRes.data ?? [])[0] ?? null) as HandoffConsent | null,
    status_history: (historyRes.data ?? []) as HandoffStatusEvent[],
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
