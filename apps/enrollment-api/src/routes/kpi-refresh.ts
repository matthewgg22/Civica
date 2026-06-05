// POST /internal/kpi-snapshot/refresh — on-demand KPI truth-point refresh.
//
// Mirrors error-rate-refresh.ts: lets ops (or the /insight loop) populate
// snap_enrollment.kpi_snapshot without waiting for the 04:00 cron. Calls the
// SAME refreshKpiSnapshot() the scheduled handler uses — single source, no
// drift. Useful right after instrumenting a new pillar to populate immediately
// and confirm the write path, rather than trusting the next unattended run.
//
// Secret-guarded and mounted OUTSIDE the user-auth `api` group (machine/ops
// trigger, not a user action). Disabled (503) until KPI_REFRESH_SECRET is set
// via `wrangler secret put`.

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../types.js";
import { refreshKpiSnapshot, type LogFn } from "../cron/kpi-snapshot.js";

export const kpiRefreshRouter = new Hono<{ Bindings: Env }>();

kpiRefreshRouter.post("/", async (c) => {
  const secret = c.env.KPI_REFRESH_SECRET;
  // No secret configured → the endpoint is intentionally inert (not callable).
  if (!secret) {
    throw new HTTPException(503, { message: "Refresh endpoint not configured" });
  }
  if (c.req.header("Authorization") !== `Bearer ${secret}`) {
    throw new HTTPException(401, { message: "Invalid refresh token" });
  }

  const log: LogFn = (level, msg, ctx) =>
    console.log(JSON.stringify({ level, msg, route: "kpi-refresh", ...ctx }));

  const result = await refreshKpiSnapshot(c.env, log);
  return c.json({ ok: true, ...result });
});
