// GET /api/v1/civic/leaderboard + /leaderboard/me
import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

type AuthEnv = { Variables: { userId: string } };
export const leaderboardRouter = new Hono<AuthEnv>();

type PeriodType = "daily" | "monthly" | "annual";

function normalizePeriodType(raw: string): PeriodType {
  const t = raw.toLowerCase().trim();
  if (t === "daily" || t === "monthly" || t === "annual") return t;
  throw new Error(`Invalid period_type: ${raw}. Must be daily, monthly, or annual.`);
}

function normalizePeriodStart(periodType: PeriodType, raw: string | undefined): string {
  const base = raw ? new Date(raw.replace("Z", "+00:00")) : new Date();
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  if (periodType === "daily") return d.toISOString();
  if (periodType === "monthly") return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).toISOString();
}

// Deterministic alias so user IDs never leak in leaderboard responses.
// Must match the Python implementation: sha256(user_id)[:8]
async function leaderboardAlias(userId: string): Promise<string> {
  const enc = new TextEncoder().encode(userId);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash)).slice(0, 4).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// GET /api/v1/civic/leaderboard
leaderboardRouter.get("/api/v1/civic/leaderboard", requireAuth, async (c) => {
  const periodTypeRaw = c.req.query("period_type") ?? "";
  const periodStart = c.req.query("period_start");
  const limit = Math.min(500, parseInt(c.req.query("limit") ?? "100", 10) || 100);

  let periodType: PeriodType;
  try { periodType = normalizePeriodType(periodTypeRaw); }
  catch (e) { return c.json({ code: "bad_request", message: String(e) }, 400); }

  const resolvedStart = normalizePeriodStart(periodType, periodStart);

  const { data: rows } = await supabaseAdmin
    .from("leaderboard_call_rollups")
    .select("user_id, eligible_verified_call_count, unique_office_count")
    .eq("period_type", periodType)
    .eq("period_start", resolvedStart)
    .order("eligible_verified_call_count", { ascending: false })
    .order("unique_office_count", { ascending: false })
    .limit(limit);

  const entries = await Promise.all(
    (rows ?? []).map(async (row, idx) => ({
      user_alias: await leaderboardAlias(row.user_id),
      eligible_verified_call_count: row.eligible_verified_call_count,
      unique_office_count: row.unique_office_count,
      rank: idx + 1,
    })),
  );

  return c.json({ period_type: periodType, period_start: resolvedStart, entries });
});

// GET /api/v1/civic/leaderboard/me
leaderboardRouter.get("/api/v1/civic/leaderboard/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const periodTypeRaw = c.req.query("period_type") ?? "";
  const periodStart = c.req.query("period_start");

  let periodType: PeriodType;
  try { periodType = normalizePeriodType(periodTypeRaw); }
  catch (e) { return c.json({ code: "bad_request", message: String(e) }, 400); }

  const resolvedStart = normalizePeriodStart(periodType, periodStart);

  const { data: rows } = await supabaseAdmin
    .from("leaderboard_call_rollups")
    .select("user_id, eligible_verified_call_count, unique_office_count")
    .eq("period_type", periodType)
    .eq("period_start", resolvedStart)
    .order("eligible_verified_call_count", { ascending: false })
    .order("unique_office_count", { ascending: false })
    .limit(500);

  const userAlias = await leaderboardAlias(userId);
  let rank: number | null = null;
  let count = 0;
  let uniqueOffices = 0;

  for (const [idx, row] of (rows ?? []).entries()) {
    const alias = await leaderboardAlias(row.user_id);
    if (alias === userAlias) {
      rank = idx + 1;
      count = row.eligible_verified_call_count;
      uniqueOffices = row.unique_office_count;
      break;
    }
  }

  // If not on the board, fall back to their own rollup
  if (rank === null) {
    const { data: myRollup } = await supabaseAdmin
      .from("leaderboard_call_rollups")
      .select("eligible_verified_call_count, unique_office_count")
      .eq("user_id", userId)
      .eq("period_type", periodType)
      .eq("period_start", resolvedStart)
      .single();
    if (myRollup) {
      count = myRollup.eligible_verified_call_count;
      uniqueOffices = myRollup.unique_office_count;
    }
  }

  return c.json({
    period_type: periodType,
    period_start: resolvedStart,
    user_id: userId,
    eligible_verified_call_count: count,
    unique_office_count: uniqueOffices,
    rank,
  });
});
