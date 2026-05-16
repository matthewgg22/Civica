// POST /api/v1/civic/calls/log | launch | confirm
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

type AuthEnv = { Variables: { userId: string } };
export const callsRouter = new Hono<AuthEnv>();

const LogSchema = z.object({
  rep_id: z.string(),
  issue_id: z.string(),
  brief_id: z.string(),
  outcome: z.string(),
  staffer_position: z.string().optional(),
  notes: z.string().default(""),
});

const LaunchSchema = z.object({
  office_id: z.string(),
  issue_id: z.string().optional(),
  session_id: z.string().optional(),
  source_screen: z.string().default("issue_call_center"),
});

const ConfirmSchema = z.object({
  launch_event_id: z.string().uuid(),
  completed: z.boolean(),
  verification_method: z.string().default("app_initiated_self_confirmed"),
});

// POST /api/v1/civic/calls/log
callsRouter.post("/api/v1/civic/calls/log", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = LogSchema.parse(await c.req.json());

  // Look up rep_name from call_briefs
  const { data: brief } = await supabaseAdmin
    .from("call_briefs")
    .select("rep_name, issue_catalog:issue_id(issue_title)")
    .eq("brief_id", body.brief_id)
    .single();

  const repName = brief?.rep_name ?? body.rep_id;
  const issueTitle = (brief?.issue_catalog as unknown as Record<string, unknown> | null)?.["issue_title"] as string | null ?? "Constituent issue";

  const { data: log, error } = await supabaseAdmin.from("call_logs").insert({
    user_id: userId,
    rep_id: body.rep_id,
    rep_name: repName,
    issue_id: body.issue_id,
    issue_title: issueTitle,
    brief_id: body.brief_id,
    outcome: body.outcome,
    staffer_position: body.staffer_position,
    notes: body.notes,
  }).select("log_id").single();

  if (error) {
    console.error("calls/log insert failed", error);
    return c.json({ code: "internal_error", message: "Failed to log call" }, 500);
  }

  return c.json({ ok: true, log_id: log?.log_id });
});

// POST /api/v1/civic/calls/launch
callsRouter.post("/api/v1/civic/calls/launch", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = LaunchSchema.parse(await c.req.json());

  const { data: event, error } = await supabaseAdmin.from("call_launch_events").insert({
    user_id: userId,
    office_id: body.office_id,
    issue_id: body.issue_id,
    session_id: body.session_id,
    source_screen: body.source_screen,
  }).select("id, launched_at").single();

  if (error) {
    console.error("calls/launch insert failed", error);
    return c.json({ code: "internal_error", message: "Failed to log call launch" }, 500);
  }

  return c.json({ ok: true, launch_event_id: event?.id, launched_at: event?.launched_at });
});

// POST /api/v1/civic/calls/confirm
callsRouter.post("/api/v1/civic/calls/confirm", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = ConfirmSchema.parse(await c.req.json());

  // Fetch launch event to get office_id + issue_id
  const { data: launch } = await supabaseAdmin
    .from("call_launch_events")
    .select("office_id, issue_id, session_id")
    .eq("id", body.launch_event_id)
    .eq("user_id", userId)
    .single();

  if (!launch) {
    return c.json({ code: "not_found", message: "Launch event not found" }, 404);
  }

  // Eligibility: one unique (user, office, issue) per 90 days
  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: dupeCount } = await supabaseAdmin
    .from("call_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("office_id", launch.office_id)
    .eq("issue_id", launch.issue_id ?? "")
    .gte("completed_confirmed_at", cutoff90);

  const scoringEligible = body.completed && (dupeCount ?? 0) === 0;
  const ineligibilityReason = !body.completed
    ? "call_not_completed"
    : (dupeCount ?? 0) > 0
    ? "duplicate_office_issue_within_90_days"
    : null;

  const { data: event, error } = await supabaseAdmin.from("call_events").insert({
    user_id: userId,
    office_id: launch.office_id,
    issue_id: launch.issue_id,
    launch_event_id: body.launch_event_id,
    verification_method: body.verification_method,
    scoring_eligible_boolean: scoringEligible,
    scoring_ineligibility_reason: ineligibilityReason,
  }).select("id, completed_confirmed_at").single();

  if (error) {
    console.error("calls/confirm insert failed", error);
    return c.json({ code: "internal_error", message: "Failed to confirm call" }, 500);
  }

  return c.json({
    ok: true,
    call_event_id: event?.id,
    scoring_eligible: scoringEligible,
    ineligibility_reason: ineligibilityReason,
    completed_confirmed_at: event?.completed_confirmed_at,
  });
});
