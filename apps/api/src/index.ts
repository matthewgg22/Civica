import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { HTTPException } from "hono/http-exception";
import { errorHandler } from "./middleware/error.js";
import { authMiddleware } from "./middleware/auth.js";
import { healthRouter } from "./routes/health.js";
import { civicRouter } from "./routes/civic/index.js";
import { historyRouter } from "./routes/civic/history.js";
import { callScoreRouter } from "./routes/civic/call-score.js";
import { leaderboardRouter } from "./routes/civic/leaderboard.js";
import { callsRouter } from "./routes/civic/calls.js";
import { openstatesRouter } from "./routes/openstates/index.js";
import { snapLegacyRouter } from "./routes/snap/legacy.js";
import { packetsRouter as snapPacketsRouter } from "./routes/snap/packets.js";
import { ocrWebhookRouter } from "./routes/webhooks/ocr.js";
import { shareRouter } from "./routes/share/index.js";
import enrollmentPacketsRouter from "./routes/packets.js";
import documentsRouter from "./routes/documents.js";
import answersRouter from "./routes/answers.js";
import notesRouter from "./routes/notes.js";
import consentsRouter from "./routes/consents.js";
import type { Env } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"] }));
app.use("*", logger());
if (process.env["NODE_ENV"] !== "production") app.use("*", prettyJSON());

// ── Civic routes (Flask → Hono, process.env-based auth) ───────────────────
app.route("/", healthRouter);
app.route("/", historyRouter);
app.route("/", callScoreRouter);
app.route("/", leaderboardRouter);
app.route("/", callsRouter);
app.route("/", openstatesRouter);
// Stub router (501 for unported civic routes)
app.route("/", civicRouter);
app.route("/", snapLegacyRouter);
app.route("/", snapPacketsRouter);
app.route("/", ocrWebhookRouter);
app.route("/", shareRouter);

// ── Enrollment routes (snap_enrollment schema, JWT actor-scoped) ───────────
const enrollmentApi = new Hono<{ Bindings: Env }>();
enrollmentApi.use("*", authMiddleware);
enrollmentApi.route("/packets", enrollmentPacketsRouter);
enrollmentApi.route("/", documentsRouter);  // /packets/:id/documents, /documents/:id
enrollmentApi.route("/", answersRouter);    // /packets/:id/answers, /answers/:id/review
enrollmentApi.route("/", notesRouter);      // /packets/:id/notes, /notes/:id
enrollmentApi.route("/", consentsRouter);   // /applicants/:id/consents, /consents

app.route("/v1/enrollment", enrollmentApi);

// ── Error handlers ─────────────────────────────────────────────────────────
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  // Fall through to errorHandler for ZodError etc.
  return errorHandler(err, c);
});
app.notFound((c) => c.json({ code: "not_found", message: "Route not found" }, 404));

const port = Number(process.env["PORT"] ?? 3001);
console.warn(`Civica API listening on :${port}`);

export default { port, fetch: app.fetch };
