import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { errorHandler } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";
import { civicRouter } from "./routes/civic/index.js";
import { historyRouter } from "./routes/civic/history.js";
import { callScoreRouter } from "./routes/civic/call-score.js";
import { leaderboardRouter } from "./routes/civic/leaderboard.js";
import { callsRouter } from "./routes/civic/calls.js";
import { openstatesRouter } from "./routes/openstates/index.js";
import { snapLegacyRouter } from "./routes/snap/legacy.js";
import { packetsRouter } from "./routes/snap/packets.js";
import { ocrWebhookRouter } from "./routes/webhooks/ocr.js";
import { shareRouter } from "./routes/share/index.js";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());
if (process.env["NODE_ENV"] !== "production") app.use("*", prettyJSON());

app.route("/", healthRouter);
// Ported routes (override stubs in civicRouter — mount before stubs)
app.route("/", historyRouter);
app.route("/", callScoreRouter);
app.route("/", leaderboardRouter);
app.route("/", callsRouter);
app.route("/", openstatesRouter);
// Stub router (501 for unported routes)
app.route("/", civicRouter);
app.route("/", snapLegacyRouter);
app.route("/", packetsRouter);
app.route("/", ocrWebhookRouter);
app.route("/", shareRouter);

app.onError(errorHandler);
app.notFound((c) => c.json({ code: "not_found", message: "Route not found" }, 404));

const port = Number(process.env["PORT"] ?? 3001);
console.warn(`Civica API listening on :${port}`);

export default { port, fetch: app.fetch };
