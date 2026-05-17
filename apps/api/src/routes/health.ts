import { Hono } from 'hono';

export const healthRoute = new Hono();
export const healthRouter = healthRoute; // alias used by civic route registrations

healthRoute.get('/', (c) => c.json({ ok: true, service: 'Civica API', version: '2.0.0' }));
healthRoute.get('/healthz', (c) =>
  c.json({ status: 'ok', service: '@civica/api', timestamp: new Date().toISOString() }),
);
