import { Hono } from 'hono';

export const healthRoute = new Hono();

healthRoute.get('/healthz', (c) =>
  c.json({
    status: 'ok',
    service: '@civica/api',
    timestamp: new Date().toISOString(),
  }),
);
