import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "./middleware/auth.js";
import packetsRouter from "./routes/packets.js";
import documentsRouter from "./routes/documents.js";
import answersRouter from "./routes/answers.js";
import notesRouter from "./routes/notes.js";
import consentsRouter from "./routes/consents.js";
import fieldsRouter from "./routes/fields.js";
import documentItemsRouter from "./routes/document-items.js";
import handoffRouter from "./routes/handoff.js";
import missingItemsRouter from "./routes/missing-items.js";
import meRouter from "./routes/me.js";
import mePacketsRouter from "./routes/me-packets.js";
import meInboxRouter from "./routes/me-inbox.js";
import meArgyleRouter from "./routes/me-argyle.js";
import benefitsCalRouter from "./routes/benefitscal.js";
import recertRouter from "./routes/recert.js";
import twilioWebhookRouter from "./routes/twilio-webhook.js";
import workRequirementsRouter from "./routes/work-requirements.js";
import navigatorRouter from "./routes/navigator.js";
import argyleWebhookRouter from "./routes/argyle-webhook.js";
import oauthCanvasRouter from "./routes/oauth-canvas.js";
import featureFlagsRouter from "./routes/feature-flags.js";
import { requestLogger } from "./lib/logger.js";
import { scrubEvent } from "./lib/sentry.js";
import { withSentry } from "@sentry/cloudflare";
import type { Env, Variables } from "./types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", requestLogger);
// CORS allowlist — production dashboard, marketing site, localhost dev, and
// Vercel preview deploys. Disallowed origins receive no Access-Control-Allow-Origin
// header (browsers block the response). Same-origin / server-to-server requests
// (no Origin header) are allowed through CORS — auth middleware gates them.
// Vercel project is named `civica-api` (hosts the dashboard — confusing legacy
// naming). The `civica-dashboard.vercel.app` subdomain returns 404 (deployment
// not found). See docs/launch/production-url-audit-2026-05-19.md.
const CORS_ALLOWED_ORIGINS = [
  "https://civica-api.vercel.app",
  "https://civica.app",
  "http://localhost:3000",
];
const CORS_VERCEL_PREVIEW = /^https:\/\/civica-api-.*\.vercel\.app$/;
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      if (CORS_ALLOWED_ORIGINS.includes(origin)) return origin;
      if (CORS_VERCEL_PREVIEW.test(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: false,
  }),
);

app.get("/health", (c) => c.json({ ok: true, service: "civica-enrollment-api" }));

// T14: Twilio webhook — no auth middleware (uses Twilio HMAC signature instead of JWT)
app.route("/", twilioWebhookRouter);

// Session A — feature flags public read (no auth: non-sensitive product config).
// Mounted BEFORE the authed /v1/enrollment subtree so it bypasses authMiddleware.
app.route("/v1/enrollment/feature-flags", featureFlagsRouter);

// All enrollment routes require a valid Supabase JWT
const api = new Hono<{ Bindings: Env }>();
api.use("*", authMiddleware);

api.route("/packets", packetsRouter);
api.route("/", documentsRouter);   // /packets/:id/documents, /documents/:id
api.route("/", answersRouter);     // /packets/:id/answers, /answers/:id/review
api.route("/", notesRouter);       // /packets/:id/notes, /notes/:id
api.route("/", consentsRouter);          // /applicants/:id/consents, /consents
api.route("/", fieldsRouter);            // /packets/:id/fields, /fields/:id/review
api.route("/", documentItemsRouter);     // /packets/:id/document-items, /document-items/:id/*
api.route("/", handoffRouter);           // /packets/:id/handoff*
api.route("/", missingItemsRouter);      // /packets/:id/missing-items, /missing-items/:id/cancel

// Recertification routes (T11)
api.route("/recert", recertRouter);            // /recert/:packetId/init, /recert/:packetId, etc.

// Work requirements routes (T12 — OBBBA §10102)
api.route("/work-requirements", workRequirementsRouter);  // /work-requirements/:packetId/evaluate, etc.

// Navigator outreach routes (T-DR3-7 — marketplace cliff event)
api.route("/navigator", navigatorRouter);                 // /navigator/outreach

// Canvas OAuth proxy (T-DR3-9 — schedule integration)
api.route("/oauth/canvas", oauthCanvasRouter);            // /oauth/canvas/exchange, /status, DELETE

// Applicant self-service routes
api.route("/me", meRouter);                         // GET/PATCH /me
api.route("/me/packets", mePacketsRouter);          // /me/packets/*
api.route("/me/inbox", meInboxRouter);              // /me/inbox/*
api.route("/me/argyle/connect", meArgyleRouter);    // GET/POST/DELETE /me/argyle/connect (T-DR3-8)

api.route("/benefitscal", benefitsCalRouter);  // /benefitscal/prepare-export/:packetId, /benefitscal/status/:packetId

app.route("/v1/enrollment", api);

// Argyle webhook — outside auth middleware (inbound from Argyle, HMAC-verified)
// T-DR3-8: receives paycheck.added, detects cliff event, fires navigator task.
app.route("/webhooks/argyle", argyleWebhookRouter);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  const log = c.get("log");
  if (log) {
    log.error("unhandled error", { message: err.message, name: err.name });
  } else {
    console.error(err);
  }
  return c.json({ error: "Internal server error" }, 500);
});

// Named export for unit tests — raw Hono app without the Sentry wrapper
export { app };

export default withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0.05,
    beforeSend: scrubEvent,
  }),
  {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
      return app.fetch(request, env, ctx);
    },
  } satisfies ExportedHandler<Env>,
);
