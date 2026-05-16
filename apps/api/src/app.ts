import { Hono } from 'hono';
import { requestLog } from './lib/requestLog.js';
import { buildOpenAPIDocument } from './openapi/spec.js';
import { applicantRoutes } from './routes/applicant.js';
import { healthRoute } from './routes/health.js';
import { navigatorRoutes } from './routes/navigator.js';
import { webhookRoutes } from './routes/webhooks.js';

// Lazily built once at first request so env vars are available at call time.
let _spec: ReturnType<typeof buildOpenAPIDocument> | null = null;
function getSpec() {
  return (_spec ??= buildOpenAPIDocument());
}

export function buildApp() {
  const app = new Hono();

  app.use('*', requestLog);

  app.route('/', healthRoute);
  app.route('/me', applicantRoutes);
  app.route('/navigator', navigatorRoutes);
  app.route('/webhooks', webhookRoutes);

  // ── OpenAPI spec + Scalar docs ──────────────────────────────────────────
  app.get('/openapi.json', (c) => c.json(getSpec()));

  app.get('/docs', (c) =>
    c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Civica SNAP API — Reference</title>
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`),
  );

  return app;
}
