import { Hono } from 'hono';

export const applicantRoutes = new Hono();

// Mounted at /me. Endpoints land in Phase 13.
// Phase 6 adds applicant JWT middleware that rejects staff tokens.
