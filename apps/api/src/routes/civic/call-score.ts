// Call score routes: summary, breakdown, history, recompute
import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

type AuthEnv = { Variables: { userId: string } };
export const callScoreRouter = new Hono<AuthEnv>();

const SCORE_MAXIMA = {
  activation_points: 30,
  recency_points: 10,
  consistency_points: 25,
  breadth_points: 20,
  momentum_points: 15,
};

function tierForScore(score: number): string {
  if (score >= 90) return "Champion";
  if (score >= 70) return "Leader";
  if (score >= 50) return "Advocate";
  if (score >= 30) return "Activist";
  if (score > 0) return "Engaged";
  return "Getting Started";
}

async function getOrComputeSnapshot(userId: string) {
  const { data } = await supabaseAdmin
    .from("call_score_snapshots")
    .select("*")
    .eq("user_id", userId)
    .single();
  return data;
}

// GET /api/v1/civic/call-score/summary
callScoreRouter.get("/api/v1/civic/call-score/summary", requireAuth, async (c) => {
  const userId = c.get("userId");
  const snapshot = await getOrComputeSnapshot(userId);

  if (!snapshot) {
    return c.json({
      call_score: 0,
      tier_name: tierForScore(0),
      updated_at: new Date().toISOString(),
      explanation: "No call score on record yet.",
      enabled: true,
    });
  }

  return c.json({
    call_score: snapshot.call_score,
    tier_name: snapshot.tier_name,
    updated_at: snapshot.updated_at,
    explanation: "Call score reflects verified calls over recent time windows.",
    enabled: true,
  });
});

// GET /api/v1/civic/call-score/breakdown
callScoreRouter.get("/api/v1/civic/call-score/breakdown", requireAuth, async (c) => {
  const userId = c.get("userId");
  const snapshot = await getOrComputeSnapshot(userId);

  if (!snapshot) {
    return c.json({
      call_score: 0,
      tier_name: tierForScore(0),
      components: { activation_points: 0, recency_points: 0, consistency_points: 0, breadth_points: 0, momentum_points: 0 },
      maxima: SCORE_MAXIMA,
      updated_at: new Date().toISOString(),
      enabled: true,
    });
  }

  return c.json({
    call_score: snapshot.call_score,
    tier_name: snapshot.tier_name,
    components: {
      activation_points: snapshot.activation_points,
      recency_points: snapshot.recency_points,
      consistency_points: snapshot.consistency_points,
      breadth_points: snapshot.breadth_points,
      momentum_points: snapshot.momentum_points,
    },
    maxima: SCORE_MAXIMA,
    updated_at: snapshot.updated_at,
    enabled: true,
  });
});

// GET /api/v1/civic/call-score/history
callScoreRouter.get("/api/v1/civic/call-score/history", requireAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(100, parseInt(c.req.query("limit") ?? "20", 10) || 20);

  const { data: events } = await supabaseAdmin
    .from("call_events")
    .select("id, office_id, issue_id, completed_confirmed_at, scoring_eligible_boolean, scoring_ineligibility_reason")
    .eq("user_id", userId)
    .order("completed_confirmed_at", { ascending: false })
    .limit(limit);

  return c.json({
    history: (events ?? []).map((e) => ({
      call_event_id: e.id,
      office_id: e.office_id,
      issue_id: e.issue_id,
      completed_confirmed_at: e.completed_confirmed_at,
      scoring_eligible_boolean: e.scoring_eligible_boolean,
      scoring_ineligibility_reason: e.scoring_ineligibility_reason,
    })),
  });
});

// POST /api/v1/civic/call-score/recompute
// Recomputes the scoring snapshot from raw call_events.
// Mirrors the Python service.recompute_call_score() algorithm.
callScoreRouter.post("/api/v1/civic/call-score/recompute", requireAuth, async (c) => {
  const userId = c.get("userId");
  const now = new Date();
  const cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const { data: eligibleCalls } = await supabaseAdmin
    .from("call_events")
    .select("id, office_id, issue_id, completed_confirmed_at")
    .eq("user_id", userId)
    .eq("scoring_eligible_boolean", true)
    .gte("completed_confirmed_at", cutoff.toISOString())
    .order("completed_confirmed_at", { ascending: false });

  const calls = eligibleCalls ?? [];

  // Activation (30 pts if any eligible call exists)
  const activationPoints = calls.length > 0 ? 30 : 0;

  // Recency (based on most recent call)
  let recencyPoints = 0;
  if (calls.length > 0) {
    const mostRecent = new Date(calls[0]!.completed_confirmed_at as string);
    const daysSince = Math.floor((now.getTime() - mostRecent.getTime()) / 86_400_000);
    if (daysSince <= 7) recencyPoints = 10;
    else if (daysSince <= 30) recencyPoints = 8;
    else if (daysSince <= 90) recencyPoints = 5;
    else if (daysSince <= 180) recencyPoints = 2;
  }

  // Consistency — calls in distinct calendar weeks over trailing 90d
  const trailing90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentCalls = calls.filter((e) => new Date(e.completed_confirmed_at as string) >= trailing90);
  const weeksWithCalls = new Set(recentCalls.map((e) => {
    const d = new Date(e.completed_confirmed_at as string);
    const weekStart = new Date(d);
    weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return weekStart.toISOString().slice(0, 10);
  })).size;
  const consistencyPoints = Math.min(25, weeksWithCalls * 5);

  // Breadth — unique offices called
  const uniqueOffices = new Set(calls.map((e) => e.office_id as string)).size;
  const breadthPoints = Math.min(20, uniqueOffices * 4);

  // Momentum — calls in trailing 30d vs prior 30d
  const trailing30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const prior30Start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const recent30 = calls.filter((e) => new Date(e.completed_confirmed_at as string) >= trailing30).length;
  const prior30 = calls.filter((e) => {
    const d = new Date(e.completed_confirmed_at as string);
    return d >= prior30Start && d < trailing30;
  }).length;
  let momentumPoints = 0;
  if (recent30 > prior30 && prior30 >= 1) momentumPoints = Math.min(15, (recent30 - prior30) * 5);
  else if (recent30 >= 3 && prior30 === 0) momentumPoints = 10;

  const callScore = activationPoints + recencyPoints + consistencyPoints + breadthPoints + momentumPoints;
  const tierName = tierForScore(callScore);

  const { data: previous } = await supabaseAdmin
    .from("call_score_snapshots")
    .select("call_score, tier_name, activation_points, recency_points, consistency_points, breadth_points, momentum_points")
    .eq("user_id", userId)
    .single();

  const snapshot = { call_score: callScore, activation_points: activationPoints, recency_points: recencyPoints, consistency_points: consistencyPoints, breadth_points: breadthPoints, momentum_points: momentumPoints, tier_name: tierName, updated_at: now.toISOString() };

  await supabaseAdmin.from("call_score_snapshots").upsert({ user_id: userId, ...snapshot });

  const changedComponents: string[] = [];
  if (previous) {
    for (const key of ["activation_points", "recency_points", "consistency_points", "breadth_points", "momentum_points"] as const) {
      if ((previous as Record<string, unknown>)[key] !== snapshot[key]) changedComponents.push(key);
    }
  }

  return c.json({
    ok: true,
    snapshot,
    changed_components: changedComponents,
    baseline_crossed: !previous && activationPoints === 30,
    tier_changed: previous ? previous.tier_name !== tierName : false,
  });
});
