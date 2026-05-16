import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { errorHandler } from "./middleware/error.js";
import { healthRouter } from "./routes/health.js";
import { civicRouter } from "./routes/civic/index.js";
import { snapLegacyRouter } from "./routes/snap/legacy.js";
import { packetsRouter } from "./routes/snap/packets.js";
import { ocrWebhookRouter } from "./routes/webhooks/ocr.js";
import { shareRouter } from "./routes/share/index.js";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());
if (process.env["NODE_ENV"] !== "production") app.use("*", prettyJSON());

app.route("/", healthRouter);
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
