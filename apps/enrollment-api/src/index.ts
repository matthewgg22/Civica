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
import { requestLogger } from "./lib/logger.js";
import { scrubEvent } from "./lib/sentry.js";
import { withSentry } from "@sentry/cloudflare";
import type { Env, Variables } from "./types.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", requestLogger);
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"] }));

app.get("/health", (c) => c.json({ ok: true, service: "civica-enrollment-api" }));

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

// Applicant self-service routes
api.route("/me", meRouter);                    // GET/PATCH /me
api.route("/me/packets", mePacketsRouter);     // /me/packets/*
api.route("/me/inbox", meInboxRouter);         // /me/inbox/*

app.route("/v1/enrollment", api);

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
