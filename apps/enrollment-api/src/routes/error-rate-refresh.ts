// POST /internal/error-rate-snapshot/refresh — on-demand truth-point refresh.
//
// Surfaced by docs/findings/2026-05-29-error-rate-truth-point.md. Lets ops (or
// the /insight loop) populate snap_enrollment.error_rate_snapshot without
// waiting for the 04:00 cron. Calls the SAME refreshErrorRateSnapshot() the
// scheduled handler uses — single source, no logic duplication or drift.
//
// Secret-guarded and mounted OUTSIDE the user-auth `api` group (this is a
// machine/ops trigger, not a user action), mirroring the webhook routers.
// Disabled (503) until ERROR_RATE_REFRESH_SECRET is set via `wrangler secret put`.

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../types.js";
import { refreshErrorRateSnapshot, type LogFn } from "../cron/error-rate-snapshot.js";

export const errorRateRefreshRouter = new Hono<{ Bindings: Env }>();

errorRateRefreshRouter.post("/", async (c) => {
  const secret = c.env.ERROR_RATE_REFRESH_SECRET;
  // No secret configured → the endpoint is intentionally inert (not callable).
  if (!secret) {
    throw new HTTPException(503, { message: "Refresh endpoint not configured" });
  }
  if (c.req.header("Authorization") !== `Bearer ${secret}`) {
    throw new HTTPException(401, { message: "Invalid refresh token" });
  }

  const log: LogFn = (level, msg, ctx) =>
    console.log(JSON.stringify({ level, msg, route: "error-rate-refresh", ...ctx }));

  const result = await refreshErrorRateSnapshot(c.env, log);
  return c.json({ ok: true, ...result });
});
