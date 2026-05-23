/**
 * EBT Notification Routes (Lane D, T10)
 *
 * POST /ebt/notifications/register   — iOS uploads APNs device token after grant
 * POST /ebt/notifications/prefs      — iOS pushes per-category toggle + quiet hours
 * GET  /ebt/notifications/prefs      — iOS reads current prefs (e.g. on app open)
 *
 * Auth: applicant-only via JWT middleware. Buddy / navigator roles MUST NOT
 * mutate the applicant's notification surface — the apps/enrollment-api auth
 * middleware already supplies the actor, we 403 anything that isn't applicant.
 *
 * Token rotation: register upserts on (apns_token) so a re-install / token
 * rotation belonging to a *different* user replaces the prior owner. The
 * column UNIQUE(apns_token) and `user_id = excluded.user_id` ON CONFLICT
 * pattern matches what Lane A's migration is expected to ship; we cast
 * through `as any` until @civica/db-types regens.
 *
 * Pref defaults: prefs row is upserted on (user_id). Missing rows are
 * treated as "all defaults on" by apns-send.ts.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../../lib/supabase.js";
import { requireApplicant } from "../../lib/auth.js";
import type { Env } from "../../types.js";

const app = new Hono<{ Bindings: Env }>();

// ─── Schemas ──────────────────────────────────────────────────────────────

const registerBodySchema = z.object({
  apns_token: z.string().min(32).max(256)
    // APNs hex tokens are 64 chars in practice but spec allows opaque
    // bytes — accept any hex string. We trim then lowercase for
    // dedup-friendly storage.
    .regex(/^[0-9a-fA-F]+$/, "apns_token must be hex"),
  platform: z.literal("ios"),
});

const prefsBodySchema = z.object({
  deposit_on: z.boolean(),
  low_balance_on: z.boolean(),
  perks_on: z.boolean(),
  recert_on: z.boolean(),
  quiet_start_minutes: z.number().int().min(0).max(24 * 60 - 1),
  quiet_end_minutes: z.number().int().min(0).max(24 * 60 - 1),
});

// ─── POST /ebt/notifications/register ─────────────────────────────────────

app.post("/register", zValidator("json", registerBodySchema), async (c) => {
  const actor = c.get("actor");
  requireApplicant(actor.kind);

  const { apns_token, platform } = c.req.valid("json");
  const token = apns_token.toLowerCase();

  const db = makeServiceClient(c.env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.schema("snap_enrollment").from("ebt_device_tokens" as any) as any)
    .upsert(
      {
        user_id: actor.id,
        apns_token: token,
        platform,
        registered_at: new Date().toISOString(),
      },
      { onConflict: "apns_token" },
    ) as { error: { message: string } | null };

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json({ ok: true }, 201);
});

// ─── POST /ebt/notifications/prefs ────────────────────────────────────────

app.post("/prefs", zValidator("json", prefsBodySchema), async (c) => {
  const actor = c.get("actor");
  requireApplicant(actor.kind);

  const body = c.req.valid("json");
  const db = makeServiceClient(c.env);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (db.schema("snap_enrollment").from("ebt_notification_prefs" as any) as any)
    .upsert(
      {
        user_id: actor.id,
        ...body,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    ) as { error: { message: string } | null };

  if (error) throw new HTTPException(500, { message: error.message });
  return c.json({ ok: true });
});

// ─── GET /ebt/notifications/prefs ─────────────────────────────────────────

app.get("/prefs", async (c) => {
  const actor = c.get("actor");
  requireApplicant(actor.kind);

  const db = makeServiceClient(c.env);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.schema("snap_enrollment").from("ebt_notification_prefs" as any) as any)
    .select("deposit_on, low_balance_on, perks_on, recert_on, quiet_start_minutes, quiet_end_minutes")
    .eq("user_id", actor.id)
    .maybeSingle() as {
      data: {
        deposit_on: boolean;
        low_balance_on: boolean;
        perks_on: boolean;
        recert_on: boolean;
        quiet_start_minutes: number;
        quiet_end_minutes: number;
      } | null;
      error: { message: string } | null;
    };

  if (error) throw new HTTPException(500, { message: error.message });

  // Missing row → return plan defaults per §4.4.
  if (!data) {
    return c.json({
      deposit_on: true,
      low_balance_on: true,
      perks_on: true,
      recert_on: true,
      quiet_start_minutes: 21 * 60,
      quiet_end_minutes: 8 * 60,
    });
  }

  return c.json(data);
});

export default app;
