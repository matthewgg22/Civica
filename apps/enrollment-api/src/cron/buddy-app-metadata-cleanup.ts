// ---------------------------------------------------------------------------
// Cron: clear app_metadata.role for completed/revoked buddy relationships.
//
// Why this exists: The auto-revoke trigger in 20260569_buddy_autorevoke_trigger.sql
// flips buddy_relationship.status to 'completed' when an applicant's packet hits a
// terminal state — but Postgres triggers cannot call the Supabase Admin API, so
// the buddy's JWT keeps claiming role='buddy' until token expiry (~1h). During
// that window, the buddy can still authenticate as kind='buddy' and read packet
// summaries via the buddy-scoped RLS policies.
//
// This cron closes the window. Every 5 minutes it sweeps buddy_relationship for
// status IN ('completed', 'revoked') AND app_metadata_cleared_at IS NULL, and
// for each row calls PUT /auth/v1/admin/users/:id with app_metadata.role = null.
// Max post-trigger exposure becomes 5 minutes instead of an hour.
//
// Surfaced by: /plan-eng-review 2026-05-22 (T2, P1).
// Closes: TODO-18, buddy-appmeta-one-way-door pitfall.
// ---------------------------------------------------------------------------

import { makeServiceClient } from "../lib/supabase.js";
import type { Env } from "../types.js";

const BATCH_SIZE = 500;

type CleanupRow = {
  id: string;
  buddy_user_id: string;
};

export type CleanupResult = {
  candidates: number;
  cleared: number;
  failed: number;
  /** Rows whose row-level cleared_at was set without calling Admin API, because
   *  the buddy still has another active relationship. */
  skipped_still_active: number;
};

/**
 * Sweeps buddy_relationship for revoked/completed rows whose app_metadata.role
 * has not yet been cleared. Calls the Supabase Admin API to drop the buddy role
 * claim from each affected auth user, then marks the row.
 *
 * Returns counts so the scheduled handler can log + (eventually) emit metrics.
 * Per-user failures don't abort the batch — a stuck Admin API on one user
 * shouldn't block clearing the other 499.
 */
export async function cleanupBuddyAppMetadata(env: Env): Promise<CleanupResult> {
  const db = makeServiceClient(env);

  const { data, error } = await (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db.schema("snap_enrollment").from("buddy_relationship" as any) as any
  )
    .select("id, buddy_user_id")
    .in("status", ["completed", "revoked"])
    .is("app_metadata_cleared_at", null)
    .limit(BATCH_SIZE) as { data: CleanupRow[] | null; error: { message: string } | null };

  if (error) {
    throw new Error(`buddy_relationship select failed: ${error.message}`);
  }

  const rows = data ?? [];
  if (rows.length === 0) {
    return { candidates: 0, cleared: 0, failed: 0, skipped_still_active: 0 };
  }

  let cleared = 0;
  let skipped_still_active = 0;
  let failed = 0;

  for (const row of rows) {
    // Multi-applicant guard: app_metadata.role is per-auth-user, not per-relationship.
    // If this buddy still helps another applicant, clearing the role globally
    // would silently break that active relationship. Only clear when this is
    // the buddy's last live link.
    const { data: activeRows, error: activeErr } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.schema("snap_enrollment").from("buddy_relationship" as any) as any
    )
      .select("id")
      .eq("buddy_user_id", row.buddy_user_id)
      .eq("status", "active")
      .limit(1) as { data: Array<{ id: string }> | null; error: { message: string } | null };

    if (activeErr) {
      failed += 1;
      continue;
    }

    const stillActive = (activeRows ?? []).length > 0;

    if (!stillActive) {
      const ok = await clearAppMetadataRole(env, row.buddy_user_id);
      if (!ok) {
        failed += 1;
        continue;
      }
    }

    const { error: updateErr } = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      db.schema("snap_enrollment").from("buddy_relationship" as any) as any
    )
      .update({ app_metadata_cleared_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updateErr) {
      // Admin API succeeded but the bookkeeping row didn't update — the next
      // sweep will retry the Admin API call (idempotent: app_metadata is
      // already cleared so it's a no-op) and try the update again.
      failed += 1;
      continue;
    }

    if (stillActive) {
      skipped_still_active += 1;
    } else {
      cleared += 1;
    }
  }

  return { candidates: rows.length, cleared, failed, skipped_still_active };
}

/**
 * Calls the Supabase Admin API to set app_metadata.role = null on the auth user.
 * Returns true on 2xx; false on any non-2xx so the caller can count failures.
 */
async function clearAppMetadataRole(env: Env, userId: string): Promise<boolean> {
  const url = `${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    // Pass role: null explicitly. PUT replaces app_metadata, so any other
    // keys present would be cleared — but the buddy accept flow only ever
    // sets { role: "buddy" }, so this is the right shape for our use.
    body: JSON.stringify({ app_metadata: { role: null } }),
  });
  return res.ok;
}
