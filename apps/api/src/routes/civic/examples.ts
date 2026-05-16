// GET /api/v1/civic/examples
import { Hono } from "hono";
import { optionalAuth } from "../../middleware/auth.js";
import { supabaseAdmin } from "../../lib/supabase.js";

type AuthEnv = { Variables: { userId?: string } };
export const examplesRouter = new Hono<AuthEnv>();

examplesRouter.get("/api/v1/civic/examples", optionalAuth, async (c) => {
  const timeout = AbortSignal.timeout(5000);

  const { data, error } = await supabaseAdmin
    .from("civic_example_templates")
    .select(
      "issue_id, slug, title, category, summary, primary_ask, template_asks, " +
      "target_chambers, related_bills, tags, live_script, voicemail_script, " +
      "presentation, display_order",
    )
    .eq("status", "published")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .abortSignal(timeout);

  if (error) {
    console.error("examples load failed", error);
    // Degrade gracefully — display route, empty list is better than an error page
    return c.json({ examples: [] });
  }

  return c.json({ examples: data ?? [] });
});
