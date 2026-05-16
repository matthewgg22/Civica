import { Hono } from 'hono';
import { requireApplicantJwt } from '../auth/applicant.js';
import type { ApplicantEnv } from '../auth/types.js';
import { getEngineClient } from '../internal/engineClient.js';
import { applicantRateLimit } from '../lib/rateLimit.js';

export const applicantRoutes = new Hono<ApplicantEnv>();

applicantRoutes.use('*', requireApplicantJwt);
applicantRoutes.use('*', applicantRateLimit); // per-user, runs after auth sets c.var.applicant

// ── Sessions ──────────────────────────────────────────────────────────────

applicantRoutes.post('/sessions', async (c) => {
  const body = await c.req.json<unknown>();
  const res = await getEngineClient().post('/snap/sessions', body, c.var.applicant.sub);
  return c.json(res.data, res.status as Parameters<typeof c.json>[1]);
});

// /recover must precede /:id to avoid shadowing
applicantRoutes.post('/sessions/recover', async (c) => {
  const body = await c.req.json<unknown>();
  const res = await getEngineClient().post('/snap/sessions/recover', body, c.var.applicant.sub);
  return c.json(res.data, res.status as Parameters<typeof c.json>[1]);
});

applicantRoutes.post('/sessions/:id/turns', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<unknown>();
  const res = await getEngineClient().post(`/snap/sessions/${id}/turns`, body, c.var.applicant.sub);
  return c.json(res.data, res.status as Parameters<typeof c.json>[1]);
});

applicantRoutes.get('/sessions/:id/transcript', async (c) => {
  const id = c.req.param('id');
  const res = await getEngineClient().get(`/snap/sessions/${id}/transcript`, c.var.applicant.sub);
  return c.json(res.data, res.status as Parameters<typeof c.json>[1]);
});

// ── Documents ─────────────────────────────────────────────────────────────

applicantRoutes.post('/sessions/:id/documents', async (c) => {
  const id = c.req.param('id');
  const formData = await c.req.formData();
  const res = await getEngineClient().postMultipart(`/snap/sessions/${id}/documents`, formData, c.var.applicant.sub);
  return c.json(res.data, res.status as Parameters<typeof c.json>[1]);
});

applicantRoutes.get('/documents/:docId', async (c) => {
  const docId = c.req.param('docId');
  const res = await getEngineClient().get(`/snap/documents/${docId}`, c.var.applicant.sub);
  return c.json(res.data, res.status as Parameters<typeof c.json>[1]);
});

applicantRoutes.post('/documents/:docId/confirm', async (c) => {
  const docId = c.req.param('docId');
  const body = await c.req.json<unknown>();
  const res = await getEngineClient().post(`/snap/documents/${docId}/confirm`, body, c.var.applicant.sub);
  return c.json(res.data, res.status as Parameters<typeof c.json>[1]);
});

// ── Application PDF ───────────────────────────────────────────────────────

applicantRoutes.post('/sessions/:id/application/pdf', async (c) => {
  const id = c.req.param('id');
  const raw = await getEngineClient().fetchRaw(
    'POST',
    `/snap/sessions/${id}/application/pdf`,
    null,
    c.var.applicant.sub,
  );

  if (!raw.ok) {
    const errData = (await raw.json()) as unknown;
    return c.json(errData, raw.status as Parameters<typeof c.json>[1]);
  }

  const bytes = await raw.arrayBuffer();
  const disposition =
    raw.headers.get('Content-Disposition') ??
    `attachment; filename="civica-snap-summary-${id.slice(0, 8)}.pdf"`;
  const renderingPath = raw.headers.get('X-SNAP-Rendering-Path');

  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
      ...(renderingPath != null ? { 'X-SNAP-Rendering-Path': renderingPath } : {}),
    },
  });
});
