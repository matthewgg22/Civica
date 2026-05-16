import { Hono } from 'hono';
import { applicantRoutes } from './routes/applicant.js';
import { healthRoute } from './routes/health.js';
import { navigatorRoutes } from './routes/navigator.js';
import { webhookRoutes } from './routes/webhooks.js';

export function buildApp() {
  const app = new Hono();

  app.route('/', healthRoute);
  app.route('/me', applicantRoutes);
  app.route('/navigator', navigatorRoutes);
  app.route('/webhooks', webhookRoutes);

  return app;
}
