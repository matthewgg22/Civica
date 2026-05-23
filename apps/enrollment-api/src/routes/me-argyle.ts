/**
 * Applicant Argyle connection routes (T-DR3-8)
 *
 * POST /me/argyle/connect — called by the iOS app after Argyle SDK completes
 *   linking. Upserts the applicant → Argyle user ID mapping in
 *   argyle_connections. From this point, paycheck.added webhooks from Argyle
 *   will resolve to this applicant.
 *
 * DELETE /me/argyle/connect — revokes the connection (sets revoked_at).
 *   The applicant can re-link at any time with a new POST.
 *
 * GET /me/argyle/connect — returns connection status (linked / not linked).
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { makeServiceClient } from "../lib/supabase.js";
import { getOrCreateApplicant } from "../lib/applicant.js";
import { requireApplicant } from "../lib/auth.js";
import { rateLimit } from "../lib/rate-limit.js";
import type { Env } from "../types.js";

const app = new Hono<{ Bindings: Env }>();

const connectBodySchema = z.object({
  /** Opaque Argyle user ID returned by the Argyle SDK after successful link. */
  argyle_user_id: z.string().min(1).max(255),
  /** Which packet this connection is for. */
  packet_id: z.string().uuid().optional(),
  /** Names of linked employer accounts (informational). */
  linked_accounts: z.array(z.record(z.unknown())).optional(),
});

// ---------------------------------------------------------------------------
// GET /me/argyle/connect — connection status
// ---------------------------------------------------------------------------

app.get("/", async (c) => {
  const actor = c.get("actor");
  requireApplicant(actor.kind);

  const applicant = await getOrCreateApplicant(c.env, c.get("jwt"), actor.id);
  const db = makeServiceClient(c.env);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("argyle_connections" as never)
    .select("connection_id, argyle_user_id, linked_accounts, linked_at, revoked_at")
    .eq("applicant_id", applicant.applicant_id)
    .is("revoked_at", null)
    .maybeSingle() as unknown as {
      data: {
        connection_id: string;
        argyle_user_id: string;
        linked_accounts: unknown[];
        linked_at: string;
        revoked_at: string | null;
      } | null;
      error: { message: string } | null;
    };

  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({
    linked: data !== null,
    connection: data ?? null,
  });
});

// ---------------------------------------------------------------------------
// POST /me/argyle/connect — register Argyle user ID after iOS SDK link
// ---------------------------------------------------------------------------

app.post("/", rateLimit("standard"), zValidator("json", connectBodySchema), async (c) => {
  const actor = c.get("actor");
  requireApplicant(actor.kind);

  const body = c.req.valid("json");
  const applicant = await getOrCreateApplicant(c.env, c.get("jwt"), actor.id);
  const db = makeServiceClient(c.env);

  const now = new Date().toISOString();

  // Upsert on applicant_id: revoke any existing active connection and create a
  // fresh one. This handles re-linking after a disconnect or user ID change.
  // First, revoke existing (if any) so the unique index on argyle_user_id is free.
  await db
    .schema("snap_enrollment")
    .from("argyle_connections" as never)
    .update({ revoked_at: now } as never)
    .eq("applicant_id", applicant.applicant_id)
    .is("revoked_at", null);

  // Insert new connection
  const { data, error } = await db
    .schema("snap_enrollment")
    .from("argyle_connections" as never)
    .insert({
      applicant_id: applicant.applicant_id,
      packet_id: body.packet_id ?? null,
      argyle_user_id: body.argyle_user_id,
      linked_accounts: body.linked_accounts ?? [],
      linked_at: now,
    } as never)
    .select("connection_id, argyle_user_id, linked_at")
    .single() as unknown as {
      data: { connection_id: string; argyle_user_id: string; linked_at: string } | null;
      error: { code: string; message: string } | null;
    };

  if (error?.code === "23505") {
    throw new HTTPException(409, { message: "Argyle user ID already linked to another account" });
  }
  if (error) throw new HTTPException(500, { message: error.message });

  return c.json({ linked: true, connection: data }, 201);
});

// ---------------------------------------------------------------------------
// DELETE /me/argyle/connect — revoke Argyle connection
// ---------------------------------------------------------------------------

app.delete("/", async (c) => {
  const actor = c.get("actor");
  requireApplicant(actor.kind);

  const applicant = await getOrCreateApplicant(c.env, c.get("jwt"), actor.id);
  const db = makeServiceClient(c.env);

  const { data, error } = await db
    .schema("snap_enrollment")
    .from("argyle_connections" as never)
    .update({ revoked_at: new Date().toISOString() } as never)
    .eq("applicant_id", applicant.applicant_id)
    .is("revoked_at", null)
    .select("connection_id")
    .maybeSingle() as unknown as {
      data: { connection_id: string } | null;
      error: { message: string } | null;
    };

  if (error) throw new HTTPException(500, { message: error.message });
  if (!data) throw new HTTPException(404, { message: "No active Argyle connection found" });

  return c.json({ linked: false });
});

export default app;
