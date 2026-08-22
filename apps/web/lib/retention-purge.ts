// The retention job (#926) — the thing the Privacy Policy's retention section
// was describing before it existed.
//
// lib/demeter-audit-sink.ts has said since launch that question text lives 7
// days and flagged rows 30, "enforced by the retention job, not here." There
// was no such job. Nothing had ever been deleted from mae_query_log: every
// question and answer written since the public chat opened was still there,
// which made that sentence a statement of intent wearing the grammar of fact.
//
// WHAT EXPIRES IS THE TEXT, NOT THE ROW. The non-text columns — citations,
// certainty, verifier outcome, token counts — are the accuracy dataset the
// grounded-rate work runs on, and none of them is personal information.
// Deleting whole rows would destroy the evidence base to solve a privacy
// problem that only the text creates.
//
// WINDOWS ARE IMPORTED, NEVER RESTATED. A job that purges at 90 under a policy
// promising 7 is the exact failure the claims test exists to catch, and it
// cannot catch a number written independently in SQL or in this file.

import { RETENTION_DAYS } from "./legal/types";
import { supabaseAdmin } from "./supabase-server";

/** What replaces expired text. Not NULL: `question_redacted` is NOT NULL, and
 *  a tombstone also distinguishes "expired on schedule" from "never had one",
 *  which matters when reading an old row during an accuracy review. */
export const EXPIRED_TOMBSTONE = "[expired per retention policy]";

export type PurgeTier = { tier: "ordinary" | "flagged"; days: number; rows: number };
export type PurgeResult = { dryRun: boolean; tiers: PurgeTier[]; total: number };

/** ISO cutoff for a window, computed from a caller-supplied `now` so the tests
 *  do not depend on the wall clock. */
export function cutoffISO(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Blank expired question/answer text.
 *
 * Two tiers, because a row flagged for accuracy review is the one somebody
 * may still need to read: ordinary rows expire at RETENTION_DAYS.questionText,
 * flagged rows (unrecognized_count > 0) at RETENTION_DAYS.flaggedRow.
 *
 * `dryRun` counts without writing — the first real run will sweep every row
 * accumulated since launch, and that is worth seeing the size of first.
 */
export async function runRetentionPurge(
  opts: { dryRun?: boolean; now?: Date } = {},
): Promise<PurgeResult> {
  const dryRun = opts.dryRun ?? false;
  const now = opts.now ?? new Date();
  const db = supabaseAdmin();

  const tiers: PurgeTier[] = [];
  const table = () => db.schema("snap_enrollment").from("mae_query_log");

  for (const [tier, days, flagged] of [
    ["ordinary", RETENTION_DAYS.questionText, false],
    ["flagged", RETENTION_DAYS.flaggedRow, true],
  ] as const) {
    const cutoff = cutoffISO(days, now);

    if (dryRun) {
      // Filters hang off select()/update(), not off the table builder.
      const q = table()
        .select("id", { count: "exact", head: true })
        .lt("created_at", cutoff)
        // Already-expired rows are skipped, so a daily run touches only what
        // newly crossed the line rather than rewriting the whole table.
        .neq("question_redacted", EXPIRED_TOMBSTONE);
      const { count, error } = await (flagged
        ? q.gt("unrecognized_count", 0)
        : q.eq("unrecognized_count", 0));
      if (error) throw new Error(`retention purge (${tier}, dry run): ${error.message}`);
      tiers.push({ tier, days, rows: count ?? 0 });
      continue;
    }

    const q = table()
      .update({ question_redacted: EXPIRED_TOMBSTONE, answer: null })
      .lt("created_at", cutoff)
      .neq("question_redacted", EXPIRED_TOMBSTONE);
    const { data, error } = await (flagged
      ? q.gt("unrecognized_count", 0)
      : q.eq("unrecognized_count", 0)
    ).select("id");
    if (error) throw new Error(`retention purge (${tier}): ${error.message}`);
    tiers.push({ tier, days, rows: data?.length ?? 0 });
  }

  return { dryRun, tiers, total: tiers.reduce((n, t) => n + t.rows, 0) };
}
