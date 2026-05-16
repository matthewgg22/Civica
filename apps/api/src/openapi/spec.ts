/**
 * Spec-only OpenAPIHono registry. Routes are registered with full Zod
 * schemas for documentation. Handlers here are never called in production —
 * actual request handling uses the plain Hono route files.
 *
 * Usage:
 *   import { buildOpenAPIDocument } from './openapi/spec.js';
 *   app.get('/openapi.json', (c) => c.json(buildOpenAPIDocument()));
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import {
  AssignBodySchema,
  AssignmentSchema,
  AuditLogSchema,
  CreateSessionBodySchema,
  DocumentConfirmBodySchema,
  DocumentStatusSchema,
  DocumentUploadResponseSchema,
  ErrorSchema,
  MissingItemBodySchema,
  MissingItemSchema,
  NoteBodySchema,
  NoteSchema,
  OcrWebhookBodySchema,
  OcrWebhookResponseSchema,
  RecoverSessionBodySchema,
  ResolveMissingItemBodySchema,
  SendTurnBodySchema,
  SessionCreatedSchema,
  SessionsListSchema,
  StatusTransitionBodySchema,
  StatusTransitionResponseSchema,
  TranscriptSchema,
  TransitionErrorSchema,
} from './schemas.js';

// Stub handler — never executed; only needed to satisfy OpenAPIHono's types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stub = () => new Response() as any;

const BEARER = [{ bearerAuth: [] }];

const app = new OpenAPIHono();

// ── Security scheme ───────────────────────────────────────────────────────

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT (Supabase)',
  description: 'Supabase-issued JWT. Applicant endpoints: anon/user JWT. Staff endpoints: JWT with app_metadata.role claim.',
});

// ── GET /healthz ──────────────────────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/healthz',
    tags: ['Health'],
    summary: 'Liveness check',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ status: z.literal('ok'), service: z.string(), timestamp: z.string() }),
          },
        },
        description: 'Service is healthy',
      },
    },
  }),
  stub,
);

// ── Applicant — sessions ──────────────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'post',
    path: '/me/sessions',
    tags: ['Applicant'],
    security: BEARER,
    summary: 'Start a SNAP eligibility session',
    request: { body: { content: { 'application/json': { schema: CreateSessionBodySchema } } } },
    responses: {
      200: { content: { 'application/json': { schema: SessionCreatedSchema } }, description: 'Session created' },
      401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
      429: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Rate limited' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/me/sessions/recover',
    tags: ['Applicant'],
    security: BEARER,
    summary: 'Resume a session via magic-link token (stub — 501 until email flow is built)',
    request: { body: { content: { 'application/json': { schema: RecoverSessionBodySchema } } } },
    responses: {
      501: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not yet implemented' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/me/sessions/{id}/turns',
    tags: ['Applicant'],
    security: BEARER,
    summary: 'Send a conversation turn',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: SendTurnBodySchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ turn_id: z.string().uuid(), role: z.string(), content: z.string() }) } }, description: 'Turn processed' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/me/sessions/{id}/transcript',
    tags: ['Applicant'],
    security: BEARER,
    summary: 'List all conversation turns for a session',
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: TranscriptSchema } }, description: 'Transcript' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
    },
  }),
  stub,
);

// ── Applicant — documents ─────────────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'post',
    path: '/me/sessions/{id}/documents',
    tags: ['Applicant'],
    security: BEARER,
    summary: 'Upload a document for OCR processing (multipart/form-data)',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.any().describe('The document image (JPEG, PNG, PDF)'),
              on_device_quality_passed: z.boolean().default(true),
            }),
          },
        },
      },
    },
    responses: {
      200: { content: { 'application/json': { schema: DocumentUploadResponseSchema } }, description: 'Upload initiated' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/me/documents/{docId}',
    tags: ['Applicant'],
    security: BEARER,
    summary: 'Poll document processing status',
    request: { params: z.object({ docId: z.string().uuid() }) },
    responses: {
      200: { content: { 'application/json': { schema: DocumentStatusSchema } }, description: 'Document status' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Document not found' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/me/documents/{docId}/confirm',
    tags: ['Applicant'],
    security: BEARER,
    summary: 'Confirm extracted document data (optionally with corrections)',
    request: {
      params: z.object({ docId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: DocumentConfirmBodySchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: DocumentStatusSchema } }, description: 'Confirmed' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Document not found' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/me/sessions/{id}/application/pdf',
    tags: ['Applicant'],
    security: BEARER,
    summary: 'Generate a SNAP application PDF summary',
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        content: { 'application/pdf': { schema: z.any().describe('PDF binary') } },
        description: 'Application PDF',
        headers: z.object({
          'Content-Disposition': z.string().describe('attachment; filename="civica-snap-summary-<id>.pdf"'),
          'X-SNAP-Rendering-Path': z.string().optional().describe('html_weasyprint | latex | fallback_text'),
        }),
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
    },
  }),
  stub,
);

// ── Navigator — sessions ──────────────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/navigator/sessions',
    tags: ['Navigator'],
    security: BEARER,
    summary: 'List sessions with optional filters',
    request: {
      query: z.object({
        navigator_status: z.enum(['awaiting_navigator', 'in_review', 'ready_for_handoff', 'handed_off']).optional(),
        state: z.string().length(2).optional(),
        assigned_to: z.string().uuid().optional(),
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: SessionsListSchema } }, description: 'Sessions list (max 100)' },
      401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Unauthorized' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/navigator/sessions/{id}',
    tags: ['Navigator'],
    security: BEARER,
    summary: 'Session detail with assignment, notes, and missing items',
    request: { params: z.object({ id: z.string().uuid() }) },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              session: z.any(),
              assignment: AssignmentSchema.nullable(),
              notes: z.array(NoteSchema),
              missing_items: z.array(MissingItemSchema),
            }),
          },
        },
        description: 'Session detail',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/navigator/sessions/{id}/status',
    tags: ['Navigator'],
    security: BEARER,
    summary: 'Transition navigator workflow status',
    description: 'Enforces the transition matrix. Returns 422 with a structured error code when the transition is blocked.',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: StatusTransitionBodySchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: StatusTransitionResponseSchema } }, description: 'Transitioned' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
      422: { content: { 'application/json': { schema: TransitionErrorSchema } }, description: 'Transition blocked' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/navigator/sessions/{id}/assign',
    tags: ['Navigator'],
    security: BEARER,
    summary: 'Assign session to a navigator (replaces current assignment)',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: AssignBodySchema } } },
    },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ assignment: AssignmentSchema }) } }, description: 'Assigned' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/navigator/sessions/{id}/notes',
    tags: ['Navigator'],
    security: BEARER,
    summary: 'Add an immutable note to a session',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: NoteBodySchema } } },
    },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ note: NoteSchema }) } }, description: 'Note added' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/navigator/sessions/{id}/missing-items',
    tags: ['Navigator'],
    security: BEARER,
    summary: 'Request a missing document or piece of information',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: MissingItemBodySchema } } },
    },
    responses: {
      201: { content: { 'application/json': { schema: z.object({ item: MissingItemSchema }) } }, description: 'Requested' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'patch',
    path: '/navigator/sessions/{id}/missing-items/{itemId}',
    tags: ['Navigator'],
    security: BEARER,
    summary: 'Resolve a missing item request',
    request: {
      params: z.object({ id: z.string().uuid(), itemId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: ResolveMissingItemBodySchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: z.object({ item: MissingItemSchema }) } }, description: 'Resolved' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
      409: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Already resolved' },
    },
  }),
  stub,
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/navigator/sessions/{id}/audit-log',
    tags: ['Navigator'],
    security: BEARER,
    summary: 'Paginated audit log for a session',
    request: {
      params: z.object({ id: z.string().uuid() }),
      query: z.object({
        limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
        offset: z.coerce.number().int().min(0).default(0).optional(),
      }),
    },
    responses: {
      200: { content: { 'application/json': { schema: AuditLogSchema } }, description: 'Audit entries' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Session not found' },
    },
  }),
  stub,
);

// ── Webhook — OCR ─────────────────────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'post',
    path: '/webhooks/ocr',
    tags: ['Webhooks'],
    summary: 'OCR result callback from Textract / Document AI',
    description: 'Body must be signed with HMAC-SHA256; send signature as `X-Webhook-Signature: sha256=<hex>`.',
    request: {
      headers: z.object({
        'x-webhook-signature': z.string().describe('sha256=<hex-digest>'),
      }),
      body: { content: { 'application/json': { schema: OcrWebhookBodySchema } } },
    },
    responses: {
      200: { content: { 'application/json': { schema: OcrWebhookResponseSchema } }, description: 'Processed (idempotent)' },
      401: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Invalid signature' },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Document not found' },
      503: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Webhook secret not configured' },
    },
  }),
  stub,
);

// ── Export ────────────────────────────────────────────────────────────────

export function buildOpenAPIDocument() {
  return app.getOpenAPIDocument({
    openapi: '3.1.0',
    info: {
      title: 'Civica SNAP API',
      version: '1.0.0',
      description:
        'REST gateway for the Civica SNAP enrollment-readiness system. ' +
        'Applicant flows proxy to the FastAPI engine with HMAC-signed internal requests. ' +
        'Navigator dashboard endpoints are Hono-direct with transactional audit logging.',
      contact: { name: 'Civica Engineering' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
    ],
  });
}
