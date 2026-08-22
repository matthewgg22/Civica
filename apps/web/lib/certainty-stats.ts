// Grounded-rate readout for /verify.
//
// The point of this module is that the number on the credibility page is
// MEASURED, not asserted. Three rules follow from that:
//
//   1. Zero answers → `measured: false`, never "0%". A percentage computed
//      from no observations is a lie with a number attached.
//   2. Store unreachable → `measured: false` too. We never fall back to a
//      hardcoded figure; if we can't count it we don't claim it.
//   3. Degraded answers count as failures, matching the engine's own metric
//      definition — the metric cannot game itself.

import { supabaseAdmin } from "./supabase-server";

export interface CertaintyStats {
  measured: boolean;
  windowDays: number;
  totalAnswers: number;
  certainAnswers: number;
  /** Percent, one decimal. Null whenever `measured` is false. */
  groundedRate: number | null;
  degraded: number;
  recomposed: number;
  /** Most common reason certainty was withheld, e.g. "state_not_verified". */
  topReason: string | null;
  firstAnswerAt: string | null;
  lastAnswerAt: string | null;
}

const EMPTY = (windowDays: number): CertaintyStats => ({
  measured: false,
  windowDays,
  totalAnswers: 0,
  certainAnswers: 0,
  groundedRate: null,
  degraded: 0,
  recomposed: 0,
  topReason: null,
  firstAnswerAt: null,
  lastAnswerAt: null,
});

interface StatsRow {
  window_days: number;
  total_answers: number | string;
  certain_answers: number | string;
  grounded_rate: number | string | null;
  degraded: number | string;
  recomposed: number | string;
  top_reason: string | null;
  first_answer_at: string | null;
  last_answer_at: string | null;
}

export async function certaintyStats(windowDays = 30): Promise<CertaintyStats> {
  try {
    const db = supabaseAdmin();
    const { data, error } = await db
      .schema("snap_enrollment")
      .rpc("demeter_certainty_stats", { p_days: windowDays });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as StatsRow | undefined;
    // No rows, or rows but nothing in the window — both are "not yet measured".
    if (!row || Number(row.total_answers) === 0) return EMPTY(windowDays);
    return {
      measured: true,
      windowDays: Number(row.window_days),
      totalAnswers: Number(row.total_answers),
      certainAnswers: Number(row.certain_answers),
      groundedRate: row.grounded_rate === null ? null : Number(row.grounded_rate),
      degraded: Number(row.degraded),
      recomposed: Number(row.recomposed),
      topReason: row.top_reason,
      firstAnswerAt: row.first_answer_at,
      lastAnswerAt: row.last_answer_at,
    };
  } catch {
    // Unconfigured or unreachable store — say "not measured", never guess.
    return EMPTY(windowDays);
  }
}

/** Human label for a withheld-certainty reason code. */
export const REASON_LABEL: Record<string, string> = {
  state_not_verified: "the question was about a state whose policy we haven't verified yet",
  authority_not_retrieved: "we recognized the authority but didn't have its text in hand",
  degraded_to_sources: "we quoted the source text instead of summarizing it",
  unrecognized_citation: "a citation didn't match a source we could verify",
};
