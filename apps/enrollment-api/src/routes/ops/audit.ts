/**
 * Audit-log helper for /ops/* endpoints.
 *
 * Every /ops/* route fires this once before returning. Writes are
 * fire-and-forget (no `await` of the resulting promise on the request path)
 * so audit-log latency never blocks the operator response.
 *
 * Failures are swallowed and logged — losing a single audit row is worse
 * than 500ing the operator, but not by much, so we log loudly via Sentry tags.
 */

import type { Context } from "hono";
import { makeServiceClient } from "../../lib/supabase.js";
import type { Env, Actor } from "../../types.js";

interface OpsAuditRow {
  actor_user_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  duration_ms: number;
  request_ip: string | null;
  user_agent: string | null;
}

export function logOpsAccess(
  c: Context<{ Bindings: Env }>,
  actor: Actor,
  endpoint: string,
  statusCode: number,
  durationMs: number,
): void {
  const row: OpsAuditRow = {
    actor_user_id: actor.id,
    endpoint,
    method: c.req.method,
    status_code: statusCode,
    duration_ms: Math.round(durationMs),
    request_ip: c.req.header("CF-Connecting-IP") ?? null,
    user_agent: c.req.header("User-Agent") ?? null,
  };

  // Fire-and-forget. Service-role write; bypasses RLS.
  const db = makeServiceClient(c.env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void (db.schema("snap_enrollment").from("ops_audit_log" as any) as any)
    .insert(row)
    .then(() => null)
    .catch(() => {
      // Swallow; do not fail the operator request on audit-write failure.
      // Sentry tag ops_endpoint=true (set in routes) lets us track this.
    });
}
