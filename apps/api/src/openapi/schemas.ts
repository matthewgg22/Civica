/**
 * Zod schemas for every public API request and response body.
 * Used by the spec registry (spec.ts) for OpenAPI doc generation.
 * Not wired for runtime validation in Phase 16 — handlers use c.req.json() directly.
 */

import { z } from 'zod';

// ── Shared ────────────────────────────────────────────────────────────────

export const ErrorSchema = z
  .object({ error: z.string(), message: z.string().optional() })
  .openapi('Error');

export const MissingFieldErrorSchema = z
  .object({ error: z.literal('missing_field'), field: z.string() })
  .openapi('MissingFieldError');

export const PaginationSchema = z
  .object({ limit: z.number().int(), offset: z.number().int() })
  .openapi('Pagination');

// ── Applicant — sessions ──────────────────────────────────────────────────

export const CreateSessionBodySchema = z
  .object({
    state: z.string().length(2).describe('Two-letter US state code, e.g. CA'),
    language: z.string().default('en').describe('BCP-47 language tag, e.g. en or es'),
  })
  .openapi('CreateSessionBody');

export const TurnResultSchema = z
  .object({
    turn_id: z.string().uuid(),
    turn_index: z.number().int(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    pipeline_stage: z.string().nullable(),
  })
  .openapi('TurnResult');

export const SessionCreatedSchema = z
  .object({
    session_id: z.string().uuid(),
    opening_turn: TurnResultSchema,
  })
  .openapi('SessionCreated');

export const RecoverSessionBodySchema = z
  .object({ token: z.string().min(8).max(512) })
  .openapi('RecoverSessionBody');

export const SendTurnBodySchema = z
  .object({ user_text: z.string().min(1).max(4000) })
  .openapi('SendTurnBody');

export const TranscriptSchema = z
  .object({
    session_id: z.string().uuid(),
    turns: z.array(
      z.object({
        turn_id: z.string().uuid(),
        turn_index: z.number().int(),
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
        pipeline_stage: z.string().nullable(),
        created_at: z.string().datetime(),
      }),
    ),
  })
  .openapi('Transcript');

// ── Applicant — documents ─────────────────────────────────────────────────

export const DocumentUploadResponseSchema = z
  .object({
    document_id: z.string().uuid(),
    processing_status: z.enum(['processing', 'awaiting_confirmation', 'rejected']),
  })
  .openapi('DocumentUploadResponse');

export const DocumentStatusSchema = z
  .object({
    document_id: z.string().uuid(),
    session_id: z.string().uuid(),
    document_type: z.enum(['unknown', 'paystub', 'photo_id', 'lease', 'utility_bill', 'other']),
    on_device_quality_passed: z.boolean(),
    user_confirmed: z.boolean(),
    extraction: z.unknown().nullable(),
  })
  .openapi('DocumentStatus');

export const DocumentConfirmBodySchema = z
  .object({ corrections: z.unknown().nullable().optional() })
  .openapi('DocumentConfirmBody');

// ── Navigator — status ────────────────────────────────────────────────────

const NavigatorStatusEnum = z.enum([
  'awaiting_navigator',
  'in_review',
  'ready_for_handoff',
  'handed_off',
]);

export const StatusTransitionBodySchema = z
  .object({
    to: NavigatorStatusEnum,
    reason: z.string().max(500).optional(),
  })
  .openapi('StatusTransitionBody');

export const StatusTransitionResponseSchema = z
  .object({ session_id: z.string().uuid(), navigator_status: NavigatorStatusEnum })
  .openapi('StatusTransitionResponse');

export const TransitionErrorSchema = z
  .object({
    error: z.enum([
      'not_assigned',
      'missing_consent',
      'missing_required_docs',
      'terminal_state',
      'invalid_transition',
    ]),
    message: z.string(),
  })
  .openapi('TransitionError');

// ── Navigator — sessions list + detail ────────────────────────────────────

export const NavigatorSessionSummarySchema = z
  .object({
    session_id: z.string().uuid(),
    status: z.enum(['active', 'abandoned', 'completed']),
    navigator_status: NavigatorStatusEnum.nullable(),
    state: z.string(),
    language: z.string(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    navigator_id: z.string().uuid().nullable(),
  })
  .openapi('NavigatorSessionSummary');

export const SessionsListSchema = z
  .object({ sessions: z.array(NavigatorSessionSummarySchema) })
  .openapi('SessionsList');

// ── Navigator — assign ────────────────────────────────────────────────────

export const AssignBodySchema = z
  .object({ navigator_id: z.string().uuid() })
  .openapi('AssignBody');

export const AssignmentSchema = z
  .object({
    assignment_id: z.string().uuid(),
    navigator_id: z.string().uuid(),
    assigned_at: z.string().datetime(),
  })
  .openapi('Assignment');

// ── Navigator — notes ─────────────────────────────────────────────────────

export const NoteBodySchema = z
  .object({ body: z.string().min(1).max(10_000) })
  .openapi('NoteBody');

export const NoteSchema = z
  .object({
    note_id: z.string().uuid(),
    author_id: z.string().uuid(),
    body: z.string(),
    created_at: z.string().datetime(),
  })
  .openapi('Note');

// ── Navigator — missing items ─────────────────────────────────────────────

export const MissingItemBodySchema = z
  .object({
    item_type: z.string().min(1),
    item_description: z.string().max(1000).optional(),
  })
  .openapi('MissingItemBody');

export const ResolveMissingItemBodySchema = z
  .object({ resolution_note: z.string().max(1000).optional() })
  .openapi('ResolveMissingItemBody');

export const MissingItemSchema = z
  .object({
    request_id: z.string().uuid(),
    item_type: z.string(),
    item_description: z.string().nullable(),
    requested_at: z.string().datetime(),
    resolved_at: z.string().datetime().nullable(),
    resolved_by: z.string().uuid().nullable(),
    resolution_note: z.string().nullable(),
  })
  .openapi('MissingItem');

// ── Navigator — audit log ─────────────────────────────────────────────────

export const AuditLogSchema = z
  .object({
    session_id: z.string().uuid(),
    entries: z.array(
      z.object({
        audit_id: z.string().uuid(),
        action: z.string(),
        actor_kind: z.string(),
        actor_id: z.string().nullable(),
        reason: z.string(),
        request_id: z.string().nullable(),
        column_or_resource: z.string().nullable(),
        occurred_at: z.string().datetime(),
      }),
    ),
    limit: z.number().int(),
    offset: z.number().int(),
  })
  .openapi('AuditLog');

// ── Webhook — OCR ─────────────────────────────────────────────────────────

export const OcrWebhookBodySchema = z
  .object({
    document_id: z.string().uuid(),
    status: z.enum(['success', 'failure']),
    document_type: z
      .enum(['unknown', 'paystub', 'photo_id', 'lease', 'utility_bill', 'other'])
      .optional(),
    classification_confidence: z.number().min(0).max(1).optional(),
    extraction_confidence: z.number().min(0).max(1).optional(),
    extracted_data: z.unknown().optional(),
    error_code: z.string().optional(),
  })
  .openapi('OcrWebhookBody');

export const OcrWebhookResponseSchema = z
  .object({
    document_id: z.string().uuid(),
    processing_status: z
      .enum(['awaiting_confirmation', 'rejected', 'already_processed' as 'rejected'])
      .or(z.literal('already_processed')),
  })
  .openapi('OcrWebhookResponse');
