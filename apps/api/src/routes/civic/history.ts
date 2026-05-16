// GET /api/v1/civic/history
// Loads call logs + briefs + issue catalog for the user, returning the
// same shape as the Flask service.history() → HistoryResponse.to_dict()
import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

type AuthEnv = { Variables: { userId: string } };
export const historyRouter = new Hono<AuthEnv>();

historyRouter.get("/api/v1/civic/history", requireAuth, async (c) => {
  const userId = c.get("userId");

  const { data: briefs, error } = await supabaseAdmin
    .from("call_briefs")
    .select(`
      brief_id, issue_id, rep_id, rep_name, office_type,
      primary_phone_number, local_office_phone_number,
      relevance_badges, related_bills, related_committees,
      live_script, voicemail_script, talking_points, rep_slot, created_at,
      issue_catalog:issue_id (
        issue_id, issue_title, issue_summary, selected_ask,
        optional_bill_ref, resolved_bills, resolved_committees, resolved_agencies, updated_at
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("history load failed", error);
    return c.json({ code: "internal_error", message: "Failed to load history" }, 500);
  }

  // Group briefs by issue_id to match HistoryGroup shape
  const groupMap = new Map<string, {
    issue_id: string; issue_title: string; issue_summary: string;
    selected_ask: string; optional_bill_ref: string | null;
    resolved_bills: unknown[]; resolved_committees: unknown[]; resolved_agencies: unknown[];
    updated_at: string; briefs: unknown[];
  }>();

  for (const brief of briefs ?? []) {
    const issue = brief.issue_catalog as unknown as Record<string, unknown> | null;
    if (!issue) continue;
    const issueId = String(brief.issue_id);

    if (!groupMap.has(issueId)) {
      groupMap.set(issueId, {
        issue_id: issueId,
        issue_title: String(issue["issue_title"] ?? ""),
        issue_summary: String(issue["issue_summary"] ?? ""),
        selected_ask: String(issue["selected_ask"] ?? ""),
        optional_bill_ref: issue["optional_bill_ref"] as string | null,
        resolved_bills: (issue["resolved_bills"] as unknown[]) ?? [],
        resolved_committees: (issue["resolved_committees"] as unknown[]) ?? [],
        resolved_agencies: (issue["resolved_agencies"] as unknown[]) ?? [],
        updated_at: String(issue["updated_at"] ?? ""),
        briefs: [],
      });
    }

    groupMap.get(issueId)!.briefs.push({
      brief_id: brief.brief_id,
      rep_id: brief.rep_id,
      rep_name: brief.rep_name,
      office_type: brief.office_type,
      primary_phone_number: brief.primary_phone_number,
      local_office_phone_number: brief.local_office_phone_number,
      relevance_badges: brief.relevance_badges,
      related_bills: brief.related_bills,
      related_committees: brief.related_committees,
      live_script: brief.live_script,
      voicemail_script: brief.voicemail_script,
      talking_points: brief.talking_points,
      rep_slot: brief.rep_slot,
      issue_id: issueId,
      created_at: brief.created_at,
    });
  }

  return c.json({ history: Array.from(groupMap.values()) });
});
