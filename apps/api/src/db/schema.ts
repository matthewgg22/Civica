// Hand-written from supabase/migrations/20260510_add_snap_initial_schema.sql.
// Regenerate via: pnpm run db:gen-types (overwrites this file with codegen output)
// Requires: DATABASE_URL pointing at a Postgres with the migration applied.

import type { ColumnType, Generated } from 'kysely';

type UUID = string;
type Timestamptz = ColumnType<Date>;
// Postgres NUMERIC → string in pg driver (preserves precision)
type Numeric = ColumnType<string, number | string, number | string>;
// JSONB: read as unknown, write as JSON-serialisable value
type Jsonb = ColumnType<unknown, unknown, unknown>;

// ── shared enums (referenced by multiple tables) ──────────────────────────

export type NavigatorStatus =
  | 'awaiting_navigator'
  | 'in_review'
  | 'ready_for_handoff'
  | 'handed_off';

// ── snap_sessions ──────────────────────────────────────────────────────────

export type SnapSessionStatus = 'active' | 'abandoned' | 'completed';

export interface SnapSessionsTable {
  session_id: Generated<UUID>;
  user_id: UUID | null;
  state: string;
  language: string;
  status: SnapSessionStatus;
  partner_id: UUID | null;
  // Added by 20260516_add_navigator_workflow; null until session enters the navigator queue.
  navigator_status: NavigatorStatus | null;
  created_at: Generated<Timestamptz>;
  updated_at: Generated<Timestamptz>;
}

// ── snap_conversation_turns ───────────────────────────────────────────────

export type ConversationRole = 'user' | 'assistant' | 'system';
export type PipelineStage =
  | 'interpreter'
  | 'ask_selector'
  | 'script_writer'
  | 'background_writer';

export interface SnapConversationTurnsTable {
  turn_id: Generated<UUID>;
  session_id: UUID;
  turn_index: number;
  role: ConversationRole;
  content_ciphertext: string; // Fernet-encrypted PII — never log, never return in API response
  pipeline_stage: PipelineStage | null;
  model_used: string | null;
  cost_usd: Numeric | null;
  latency_ms: number | null;
  created_at: Generated<Timestamptz>;
}

// ── snap_extracted_state ──────────────────────────────────────────────────

export interface SnapExtractedStateTable {
  state_id: Generated<UUID>;
  session_id: UUID;
  derived_from_turn_id: UUID;
  snapshot_ciphertext: string; // Fernet-encrypted Household JSON — never log, never return
  confidence: Numeric;
  flags: Jsonb;
  created_at: Generated<Timestamptz>;
}

// ── snap_documents ────────────────────────────────────────────────────────

export type DocumentType =
  | 'unknown'
  | 'paystub'
  | 'photo_id'
  | 'lease'
  | 'utility_bill'
  | 'other';

export type DocumentProcessingStatus =
  | 'uploaded'
  | 'classifying'
  | 'extracting'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'rejected';

export interface SnapDocumentsTable {
  document_id: Generated<UUID>;
  session_id: UUID;
  storage_path: string;
  document_type: DocumentType;
  classification_confidence: Numeric | null;
  extracted_payload_ciphertext: string | null; // Fernet-encrypted PII
  extraction_confidence: Numeric | null;
  validator_errors: Jsonb;
  user_confirmed: boolean;
  user_corrections_ciphertext: string | null; // Fernet-encrypted PII
  processing_status: DocumentProcessingStatus;
  on_device_quality_passed: boolean;
  created_at: Generated<Timestamptz>;
  updated_at: Generated<Timestamptz>;
}

// ── snap_eligibility_results ──────────────────────────────────────────────
// IMPORTANT: EligibilityStatus values ('eligible', 'ineligible', etc.) are
// DB-layer-only. Hard requirement #4 bans these strings from API response
// bodies. Do NOT return a raw EligibilityStatus over the wire.

export type EligibilityStatus =
  | 'eligible'
  | 'ineligible'
  | 'eligible_with_conditions'
  | 'insufficient_information';

