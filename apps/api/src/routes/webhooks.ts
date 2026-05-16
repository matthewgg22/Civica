import { Hono } from 'hono';

export const webhookRoutes = new Hono();

// Mounted at /webhooks. OCR webhook lands in Phase 15 with HMAC verify.
