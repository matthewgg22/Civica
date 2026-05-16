import type { AuditActorKind } from '../db/schema.js';

// Mirrors Python AuditAction enum in backend/civic_api/snap/audit/logger.py
// plus navigator-workflow actions added in Phase 5.
export type AuditAction =
  // Applicant / conversation (FastAPI also writes these)
  | 'SESSION_CREATED'
  | 'SESSION_RECOVERED'
  | 'TURN_PROCESSED'
  | 'STATE_EXTRACTED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_CONFIRMED'
  | 'PDF_GENERATED'
  // Navigator workflow (Hono-owned)
  | 'SESSION_ASSIGNED'
  | 'SESSION_UNASSIGNED'
  | 'STATUS_TRANSITIONED'
  | 'NOTE_ADDED'
  | 'MISSING_ITEM_REQUESTED'
  | 'MISSING_ITEM_RESOLVED'
  | 'EXTRACTION_FIELD_REVIEWED'
  | 'HANDOFF_EXPORTED'
  | 'OCR_RESULT_RECEIVED';

export interface AuditActor {
  kind: AuditActorKind;
  id?: string | null;
}

export interface WithAuditOptions {
  reason?: string;
  requestId?: string;
  columnOrResource?: string;
}