export interface SnapEligibilityResultsTable {
  result_id: Generated<UUID>;
  session_id: UUID;
  rules_version: string;
  household_snapshot_ciphertext: string; // Fernet-encrypted
  result_ciphertext: string; // Fernet-encrypted
  status: EligibilityStatus; // DB-layer only — see note above
  monthly_benefit: Numeric | null;
  effective_date: ColumnType<Date, string, string>;
  created_at: Generated<Timestamptz>;
}

// ── snap_audit_log ────────────────────────────────────────────────────────

export type AuditActorKind =
  | 'anonymous_session'
  | 'authenticated_user'
  | 'partner_user'
  | 'background_job'
  | 'admin';

export interface SnapAuditLogTable {
  audit_id: Generated<UUID>;
  session_id: UUID; // intentionally not FK — survives cascade delete
  action: string;
  actor_kind: AuditActorKind;
  actor_id: string | null;
  reason: string;
  request_id: string | null;
  column_or_resource: string | null;
  occurred_at: Generated<Timestamptz>;
}

// ── Staff / navigator workflow (migration: 20260516_add_navigator_workflow) ──

export type StaffRoleId = 'navigator' | 'supervisor' | 'admin';

export interface StaffRolesTable {
  role_id: StaffRoleId;
  display_name: string;
  description: string | null;
  created_at: Generated<Timestamptz>;
}

export interface StaffUsersTable {
  staff_user_id: UUID; // mirrors auth.users.id — not Generated; caller provides it
  email: string;
  full_name: string;
  role_id: StaffRoleId;
  is_active: boolean;
  created_at: Generated<Timestamptz>;
  updated_at: Generated<Timestamptz>;
}

// ── snap_session_status_history ───────────────────────────────────────────

export interface SnapSessionStatusHistoryTable {
  history_id: Generated<UUID>;
  session_id: UUID;
  from_status: NavigatorStatus | null;
  to_status: NavigatorStatus;
  changed_by: UUID;
  reason: string | null;
  occurred_at: Generated<Timestamptz>;
}

// ── snap_session_assignments ──────────────────────────────────────────────

export interface SnapSessionAssignmentsTable {
  assignment_id: Generated<UUID>;
  session_id: UUID;
  navigator_id: UUID;
  assigned_at: Generated<Timestamptz>;
  assigned_by: UUID | null;
  unassigned_at: Timestamptz | null;
}

// ── snap_navigator_notes ──────────────────────────────────────────────────

export interface SnapNavigatorNotesTable {
  note_id: Generated<UUID>;
  session_id: UUID;
  author_id: UUID;
  body: string;
  created_at: Generated<Timestamptz>;
}

// ── snap_missing_item_requests ────────────────────────────────────────────

export interface SnapMissingItemRequestsTable {
  request_id: Generated<UUID>;
  session_id: UUID;
  requested_by: UUID;
  item_type: string;
  item_description: string | null;
  requested_at: Generated<Timestamptz>;
  resolved_at: Timestamptz | null;
  resolved_by: UUID | null;
  resolution_note: string | null;
}

// ── snap_handoff_exports ──────────────────────────────────────────────────

export interface SnapHandoffExportsTable {
  export_id: Generated<UUID>;
  session_id: UUID;
  exported_by: UUID;
  pdf_storage_path: string;
  json_storage_path: string;
  signature_hash: string;
  destination: string | null;
  exported_at: Generated<Timestamptz>;
}

// ── DB root ───────────────────────────────────────────────────────────────

export interface DB {
  // Applicant / conversation (FastAPI-owned)
  snap_sessions: SnapSessionsTable;
  snap_conversation_turns: SnapConversationTurnsTable;
  snap_extracted_state: SnapExtractedStateTable;
  snap_documents: SnapDocumentsTable;
  snap_eligibility_results: SnapEligibilityResultsTable;
  snap_audit_log: SnapAuditLogTable;
  // Staff / navigator workflow (Hono-owned)
  staff_roles: StaffRolesTable;
  staff_users: StaffUsersTable;
  snap_session_status_history: SnapSessionStatusHistoryTable;
  snap_session_assignments: SnapSessionAssignmentsTable;
  snap_navigator_notes: SnapNavigatorNotesTable;
  snap_missing_item_requests: SnapMissingItemRequestsTable;
  snap_handoff_exports: SnapHandoffExportsTable;
}
