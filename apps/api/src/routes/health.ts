import { Hono } from "hono";

export const healthRouter = new Hono();

healthRouter.get("/", (c) => c.json({ ok: true, service: "Civica API", version: "2.0.0" }));
healthRouter.get("/healthz", (c) => c.json({ ok: true }));
