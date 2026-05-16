import { Hono } from 'hono';

export const navigatorRoutes = new Hono();

// Mounted at /navigator. Endpoints land in Phase 14.
// Phase 6 adds staff JWT middleware that rejects applicant tokens.
