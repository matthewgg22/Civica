import type { Context, Next } from "hono";
import { makeServiceClient } from "../lib/supabase.js";
import type { Env } from "../types.js";

/**
 * Sets snap_enrollment.actor_* transaction-local settings required by the
 * audit trigger before every mutating query.
 *
 * Call this inside route handlers that write to the DB:
 *   const db = await withActorContext(c, env);
 *   await db.schema("snap_enrollment").from("snap_packets").update(...);
 */
export async function withActorContext(c: Context<{ Bindings: Env }>) {
  const actor = c.get("actor");
  const requestId = c.req.header("X-Request-Id") ?? crypto.randomUUID();
  const db = makeServiceClient(c.env);

  // Postgres transaction-local variables consumed by audit_row_change().
  // set_config is a built-in Postgres function not modelled in generated db-types.
  type SetConfigArgs = { setting_name: string; new_value: string; is_local: boolean };
  const rpc = db.rpc.bind(db) as unknown as (fn: string, args: SetConfigArgs) => Promise<unknown>;
  await rpc("set_config", { setting_name: "snap_enrollment.actor_kind", new_value: actor.kind, is_local: true });
  await rpc("set_config", { setting_name: "snap_enrollment.actor_id", new_value: actor.id, is_local: true });
  await rpc("set_config", { setting_name: "snap_enrollment.request_id", new_value: requestId, is_local: true });

  return db;
}
