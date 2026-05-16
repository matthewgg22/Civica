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

  // Postgres transaction-local variables consumed by audit_row_change()
  // DB types don't include set_config; cast to bypass — it's a standard Postgres built-in
  type RpcFn = typeof db.rpc;
  const rpc = db.rpc.bind(db) as (...args: Parameters<RpcFn>) => ReturnType<RpcFn>;
  await rpc("set_config" as never, {
    setting_name: "snap_enrollment.actor_kind",
    new_value: actor.kind,
    is_local: true,
  } as never);
  await rpc("set_config" as never, {
    setting_name: "snap_enrollment.actor_id",
    new_value: actor.id,
    is_local: true,
  } as never);
  await rpc("set_config" as never, {
    setting_name: "snap_enrollment.request_id",
    new_value: requestId,
    is_local: true,
  } as never);

  return db;
}
