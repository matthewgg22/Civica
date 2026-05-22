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
 *
 * Implementation: one RPC to snap_enrollment.set_actor_context() which batches
 * the underlying set_config calls. The prior pattern issued 3-4 sequential
 * set_config RPCs (~20ms each on the edge → Supabase link), adding 60-80ms
 * to every mutating request. See 20260571_set_actor_context_function.sql.
 */
export async function withActorContext(c: Context<{ Bindings: Env }>) {
  const actor = c.get("actor");
  const requestId = c.req.header("X-Request-Id") ?? crypto.randomUUID();
  const db = makeServiceClient(c.env);

  type SetActorContextArgs = {
    p_actor_kind: string;
    p_actor_id: string;
    p_request_id: string;
    p_buddy_relationship_id: string | null;
  };
  const rpc = db.rpc.bind(db) as unknown as (fn: string, args: SetActorContextArgs) => Promise<unknown>;
  await rpc("set_actor_context", {
    p_actor_kind: actor.kind,
    p_actor_id: actor.id,
    p_request_id: requestId,
    p_buddy_relationship_id:
      actor.kind === "buddy" && actor.buddy_relationship_id ? actor.buddy_relationship_id : null,
  });

  return db;
}
