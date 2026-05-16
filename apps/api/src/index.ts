import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { authMiddleware } from "./middleware/auth.js";
import packetsRouter from "./routes/packets.js";
import documentsRouter from "./routes/documents.js";
import answersRouter from "./routes/answers.js";
import notesRouter from "./routes/notes.js";
import consentsRouter from "./routes/consents.js";
import type { Env } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE"] }));

app.get("/health", (c) => c.json({ ok: true, service: "civica-enrollment-api" }));

// All enrollment routes require a valid Supabase JWT
const api = new Hono<{ Bindings: Env }>();
api.use("*", authMiddleware);

api.route("/packets", packetsRouter);
api.route("/", documentsRouter);   // /packets/:id/documents, /documents/:id
api.route("/", answersRouter);     // /packets/:id/answers, /answers/:id/review
api.route("/", notesRouter);       // /packets/:id/notes, /notes/:id
api.route("/", consentsRouter);    // /applicants/:id/consents, /consents

app.route("/v1/enrollment", api);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
