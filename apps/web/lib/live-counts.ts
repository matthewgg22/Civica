// The live count behind the hero tally — and the reason it exists at all.
//
// The requested line was "Over 300 people have shared this question". At the
// time, prod had 12 public questions and 4 sessions ever, so that number was
// refused (no invented metrics, same rule as dollar figures). The approved
// replacement (2026-08-21) is DORMANT-UNTIL-TRUE: count the real public-mode
// audit rows, render nothing until the count clears an honest floor, and let
// the line appear on its own the day it becomes true.
//
// Failure degrades to SILENCE. A broken counter that shows a stale or made-up
// number is worse than no counter — every error path here resolves null, and
// null keeps the tally off. This also makes CI and preview builds (no
// Supabase env) safe by construction.
//
// NOT cached, on purpose. The ask pages are dynamic (they read searchParams
// for the redirect-to-/chat cases), so this runs per pageview — a HEAD-only
// exact count, single-digit milliseconds, against traffic currently measured
// in hundreds of sessions. unstable_cache needs Next's request context (which
// the unit tests don't have) and a module-level TTL memo would be solving a
// load problem this page does not yet have. If the ask pages ever see real
// traffic, add the memo then.

import { supabaseAdmin } from "./supabase-server";

/** Below this, "N questions answered" reads as an admission rather than
 *  social proof, and the card is better silent. Pinned ≥50 in tests. */
export const COUNT_FLOOR = 50;

export async function publicQuestionCount(): Promise<number | null> {
  try {
    // mode="public" only: eval runs write the same table (mode "eval") and
    // must never inflate the public figure.
    const { count, error } = await supabaseAdmin()
      .schema("snap_enrollment")
      .from("mae_query_log")
      .select("*", { count: "exact", head: true })
      .eq("mode", "public");
    if (error || count === null || count === undefined) return null;
    return count;
  } catch {
    return null;
  }
}
