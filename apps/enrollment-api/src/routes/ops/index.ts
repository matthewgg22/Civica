/**
 * Ops routes — mounted under /v1/enrollment/ops/* by the parent app.
 *
 * All routes require app_metadata.role === 'operator'. Two-layer gate:
 *   1. Dashboard middleware blocks /ops/* unless role matches.
 *   2. Each route here also calls requireOperator(actor.kind) before any
 *      service-role query runs. Defense in depth.
 *
 * See ceo-plans/2026-05-25-ebt-monetization-dashboard.md for the panel-by-panel
 * design that drives these endpoints.
 */

import type { Hono } from "hono";
import ebtAggregatesRouter from "./ebt-aggregates.js";
import placementsRouter from "./placements.js";
import notificationsRouter from "./notifications.js";
import cohortsRouter from "./cohorts.js";
import ttfdRouter from "./ttfd.js";
import partnerPnlRouter from "./partner-pnl.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mountOps(app: Hono<any>): void {
  app.route("/ebt-aggregates", ebtAggregatesRouter);
  app.route("/placements", placementsRouter);
  app.route("/notifications", notificationsRouter);
  app.route("/cohorts", cohortsRouter);
  app.route("/ttfd", ttfdRouter);
  app.route("/partner-pnl", partnerPnlRouter);
}

export {
  ebtAggregatesRouter,
  placementsRouter,
  notificationsRouter,
  cohortsRouter,
  ttfdRouter,
  partnerPnlRouter,
};
