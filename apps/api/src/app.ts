import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { HTTPException } from 'hono/http-exception';
import { requestLog } from './lib/requestLog.js';
import { buildOpenAPIDocument } from './openapi/spec.js';
import { applicantRoutes } from './routes/applicant.js';
import { healthRoute } from './routes/health.js';
import { navigatorRoutes } from './routes/navigator.js';
import { webhookRoutes } from './routes/webhooks.js';
import { errorHandler } from './middleware/error.js';

// ── Civic (Flask → Hono) routes ──────────────────────────────────────────────
import { historyRouter } from './routes/civic/history.js';
import { callScoreRouter } from './routes/civic/call-score.js';
import { leaderboardRouter } from './routes/civic/leaderboard.js';
import { callsRouter } from './routes/civic/calls.js';
import { examplesRouter } from './routes/civic/examples.js';
import { aiRouter } from './routes/civic/ai.js';
import { openstatesRouter } from './routes/openstates/index.js';
import { civicRouter } from './routes/civic/index.js';
import { snapLegacyRouter } from './routes/snap/legacy.js';
import { packetsRouter as snapPacketsRouter } from './routes/snap/packets.js';
import { handoffRouter as snapHandoffRouter } from './routes/snap/handoff.js';
import { ocrWebhookRouter } from './routes/webhooks/ocr.js';
import { shareRouter } from './routes/share/index.js';
import { debugRouter } from './routes/debug.js';

// Lazily built once at first request so env vars are available at call time.
let _spec: ReturnType<typeof buildOpenAPIDocument> | null = null;
function getSpec() {
  return (_spec ??= buildOpenAPIDocument());
}

export function buildApp() {
  const app = new Hono();

  app.use('*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'] }));
  app.use('*', requestLog);
  if (process.env['NODE_ENV'] !== 'production') app.use('*', prettyJSON());

  // ── SNAP / Navigator API ────────────────────────────────────────────────
  app.route('/', healthRoute);
  app.route('/me', applicantRoutes);
  app.route('/navigator', navigatorRoutes);
  app.route('/webhooks', webhookRoutes);

  // ── Civic routes (Flask → Hono) ─────────────────────────────────────────
  app.route('/', historyRouter);
  app.route('/', callScoreRouter);
  app.route('/', leaderboardRouter);
  app.route('/', callsRouter);
  app.route('/', examplesRouter);
  app.route('/', aiRouter);
  app.route('/', openstatesRouter);
  app.route('/', snapLegacyRouter);
  app.route('/', snapPacketsRouter);
  app.route('/', snapHandoffRouter);
  app.route('/', ocrWebhookRouter);
  app.route('/', shareRouter);
  // Stub router (501 for not-yet-ported civic routes)
  app.route('/', civicRouter);

  // Temporary Sentry verification route — guarded by SENTRY_CHECK_ENABLED, removed before merge
  if (process.env['SENTRY_CHECK_ENABLED']) app.route('/', debugRouter);

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

  // ── Error handlers ────────────────────────────────────────────────────────
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    return errorHandler(err, c);
  });
  app.notFound((c) => c.json({ code: 'not_found', message: 'Route not found' }, 404));

  return app;
}
