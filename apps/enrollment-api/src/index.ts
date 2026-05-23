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
import meWorkHoursRouter from "./routes/me-work-hours.js";
import benefitsCalRouter from "./routes/benefitscal.js";
import recertRouter from "./routes/recert.js";
import twilioWebhookRouter from "./routes/twilio-webhook.js";
import workRequirementsRouter from "./routes/work-requirements.js";
import navigatorRouter from "./routes/navigator.js";
import argyleWebhookRouter from "./routes/argyle-webhook.js";
import oauthCanvasRouter from "./routes/oauth-canvas.js";
import featureFlagsRouter from "./routes/feature-flags.js";
import buddyRouter from "./routes/buddy.js";
import shelterAllocationRouter from "./routes/shelter-allocation.js";
import { requestLogger } from "./lib/logger.js";
import { scrubEvent } from "./lib/sentry.js";
import { withSentry } from "@sentry/cloudflare";
import { makeServiceClient } from "./lib/supabase.js";
import {
  StubUsdaRetailerFetcher,
  syncUsdaRetailers,
} from "./lib/usda-retailer-sync.js";
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

// OpenAPI spec — public, no auth. Generated from src/openapi/spec.ts which
// registers all iOS-facing routes with their Zod schemas. Lives at root so
// iOS / web codegen can fetch it without a JWT.
app.get("/openapi.json", async (c) => {
  const { buildOpenAPIDocument } = await import("./openapi/spec.js");
  return c.json(buildOpenAPIDocument());
});

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
api.route("/me/work-requirements", meWorkHoursRouter); // /me/work-requirements/:packetId/hours (§10102)

// Buddy Add routes (feature-flagged: BUDDY_ADD_ENABLED=true)
api.route("/buddy", buddyRouter);             // POST /buddy/invite, /accept; GET /buddy/applicant-summary, /config
api.route("/", shelterAllocationRouter);      // GET|POST|DELETE /packets/:id/shelter-allocation

api.route("/benefitscal", benefitsCalRouter);  // /benefitscal/prepare-export/:packetId, /benefitscal/status/:packetId

app.route("/v1/enrollment", api);

// Argyle webhook — outside auth middleware (inbound from Argyle, HMAC-verified)
// T-DR3-8: receives paycheck.added, detects cliff event, fires navigator task.
app.route("/webhooks/argyle", argyleWebhookRouter);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  // Surface the request_id so a user reporting an error gives the team the
  // exact string to grep Sentry / logs with. requestLogger sets it on every
  // request; if the middleware was bypassed (e.g. before-middleware error)
  // we still want a usable correlation handle, so synthesize one.
  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();
  const log = c.get("log");
  if (log) {
    log.error("unhandled error", { message: err.message, name: err.name, request_id: requestId });
  } else {
    console.error(JSON.stringify({ msg: "unhandled_error", request_id: requestId, error: String(err) }));
  }
  return c.json({ error: "Internal server error", trace_id: requestId }, 500);
});

// Named export for unit tests — raw Hono app without the Sentry wrapper
export { app };

import { cleanupBuddyAppMetadata } from "./cron/buddy-app-metadata-cleanup.js";

// Cron dispatch — keep tiny and table-driven so adding/removing
// schedules in wrangler.toml is the only change needed. Tasks run under
// the same Sentry envelope as fetch (Sentry's CF integration wires both).
async function dispatchScheduled(
  event: ScheduledController,
  env: Env,
): Promise<void> {
  const log = (
    level: "info" | "warn" | "error",
    msg: string,
    extra?: Record<string, unknown>,
  ) => {
    console.log(
      JSON.stringify({
        level,
        msg,
        cron: event.cron,
        ts: new Date().toISOString(),
        ...extra,
      }),
    );
  };

  switch (event.cron) {
    case "0 3 * * *": {
      // Nightly USDA SNAP Retailer Locator sync. Currently stub-mode —
      // live USDA endpoint is wired in a follow-up commit once the
      // public URL + field map is verified.
      log("info", "scheduled: usda retailer sync starting");
      const supabase = makeServiceClient(env);
      const result = await syncUsdaRetailers({
        fetcher: new StubUsdaRetailerFetcher(),
        supabase,
        log,
      });
      log("info", "scheduled: usda retailer sync finished", { ...result });
      return;
    }
    case "*/5 * * * *": {
      // Buddy access closure: clear app_metadata.role for revoked/completed
      // buddies so their JWTs stop authenticating as kind='buddy'. Without this
      // sweep, the buddy role claim survives until token expiry (~1h).
      // See src/cron/buddy-app-metadata-cleanup.ts.
      try {
        const result = await cleanupBuddyAppMetadata(env);
        log("info", "scheduled: buddy app_metadata cleanup finished", { ...result });
      } catch (err) {
        log("error", "scheduled: buddy app_metadata cleanup failed", { error: String(err) });
      }
      return;
    }
    default:
      log("warn", "scheduled: no handler for cron expression");
  }
}

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
    async scheduled(
      event: ScheduledController,
      env: Env,
      ctx: ExecutionContext,
    ): Promise<void> {
      ctx.waitUntil(dispatchScheduled(event, env));
    },
  } satisfies ExportedHandler<Env>,
);
